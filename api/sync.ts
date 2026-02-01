
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

const ensureTables = async (client: any) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      color TEXT,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      total_area_m2 INTEGER DEFAULT 0,
      cells_owned INTEGER DEFAULT 0,
      last_lat DOUBLE PRECISION,
      last_lng DOUBLE PRECISION,
      last_seen BIGINT
    );
    CREATE TABLE IF NOT EXISTS cells (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      owner_nickname TEXT,
      updated_at BIGINT
    );
  `);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  if (!dbUrl) {
    return res.status(500).json({ error: "DATABASE_URL não configurada." });
  }

  const { userId, nickname, color, location, newCells, stats } = req.body;
  const client = await getPool().connect();

  try {
    await ensureTables(client);
    await client.query('BEGIN');

    // UPSERT do usuário: Cria se não existir (para os mocks) ou atualiza status
    if (userId) {
      await client.query(`
        INSERT INTO users (id, nickname, color, last_lat, last_lng, last_seen, xp, level, total_area_m2, cells_owned)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET 
          nickname = EXCLUDED.nickname,
          color = EXCLUDED.color,
          last_lat = EXCLUDED.last_lat,
          last_lng = EXCLUDED.last_lng,
          last_seen = EXCLUDED.last_seen,
          xp = EXCLUDED.xp,
          level = EXCLUDED.level,
          total_area_m2 = EXCLUDED.total_area_m2,
          cells_owned = EXCLUDED.cells_owned
      `, [
        userId, 
        nickname || 'AGENTE ANONIMO', 
        color || '#3B82F6', 
        location?.lat || null, 
        location?.lng || null, 
        Date.now(), 
        stats?.xp || 0, 
        stats?.level || 1, 
        stats?.totalAreaM2 || 0, 
        stats?.cellsOwned || 0
      ]);
    }

    if (newCells && Array.isArray(newCells)) {
      for (const cell of newCells) {
        await client.query(
          "INSERT INTO cells (id, owner_id, owner_nickname, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, owner_nickname = EXCLUDED.owner_nickname, updated_at = EXCLUDED.updated_at",
          [cell.id, cell.ownerId, cell.ownerNickname, Date.now()]
        );
      }
    }

    await client.query('COMMIT');

    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    const { rows: activeUsers } = await client.query(
      "SELECT id, nickname, color, xp, level, total_area_m2 as \"totalAreaM2\", last_lat as lat, last_lng as lng FROM users WHERE last_seen > $1",
      [tenMinutesAgo]
    );

    const { rows: cellsWithOwners } = await client.query(`
      SELECT 
        c.id, 
        c.owner_id as "ownerId", 
        u.nickname as "ownerNickname", 
        u.color as "ownerColor", 
        c.updated_at as "updatedAt" 
      FROM cells c
      LEFT JOIN users u ON c.owner_id = u.id
    `);

    res.status(200).json({
      users: activeUsers,
      cells: cellsWithOwners.reduce((acc: any, cell: any) => {
        acc[cell.id] = cell;
        return acc;
      }, {})
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error("Sync Database Error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
