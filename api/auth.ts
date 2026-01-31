
import { Pool } from "pg";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const dbUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10
    });
  }
  return pool;
};

const ensureTables = async (client: any) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT UNIQUE,
      password TEXT,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL não configurada." });

  const client = await getPool().connect();
  try {
    await ensureTables(client);
    const { nickname, password, color, avatarUrl, action } = req.body;

    if (!nickname || !password) {
      return res.status(400).json({ error: "Nickname e senha são obrigatórios." });
    }

    const { rows } = await client.query("SELECT * FROM users WHERE LOWER(nickname) = LOWER($1)", [nickname]);
    const existingUser = rows[0];

    // Cenário: Criar novo usuário
    if (action === 'register') {
      if (existingUser) {
        return res.status(409).json({ error: "Este codinome já está em uso por outro agente." });
      }
      const newUser = {
        id: `u_${Date.now()}`,
        nickname: nickname.toUpperCase(),
        password,
        color: color || '#3B82F6',
        avatar_url: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${nickname}`,
        xp: 0,
        level: 1,
        total_area_m2: 0,
        cells_owned: 0,
        last_seen: Date.now()
      };
      await client.query(
        "INSERT INTO users (id, nickname, password, color, avatar_url, xp, level, total_area_m2, cells_owned, last_seen) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [newUser.id, newUser.nickname, newUser.password, newUser.color, newUser.avatar_url, newUser.xp, newUser.level, newUser.total_area_m2, newUser.cells_owned, newUser.last_seen]
      );
      return res.status(201).json(newUser);
    } 
    
    // Cenário: Login existente
    if (!existingUser) {
      return res.status(404).json({ error: "Agente não encontrado no banco de dados." });
    }

    if (existingUser.password !== password) {
      return res.status(401).json({ error: "Chave de acesso inválida. Acesso negado." });
    }

    res.status(200).json(existingUser);
  } catch (err: any) {
    res.status(500).json({ error: `Erro terminal: ${err.message}` });
  } finally {
    client.release();
  }
}
