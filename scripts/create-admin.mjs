/**
 * Crée (ou réinitialise) le compte administrateur dans Supabase Auth et le
 * rattache à admin_accounts, seule table qui autorise l'accès complet.
 *
 *   node scripts/create-admin.mjs <email> [mot-de-passe]
 *
 * Sans mot de passe, un mot de passe solide est généré et affiché une seule
 * fois : il n'est stocké nulle part.
 */
import { randomBytes } from "node:crypto";
import pg from "pg";

const SB = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const email = (process.argv[2] || "").trim().toLowerCase();
const fourni = process.argv[3];

if (!SB || !KEY) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (fichier .env).");
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage : node scripts/create-admin.mjs leegend.cars099@gmail.com [mot-de-passe]");
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

/* Un mot de passe à 20 caractères : 12 octets aléatoires en base64url, avec une
   longueur garantie indépendante de l'alphabet obtenu. */
const motDePasse = fourni || randomBytes(12).toString("base64url").slice(0, 20);

/* 1. Trouver un compte déjà existant pour ne pas créer de doublon. */
const liste = await (await fetch(`${SB}/auth/v1/admin/users?page=1&per_page=1000`, { headers })).json();
const existant = (Array.isArray(liste) ? liste : liste.users || []).find(
  (u) => (u.email || "").toLowerCase() === email
);

let uid = existant?.id;
if (existant) {
  console.log(`Compte déjà présent (${email}), mot de passe réinitialisé.`);
  await fetch(`${SB}/auth/v1/admin/users/${uid}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password: motDePasse, email_confirm: true }),
  });
} else {
  const r = await fetch(`${SB}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password: motDePasse, email_confirm: true }),
  });
  const j = await r.json();
  if (!r.ok) {
    console.error("Création refusée :", JSON.stringify(j).slice(0, 300));
    process.exit(1);
  }
  uid = j.id;
  console.log(`Compte créé (${email}).`);
}

/* 2. Le rattacher au rôle admin. C'est cette ligne qui donne tous les droits ;
   sans elle, le compte est un simple utilisateur authentifié. */
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query(
  `INSERT INTO admin_accounts (id, role, full_name, created_at)
   VALUES ($1, 'admin', '', $2)
   ON CONFLICT (id) DO UPDATE SET role = 'admin'`,
  [uid, new Date().toISOString()]
);

const { rows } = await pool.query("SELECT id, role FROM admin_accounts WHERE id = $1", [uid]);
console.log(`admin_accounts : ${JSON.stringify(rows[0])}`);
console.log(`uuid : ${uid}`);
console.log("");
console.log("  E-mail      :", email);
console.log("  Mot de passe:", motDePasse);
console.log("");
console.log("Notez ce mot de passe : il n'est stocké nulle part et ne sera plus affiché.");
console.log("Changez-le dès la première connexion depuis le back-office.");
await pool.end();