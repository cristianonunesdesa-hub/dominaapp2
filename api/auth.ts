// Arquivo: api/auth.ts

import bcrypt from "bcryptjs";
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

// ---------- Cor determinística por nickname (hash -> HSL -> HEX) ----------
const hashString = (str: string): number => {
  // FNV-1a-ish simples e determinístico
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0; // unsigned
};

const hslToHex = (h: number, s: number, l: number): string => {
  // h: 0..360, s/l: 0..100
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

  const toHex = (v: number) => {
    const hex = Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const nicknameToColor = (nickname: string): string => {
  const n = nickname.trim().toUpperCase();
  const h = hashString(n);

  // Hue 0..359
  const hue = h % 360;

  // S e L fixos p/ ficar "tático" e legível no mapa escuro
  // (se quiser variar levemente: dá pra usar bits do hash)
  const saturation = 85;
  const lightness = 55;

  return hslToHex(hue, saturation, lightness);
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

    const { nickname, password, avatarUrl, action } = req.body;

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

      const normalizedNick = nickname.toUpperCase();
      const passwordHash = await bcrypt.hash(password, 10);

      // ✅ cor determinística baseada no nickname
      const color = nicknameToColor(normalizedNick);

      // Avatar padrão (com fundo aproximando a cor)
      // Dicebear aceita backgroundColor sem '#'
      const avatar =
        avatarUrl ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
          normalizedNick
        )}&backgroundColor=${color.replace("#", "")}`;

      const newUser = {
        id: `u_${Date.now()}`,
        nickname: normalizedNick,
        password_hash: passwordHash,
        color,
        avatar_url: avatar,
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

    // ✅ opcional: garantir que a cor siga determinística (se usuário antigo tiver cor vazia)
    const desiredColor = existingUser.color || nicknameToColor(existingUser.nickname);

    const updated = await client.query(
      `
      UPDATE users
      SET last_seen = $2,
          color = $3
      WHERE id = $1
      RETURNING *
      `,
      [existingUser.id, Date.now(), desiredColor]
    );

    return res.status(200).json(toUserResponse(updated.rows[0]));
  } catch (err: any) {
    return res.status(500).json({ error: `Erro terminal: ${err.message}` });
  } finally {
    client.release();
  }
}
