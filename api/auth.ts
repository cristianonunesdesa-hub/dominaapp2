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

const ensureTables = async (client: any) => {
  // 1. Cria a tabela base caso não exista
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
      last_seen BIGINT,
      last_lat DOUBLE PRECISION,
      last_lng DOUBLE PRECISION,
      session_token TEXT
    );
  `);

  // 2. Migração: Adiciona colunas que podem estar faltando em instalações antigas
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS color TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);

  // 3. Garante que a tabela de células também exista
  await client.query(`
    CREATE TABLE IF NOT EXISTS cells (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      owner_nickname TEXT,
      updated_at BIGINT
    );
  `);
  
  // 4. Cria índices para performance
  await client.query(`CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_users_nickname_lower ON users(LOWER(nickname));`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_users_token ON users(session_token);`);
};

const hashString = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const nicknameToColor = (nickname: string): string => {
  const n = nickname.trim().toUpperCase();
  const h = hashString(n);
  const hue = h % 360;
  return hslToHex(hue, 85, 55);
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
    const { nickname, password, avatarUrl, action } = req.body;

    if (!nickname || nickname.length < 3 || nickname.length > 20) {
      return res.status(400).json({ error: "Codinome deve ter entre 3 e 20 caracteres." });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Chave de acesso muito curta (mín. 4)." });
    }

    const { rows } = await client.query(
      "SELECT * FROM users WHERE LOWER(nickname) = LOWER($1)",
      [nickname]
    );
    const existingUser = rows[0];

    // Geração de token seguro no servidor
    const sessionToken = crypto.randomBytes(32).toString('hex');

    if (action === "register") {
      if (existingUser) {
        return res.status(409).json({ error: "Este codinome já está em uso." });
      }
      const normalizedNick = nickname.toUpperCase();
      const passwordHash = await bcrypt.hash(password, 10);
      const color = nicknameToColor(normalizedNick);
      const avatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normalizedNick)}&backgroundColor=${color.replace("#", "")}`;

      const insert = await client.query(
        `INSERT INTO users (id, nickname, password_hash, color, avatar_url, xp, level, total_area_m2, cells_owned, last_seen, session_token)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11)
         RETURNING *`,
        [`u_${Date.now()}`, normalizedNick, passwordHash, color, avatar, 0, 1, 0, 0, Date.now(), sessionToken]
      );
      return res.status(201).json(toUserResponse(insert.rows[0]));
    }

    if (!existingUser) return res.status(404).json({ error: "Usuário não encontrado." });

    const validPassword = await bcrypt.compare(password, existingUser.password_hash);
    if (!validPassword) return res.status(401).json({ error: "Chave de acesso incorreta." });

    const updated = await client.query(
      `UPDATE users SET last_seen = $2, session_token = $3 WHERE id = $1 RETURNING *`,
      [existingUser.id, Date.now(), sessionToken]
    );

    return res.status(200).json(toUserResponse(updated.rows[0]));
  } catch (err: any) {
    return res.status(500).json({ error: `Falha no sistema de autenticação: ${err.message}` });
  } finally {
    client.release();
  }
}