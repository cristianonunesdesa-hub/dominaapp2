import { Pool } from "pg";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const dbUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
};

const ensureTables = async (client: any, wipe: boolean = false) => {
  // Garantir existência das tabelas com schema base
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      color TEXT,
      avatar_url TEXT,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      total_area_m2 INTEGER DEFAULT 0,
      cells_owned INTEGER DEFAULT 0,
      last_seen BIGINT
    );

    CREATE TABLE IF NOT EXISTS cells (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      owner_nickname TEXT,
      updated_at BIGINT
    );
  `);

  // Garantir que as colunas críticas existam via ALTER TABLE (idempotente)
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen BIGINT;
  `);

  if (wipe) {
    console.log("!!! WIPING ALL DATABASE DATA !!!");
    await client.query("TRUNCATE TABLE cells;");
    await client.query("TRUNCATE TABLE users;");
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL não configurada." });

  const { userId, location, newCells, stats, wipe } = req.body;

  if (wipe === true && process.env.NODE_ENV !== "development") {
    return res.status(403).json({ error: "Wipe bloqueado fora de development." });
  }

  const client = await getPool().connect();

  try {
    await ensureTables(client, wipe === true);
    if (wipe === true) return res.status(200).json({ message: "Database cleared successfully" });

    await client.query("BEGIN");

    if (userId) {
      const nickname = stats?.nickname || null;
      const color = stats?.color || null;

      // UPSERT robusto: se nickname/color forem null no payload de polling, o banco mantém o valor existente
      await client.query(
        `
        INSERT INTO users (
          id, nickname, password_hash, color, avatar_url,
          xp, level, total_area_m2, cells_owned,
          last_lat, last_lng, last_seen
        )
        VALUES (
          $1, 
          COALESCE($2, 'UNKNOWN'), 
          '', 
          COALESCE($3, '#3B82F6'), 
          $4, $5, $6, $7, $8, $9, $10, $11
        )
        ON CONFLICT (id)
        DO UPDATE SET
          nickname = COALESCE(EXCLUDED.nickname, users.nickname),
          color = COALESCE(EXCLUDED.color, users.color),
          avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
          xp = EXCLUDED.xp,
          level = EXCLUDED.level,
          total_area_m2 = EXCLUDED.total_area_m2,
          cells_owned = EXCLUDED.cells_owned,
          last_lat = EXCLUDED.last_lat,
          last_lng = EXCLUDED.last_lng,
          last_seen = EXCLUDED.last_seen
        `,
        [
          userId,
          nickname,
          color,
          null, // avatar_url
          stats?.xp ?? 0,
          stats?.level ?? 1,
          stats?.totalAreaM2 ?? 0,
          stats?.cellsOwned ?? 0,
          location?.lat || null,
          location?.lng || null,
          Date.now(),
        ]
      );
    }

    if (newCells && Array.isArray(newCells)) {
      for (const cell of newCells) {
        await client.query(
          `INSERT INTO cells (id, owner_id, owner_nickname, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             owner_id = EXCLUDED.owner_id,
             owner_nickname = EXCLUDED.owner_nickname,
             updated_at = EXCLUDED.updated_at`,
          [cell.id, cell.ownerId, cell.ownerNickname, Date.now()]
        );
      }
    }

    await client.query("COMMIT");

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const { rows: activeUsers } = await client.query(
      `SELECT id, nickname, color, avatar_url as "avatarUrl", xp, level, 
              total_area_m2 as "totalAreaM2", cells_owned as "cellsOwned", 
              last_lat as lat, last_lng as lng
       FROM users WHERE last_seen > $1`,
      [tenMinutesAgo]
    );

    const { rows: cellsWithOwners } = await client.query(`
      SELECT c.id, c.owner_id as "ownerId", u.nickname as "ownerNickname", 
             u.color as "ownerColor", c.updated_at as "updatedAt" 
      FROM cells c LEFT JOIN users u ON c.owner_id = u.id
    `);

    return res.status(200).json({
      users: activeUsers,
      cells: cellsWithOwners.reduce((acc: any, cell: any) => {
        acc[cell.id] = cell;
        return acc;
      }, {}),
    });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}