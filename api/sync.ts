// Arquivo: api/sync.ts

import { Pool } from "pg";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SyncPayload } from "../types";
import { ensureTables } from "./auth";

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

const obfuscateCoords = (val: number | null | undefined) => {
  if (val === null || val === undefined) return null;
  return Math.round(val * 10000) / 10000;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL não configurada." });

  const { userId, location, newCells, stats, wipe } = req.body as SyncPayload;
  const client = await getPool().connect();

  try {
    await ensureTables(client);

    if (wipe === true) {
      await client.query("TRUNCATE TABLE cells;");
      await client.query("TRUNCATE TABLE users;");
      return res.status(200).json({ message: "Database cleared" });
    }

    await client.query("BEGIN");

    if (userId) {
      await client.query(
        `INSERT INTO users (id, nickname, color, xp, level, total_area_m2, cells_owned, last_lat, last_lng, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
          nickname = COALESCE(EXCLUDED.nickname, users.nickname),
          color = COALESCE(EXCLUDED.color, users.color),
          xp = EXCLUDED.xp,
          level = EXCLUDED.level,
          total_area_m2 = EXCLUDED.total_area_m2,
          cells_owned = EXCLUDED.cells_owned,
          last_lat = EXCLUDED.last_lat,
          last_lng = EXCLUDED.last_lng,
          last_seen = EXCLUDED.last_seen`,
        [userId, stats?.nickname || null, stats?.color || null, stats?.xp ?? 0, stats?.level ?? 1, stats?.totalAreaM2 ?? 0, stats?.cellsOwned ?? 0, location?.lat || null, location?.lng || null, Date.now()]
      );
    }

    if (newCells && Array.isArray(newCells) && newCells.length > 0) {
      const placeholders: string[] = [];
      const values: any[] = [];
      const now = Date.now();
      newCells.forEach((cell, i) => {
        const offset = i * 5;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        values.push(cell.id, cell.ownerId, cell.ownerNickname, cell.ownerColor, now);
      });
      const upsertRes = await client.query(
        `INSERT INTO cells (id, owner_id, owner_nickname, owner_color, updated_at)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (id) DO UPDATE SET
           owner_id = EXCLUDED.owner_id,
           owner_nickname = EXCLUDED.owner_nickname,
           owner_color = EXCLUDED.owner_color,
           updated_at = EXCLUDED.updated_at`,
        values
      );
      console.log("[DB] inserted/updated cells:", newCells.length);
    }

    await client.query("COMMIT");

    const { rows: countRows } = await client.query("SELECT count(*) FROM cells");
    console.log("[DB] Total cells after sync:", countRows[0].count);

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const { rows: activeUsers } = await client.query(
      `SELECT id, nickname, color, avatar_url as "avatarUrl", xp, level, total_area_m2 as "totalAreaM2", cells_owned as "cellsOwned", last_lat as lat, last_lng as lng 
       FROM users WHERE last_seen > $1`,
      [tenMinutesAgo]
    );

    const { rows: cellsWithOwners } = await client.query(`
      SELECT 
        c.id, 
        c.owner_id as "ownerId", 
        COALESCE(u.nickname, c.owner_nickname) as "ownerNickname", 
        COALESCE(u.color, c.owner_color, '#4B5563') as "ownerColor", 
        c.updated_at as "updatedAt" 
      FROM cells c 
      LEFT JOIN users u ON c.owner_id = u.id
    `);

    return res.status(200).json({
      users: activeUsers.map(u => ({ ...u, lat: u.id === userId ? u.lat : obfuscateCoords(u.lat), lng: u.id === userId ? u.lng : obfuscateCoords(u.lng), xp: Number(u.xp), level: Number(u.level), totalAreaM2: Number(u.totalAreaM2), cellsOwned: Number(u.cellsOwned) })),
      cells: cellsWithOwners.reduce((acc: any, cell: any) => {
        acc[cell.id] = { id: cell.id, ownerId: cell.ownerId, ownerNickname: cell.ownerNickname, ownerColor: cell.ownerColor, updatedAt: Number(cell.updatedAt), defense: 1 };
        return acc;
      }, {}),
    });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(500).json({ error: `Sync error: ${err.message}` });
  } finally {
    client.release();
  }
}
