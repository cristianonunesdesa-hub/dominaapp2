
import { Pool } from "pg";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    // Tenta uma consulta simples para validar a conexão
    await pool.query("SELECT 1");
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Database health check failed:", err);
    res.status(500).json({ ok: false, error: "Database connection failed" });
  }
}
