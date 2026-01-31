
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

  const { userId, location, newCells, stats } = req.body;
  const client = await getPool().connect();

  try {
    await ensureTables(client);
    await client.query('BEGIN');

    if (userId && location) {
      await client.query(
        "UPDATE users SET last_lat = $1, last_lng = $2, last_seen = $3, xp = $4, level = $5, total_area_m2 = $6, cells_owned = $7 WHERE id = $8",
        [location.lat, location.lng, Date.now(), stats?.xp || 0, stats?.level || 1, stats?.totalAreaM2 || 0, stats?.cellsOwned || 0, userId]
      );
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

    // Radar de 10 minutos para usuários ATIVOS no mapa
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    const { rows: activeUsers } = await client.query(
      "SELECT id, nickname, color, avatar_url as \"avatarUrl\", last_lat as lat, last_lng as lng, xp, level, total_area_m2 as \"totalAreaM2\" FROM users WHERE last_seen > $1",
      [tenMinutesAgo]
    );

    // Busca todas as células com os dados dos proprietários (mesmo offline)
    const { rows: cellsWithOwners } = await client.query(`
      SELECT 
        c.id, 
        c.owner_id as "ownerId", 
        u.nickname as "ownerNickname", 
        u.color as "ownerColor", 
        u.avatar_url as "ownerAvatarUrl",
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
