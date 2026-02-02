// Arquivo: api/auth.ts

import { Pool } from "pg";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcrypt";

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
      last_lat DOUBLE PRECISION,
      last_lng DOUBLE PRECISION,
      last_seen BIGINT
    );
  `);
};

const toUserResponse = (row: any) => ({
  id: row.id,
  nickname: row.nickname,
  color: row.color,
  avatarUrl: row.avatar_url,
  xp: row.xp ?? 0,
  level: row.level ?? 1,
  totalAreaM2: row.total_area_m2 ?? 0,
  cellsOwned: row.cells_owned ?? 0,
  lat: row.last_lat ?? null,
  lng: row.last_lng ?? null,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL não configurada." });

  const client = await getPool().connect();

  try {
    await ensureTables(client);

    const { nickname, password, color, avatarUrl, action } = req.body;

    if (!nickname || !password) {
      return res.status(400).json({ error: "Nickname e senha são obrigatórios." });
    }

    const { rows } = await client.query(
      "SELECT * FROM users WHERE LOWER(nickname) = LOWER($1)",
      [nickname]
    );

    const existingUser = rows[0];

    // =========================
    // REGISTER
    // =========================
    if (action === "register") {
      if (existingUser) {
        return res.status(409).json({ error: "Este codinome já está em uso." });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = {
        id: `u_${Date.now()}`,
        nickname: nickname.toUpperCase(),
        password_hash: passwordHash,
        color: color || "#3B82F6",
        avatar_url:
          avatarUrl ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
            nickname
          )}`,
        xp: 0,
        level: 1,
        total_area_m2: 0,
        cells_owned: 0,
        last_seen: Date.now(),
      };

      const insert = await client.query(
        `
        INSERT INTO users (
          id, nickname, password_hash, color, avatar_url,
          xp, level, total_area_m2, cells_owned, last_seen
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
      `,
        [
          newUser.id,
          newUser.nickname,
          newUser.password_hash,
          newUser.color,
          newUser.avatar_url,
          newUser.xp,
          newUser.level,
          newUser.total_area_m2,
          newUser.cells_owned,
          newUser.last_seen,
        ]
      );

      return res.status(201).json(toUserResponse(insert.rows[0]));
    }

    // =========================
    // LOGIN
    // =========================
    if (!existingUser) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const validPassword = await bcrypt.compare(password, existingUser.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: "Senha inválida." });
    }

    // Atualiza last_seen no login (opcional, mas ajuda presença)
    const updated = await client.query(
      "UPDATE users SET last_seen = $2 WHERE id = $1 RETURNING *",
      [existingUser.id, Date.now()]
    );

    return res.status(200).json(toUserResponse(updated.rows[0]));
  } catch (err: any) {
    return res.status(500).json({ error: `Erro terminal: ${err.message}` });
  } finally {
    client.release();
  }
}
