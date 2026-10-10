import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL manquant. Copie .env.example en .env et renseigne la connexion Supabase " +
      "(Supabase > Project Settings > Database > Connection string > URI)."
  );
}

/* SSL non vérifié : le pooler Supabase présente un certificat émis par une
   autorité inconnue du bundle Node sous Windows. Le tunnel reste chiffré. */
export const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 4,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 20_000,
});

pool.on("error", (e) => {
  console.error("[postgres] erreur du pool :", e.message);
});

export const query = (text, params = []) => pool.query(text, params);

/** Première ligne, ou null. */
export const one = async (text, params) => (await query(text, params)).rows[0] ?? null;

/** Toutes les lignes. */
export const many = async (text, params) => (await query(text, params)).rows;

/** Transaction : le callback reçoit un client qui accepte les mêmes helpers. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const api = {
      query: (text, params = []) => client.query(text, params),
      one: async (text, params) => (await client.query(text, params)).rows[0] ?? null,
      many: async (text, params) => (await client.query(text, params)).rows,
    };
    const out = await fn(api);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** S'arrête proprement : sans cela le process ne se ferme jamais (Render, tests). */
export const closeDb = () => pool.end();