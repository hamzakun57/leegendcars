import pg from "pg";

/* PostgreSQL renvoie les BIGINT sous forme de texte, pour ne jamais perdre en
   précision sur de très grands nombres. Ici tous les identifiants tiennent
   largement dans un Number, et l'interface les compare avec Number(...) :
   sans cette conversion, « 5 » !== 5 et un formulaire se pré-remplit
   silencieusement dans le vide. PostgREST, lui, renvoie des nombres — on
   aligne les deux chemins sur le même comportement. */
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL manquant. Copie .env.example en .env et renseigne la connexion Supabase " +
      "(Supabase > Project Settings > Database > Connection string > URI)."
  );
}

/* SSL non vérifié : le pooler Supabase présente un certificat émis par une
   autorité inconnue du bundle Node sous Windows. Le tunnel reste chiffré. */
const config = {
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 4,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 20_000,
};

/* Sur Netlify Functions, le même conteneur sert plusieurs requêtes à la suite
   (« invocations tièdes »). Sans cette mise en cache, chaque requête rouvrirait
   un nouveau pool et saturerait vite le pooler Supabase. */
export const pool = globalThis.__lcPool ?? (globalThis.__lcPool = new pg.Pool(config));

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

/** S'arrête proprement : sans cela le process ne se ferme jamais (Render, tests).
 *  Inutile sur Netlify, où le conteneur est recyclé par la plateforme. */
export const closeDb = () => {
  globalThis.__lcPool = undefined;
  return pool.end();
};