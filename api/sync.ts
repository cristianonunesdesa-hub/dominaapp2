// Arquivo: api/sync.ts

import { Pool } from "pg";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SyncPayload } from "../types";

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

// Ofuscação de coordenadas para outros usuários (~11m de precisão)
const obfuscateCoords = (val: number | null | undefined) => {
  if (val === null || val === undefined) return null;
  return Math.round(val * 10000) / 10000;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL não configurada." });

  const authHeader = req.headers.authorization;
  const { userId, location, newCells, stats, wipe } = req.body as SyncPayload;

  if (wipe === true && process.env.NODE_ENV !== "development") {
    return res.status(403).json({ error: "Wipe restrito a ambiente de desenvolvimento." });
  }

  const client = await getPool().connect();

  try {
    // 1. Validação de Sessão (Obrigatória para operações de escrita)
    if (!wipe && userId) {
      const token = authHeader?.split(' ')[1];
      const { rows: userCheck } = await client.query(
        "SELECT id FROM users WHERE id = $1 AND session_token = $2",
        [userId, token]
      );
      if (userCheck.length === 0) {
        return res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
      }
    }

    if (wipe === true) {
      await client.query("TRUNCATE TABLE cells;");
      await client.query("TRUNCATE TABLE users;");
      return res.status(200).json({ message: "Database cleared" });
    }

    await client.query("BEGIN");

    if (userId) {
      await client.query(
        `
        INSERT INTO users (
          id, nickname, password_hash, color, avatar_url,
          xp, level, total_area_m2, cells_owned,
          last_lat, last_lng, last_seen
        )
        VALUES (
          $1, $2, '', $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        ON CONFLICT (id)
        DO UPDATE SET
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
          stats?.nickname || 'AGENT_' + userId.slice(-4),
          stats?.color || null,
          null,
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

    if (newCells && Array.isArray(newCells) && newCells.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];
      const now = Date.now();
      
      newCells.forEach((cell, i) => {
        const offset = i * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(cell.id, cell.ownerId, cell.ownerNickname, now);
      });

      await client.query(
        `INSERT INTO cells (id, owner_id, owner_nickname, updated_at)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (id) DO UPDATE SET
           owner_id = EXCLUDED.owner_id,
           owner_nickname = EXCLUDED.owner_nickname,
           updated_at = EXCLUDED.updated_at`,
        values
      );
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
      SELECT c.id, c.owner_id as "ownerId", 
             COALESCE(u.nickname, c.owner_nickname) as "ownerNickname", 
             u.color as "ownerColor", c.updated_at as "updatedAt" 
      FROM cells c LEFT JOIN users u ON c.owner_id = u.id
    `);

    return res.status(200).json({
      users: activeUsers.map(u => ({
        ...u,
        // Ofuscar localização de outros usuários por privacidade
        lat: u.id === userId ? u.lat : obfuscateCoords(u.lat),
        lng: u.id === userId ? u.lng : obfuscateCoords(u.lng),
        xp: Number(u.xp),
        level: Number(u.level),
        totalAreaM2: Number(u.totalAreaM2),
        cellsOwned: Number(u.cellsOwned)
      })),
      cells: cellsWithOwners.reduce((acc: any, cell: any) => {
        acc[cell.id] = {
          id: cell.id,
          ownerId: cell.ownerId,
          ownerNickname: cell.ownerNickname,
          ownerColor: cell.ownerColor,
          updatedAt: Number(cell.updatedAt),
          defense: 1
        };
        return acc;
      }, {}),
    });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(500).json({ error: `Falha na integridade dos dados: ${err.message}` });
  } finally {
    client.release();
  }
}