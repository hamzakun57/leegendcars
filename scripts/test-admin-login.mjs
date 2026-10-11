/* Vérifie que le compte admin s'authentifie réellement et accède à tout. */
const SB = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.argv[2];
const PASS = process.argv[3];
const H = { apikey: KEY, "Content-Type": "application/json" };

let pass = 0, fail = 0;
const check = (n, ok, extra = "") => { console.log(`${ok ? "  OK  " : "ECHEC"} ${n}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

if (!EMAIL || !PASS) {
  console.log("(aucun e-mail / mot de passe fourni : test ignoré)");
  process.exit(0);
}

/* Connexion avec la clé publique : c'est exactement ce que fera le navigateur. */
const login = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: process.env.SUPABASE_ANON_KEY || KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
const j = await login.json();
check("connexion par e-mail + mot de passe", login.ok && !!j.access_token, j.error_description || j.msg || "");

if (!j.access_token) { console.log(`\n${pass} reussis, ${fail} echecs`); process.exit(0); }

const A = { apikey: process.env.SUPABASE_ANON_KEY || KEY, Authorization: `Bearer ${j.access_token}` };
const postgrest = async (chemin, opts = {}) => {
  const r = await fetch(`${SB}/rest/v1/${chemin}`, { ...opts, headers: { ...A, ...(opts.headers || {}) } });
  const t = await r.text();
  let data = null; try { data = JSON.parse(t); } catch { data = t; }
  return { status: r.status, data };
};

const profil = await postgrest("admin_accounts?select=id,role&limit=1");
check("lit son profil (donc sait qu'il est admin)", profil.status === 200 && profil.data?.[0]?.role === "admin", JSON.stringify(profil.data).slice(0, 80));

const resa = await postgrest("reservations?select=id&limit=5");
check("lit les réservations", resa.status === 200, `HTTP ${resa.status}`);
const clients = await postgrest("clients?select=id&limit=5");
check("lit les clients", clients.status === 200, `HTTP ${clients.status}`);
const maint = await postgrest("maintenance?select=id&limit=5");
check("lit les suivis de maintenance", maint.status === 200, `HTTP ${maint.status}`);

/* Et la preuve inverse : la même requête avec la clé publique seule, sans
   jeton, ne doit rien renvoyer. RLS ne renvoie pas une erreur, il renvoie
   zéro ligne — d'où le contrôle sur le contenu et pas seulement le statut. */
const sansJeton = await fetch(`${SB}/rest/v1/clients?select=*&limit=5`, {
  headers: { apikey: process.env.SUPABASE_ANON_KEY || KEY },
});
const corps = await sansJeton.text();
const vide = corps === "[]";
check("SANS jeton, les clients restent inaccessibles", sansJeton.status >= 400 || vide, `HTTP ${sansJeton.status}, corps : ${corps.slice(0, 60)}`);

console.log(`\n${pass} reussis, ${fail} echecs`);