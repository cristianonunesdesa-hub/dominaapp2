// Arquivo: api/auth.ts

import bcrypt from "bcryptjs";
import { Pool } from "pg";
import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const dbUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
  }
  return pool;
};

/**
 * Função unificada de schema para garantir que todas as APIs vejam as mesmas colunas.
 */
export const ensureTables = async (client: any) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      password_hash TEXT,
      color TEXT,
      avatar_url TEXT,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      total_area_m2 INTEGER DEFAULT 0,
      cells_owned INTEGER DEFAULT 0,
      last_seen BIGINT,
      last_lat DOUBLE PRECISION,
      last_lng DOUBLE PRECISION,
      session_token TEXT
    );
  `);

  // Migrações inline para garantir colunas em DBs já existentes
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS color TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_area_m2 INTEGER DEFAULT 0;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cells_owned INTEGER DEFAULT 0;`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS cells (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      owner_nickname TEXT,
      owner_color TEXT,
      updated_at BIGINT
    );
  `);
  
  await client.query(`ALTER TABLE cells ADD COLUMN IF NOT EXISTS owner_nickname TEXT;`);
  await client.query(`ALTER TABLE cells ADD COLUMN IF NOT EXISTS owner_color TEXT;`);
  
  await client.query(`CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_cells_owner ON cells(owner_id);`);
};

const toUserResponse = (row: any) => ({
  id: row.id,
  nickname: row.nickname,
  color: row.color,
  avatarUrl: row.avatar_url,
  xp: Number(row.xp ?? 0),
  level: Number(row.level ?? 1),
  totalAreaM2: Number(row.total_area_m2 ?? 0),
  cellsOwned: Number(row.cells_owned ?? 0),
  lat: row.last_lat ?? null,
  lng: row.last_lng ?? null,
  sessionToken: row.session_token,
  badges: [],
  dailyStreak: 0
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL não configurada." });

  const client = await getPool().connect();

  try {
    await ensureTables(client);
    const { nickname, password, action } = req.body;

    if (!nickname || nickname.length < 3) return res.status(400).json({ error: "Nick muito curto." });
    
    const { rows } = await client.query("SELECT * FROM users WHERE LOWER(nickname) = LOWER($1)", [nickname]);
    const existingUser = rows[0];
    const sessionToken = crypto.randomBytes(32).toString('hex');

    if (action === "register") {
      if (existingUser) return res.status(409).json({ error: "Nick em uso." });
      const passwordHash = await bcrypt.hash(password, 10);
      const insert = await client.query(
        `INSERT INTO users (id, nickname, password_hash, last_seen, session_token) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [`u_${Date.now()}`, nickname.toUpperCase(), passwordHash, Date.now(), sessionToken]
      );
      return res.status(201).json(toUserResponse(insert.rows[0]));
    }

    if (!existingUser) return res.status(404).json({ error: "Não encontrado." });
    const valid = await bcrypt.compare(password, existingUser.password_hash);
    if (!valid) return res.status(401).json({ error: "Senha inválida." });

    const updated = await client.query(`UPDATE users SET last_seen = $2, session_token = $3 WHERE id = $1 RETURNING *`, [existingUser.id, Date.now(), sessionToken]);
    return res.status(200).json(toUserResponse(updated.rows[0]));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}