/**
 * Teste les règles d'accès comme si le navigateur appelait Supabase directement.
 *
 * On bascule le rôle PostgreSQL (`anon`, `authenticated`) et on joue le rôle
 * de l'appelant. C'est exactement ce que fait PostgREST quand le navigateur
 * utilise la clé publique : RLS décide de tout, la clé n'est pas une carte.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

let pass = 0, fail = 0;
const check = (nom, ok, extra = "") => {
  console.log(`${ok ? "  OK  " : "ECHEC"} ${nom}${extra ? " — " + extra : ""}`);
  ok ? pass++ : fail++;
};

/* Exécute une requête dans le rôle et le contexte JWT demandés. */
async function comme(role, uid, sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${role}`);
    if (uid) {
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role, email: role + "@test.local" }),
      ]);
    }
    const r = await client.query(sql, params);
    await client.query("COMMIT");
    return { ok: true, rows: r.rowCount };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, erreur: e.message };
  } finally {
    await client.release();
  }
}

/* Un compte d'authentification est un préalable : admin_accounts y est lié par
   clé étrangère, on ne peut donc pas inventer un uuid. On passe par l'API
   d'administration, celle que l'interface utilisera pour créer le compte admin. */
const SB = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const creerCompte = async (email) => {
  const r = await fetch(`${SB}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ email, password: "mot-de-passe-test-123", email_confirm: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("création du compte impossible : " + JSON.stringify(j).slice(0, 200));
  return j.id;
};
const supprimerCompte = async (uid) => {
  await fetch(`${SB}/auth/v1/admin/users/${uid}`, { method: "DELETE", headers: authHeaders });
};

const adminUid = await creerCompte(`admin-${randomUUID().slice(0, 8)}@test.local`);
const clientUid = await creerCompte(`client-${randomUUID().slice(0, 8)}@test.local`);
const VEHICULE = "rls-vehicule-test";

try {
  /* ---------- préparation (rôle postgres : il contourne RLS) ---------- */
  await pool.query("DELETE FROM vehicles WHERE slug = $1", [VEHICULE]);
  /* On ne retire que les rôles de ce test : un DELETE global effacerait le
     véritable compte administrateur de l'agence (et ses tests suivants
     échoueraient avec « pas accès à l'administration »). */
  await pool.query("DELETE FROM admin_accounts WHERE id = ANY($1::uuid[])", [[adminUid, clientUid]]);
  await pool.query(
    "INSERT INTO vehicles (slug, name, price_from, active, created_at, updated_at) VALUES ($1,'Voiture RLS',500,1,$2,$2)",
    [VEHICULE, new Date().toISOString()]
  );
  await pool.query("INSERT INTO vehicles (slug,name,price_from,active,created_at,updated_at) VALUES ('rls-cache','Voiture masquee',500,0,$1,$1)", [new Date().toISOString()]);
  await pool.query("INSERT INTO clients (last_name, first_name, created_at, updated_at) VALUES ('Rls','Test',$1,$1)", [new Date().toISOString()]);
  await pool.query("INSERT INTO reservations (ref, first_name, last_name, vehicle_slug, status, created_at, updated_at) VALUES ('RLS-TEST','Ana','Lee',$1,'confirmee',$2,$2)", [VEHICULE, new Date().toISOString()]);

  /* ================= ANON : un visiteur non connecté ================= */
  console.log("\n— visiteur non connecté (clé anon) —");

  const litFlotte = await comme("anon", null, "SELECT * FROM vehicles");
  check("lit la flotte", litFlotte.ok, `${litFlotte.rows} ligne(s)`);
  const masque = await comme("anon", null, "SELECT * FROM vehicles WHERE slug = 'rls-cache'");
  check("ne voit pas les véhicules désactivés", masque.ok && masque.rows === 0, `${masque.rows} ligne(s)`);

  const litResa = await comme("anon", null, "SELECT * FROM reservations");
  check("NE LIT PAS les réservations", !litResa.ok || litResa.rows === 0, litResa.ok ? `${litResa.rows} ligne(s)` : "refusé");

  const litClients = await comme("anon", null, "SELECT * FROM clients");
  check("NE LIT PAS les clients", !litClients.ok || litClients.rows === 0);

  const litPaiements = await comme("anon", null, "SELECT * FROM payments");
  check("NE LIT PAS les règlements", !litPaiements.ok || litPaiements.rows === 0);

  const litPieces = await comme("anon", null, "SELECT * FROM attachments");
  check("NE LIT PAS les pièces jointes", !litPieces.ok || litPieces.rows === 0);

  const litComptes = await comme("anon", null, "SELECT * FROM admin_accounts");
  check("NE LIT PAS la liste des administrateurs", !litComptes.ok || litComptes.rows === 0);

  const modifie = await comme("anon", null, "UPDATE reservations SET last_name = 'Pirate' WHERE ref = 'RLS-TEST'");
  check("NE MODIFIE PAS une réservation", !modifie.ok || modifie.rows === 0);

  const supprime = await comme("anon", null, "DELETE FROM reservations WHERE ref = 'RLS-TEST'");
  check("NE SUPPRIME PAS une réservation", !supprime.ok || supprime.rows === 0);

  const ajouteVoiture = await comme("anon", null, "INSERT INTO vehicles (slug,name,created_at,updated_at) VALUES ('rls-pirate','Voiture pirate',$1,$1)", [new Date().toISOString()]);
  check("N'AJOUTE PAS de véhicule", !ajouteVoiture.ok || ajouteVoiture.rows === 0);
  const { rows: pirate } = await pool.query("SELECT slug FROM vehicles WHERE slug = 'rls-pirate'");
  check("  … et rien n'a été écrit", pirate.length === 0);

  const ajouteClient = await comme("anon", null, "INSERT INTO clients (last_name, created_at, updated_at) VALUES ('RlsPirate',$1,$1)", [new Date().toISOString()]);
  check("N'AJOUTE PAS de client", !ajouteClient.ok || ajouteClient.rows === 0);

  /* ---------- la seule écriture autorisée : la demande de réservation ---------- */
  const ref = "RLS-" + randomUUID().slice(0, 6).toUpperCase();
  const demande = await comme(
    "anon",
    null,
    `INSERT INTO reservations (ref, first_name, last_name, phone, status, contract_number, invoice_number, total_paid, signature_data, created_at)
     VALUES ($1,'Yasmine','Public','+212600000000','confirmee','FAUX-CONTRAT','F2026-9999',999999,'FAUSSE-SIGNATURE','2000-01-01T00:00:00.000Z')`,
    [ref]
  );
  check("PEUT envoyer une demande", demande.ok && demande.rows === 1);

  const { rows: creee } = await pool.query(
    "SELECT status, contract_number, invoice_number, total_paid, signature_data, created_at FROM reservations WHERE ref = $1",
    [ref]
  );
  const r = creee[0] || {};
  check("  … statut forcé à « nouvelle »", r.status === "nouvelle", r.status);
  check("  … numéro de contrat effacé", r.contract_number === "", r.contract_number);
  check("  … numéro de facture effacé", r.invoice_number === "", r.invoice_number);
  check("  … montant encaissé remis à zéro", r.total_paid === 0, String(r.total_paid));
  check("  … signature ignorée", r.signature_data === "");
  check("  … date denaissance posée par le serveur", String(r.created_at).startsWith("20"), String(r.created_at).slice(0, 10));

  /* ================= AUTHENTIFIÉ SANS RÔLE ================= */
  console.log("\n— utilisateur connecté, non administrateur —");

  const litFlotte2 = await comme("authenticated", clientUid, "SELECT * FROM vehicles");
  check("peut lire la flotte publique", litFlotte2.ok);

  const litResa2 = await comme("authenticated", clientUid, "SELECT * FROM reservations");
  check("NE LIT PAS les réservations", !litResa2.ok || litResa2.rows === 0);

  const litClients2 = await comme("authenticated", clientUid, "SELECT * FROM clients");
  check("NE LIT PAS les clients", !litClients2.ok || litClients2.rows === 0);

  const modifie2 = await comme("authenticated", clientUid, "DELETE FROM reservations WHERE ref = 'RLS-TEST'");
  check("NE SUPPRIME PAS une réservation", !modifie2.ok || modifie2.rows === 0);

  const ajouteClient2 = await comme("authenticated", clientUid, "INSERT INTO clients (last_name, created_at, updated_at) VALUES ('Faux',$1,$1)", [new Date().toISOString()]);
  check("N'AJOUTE PAS de client", !ajouteClient2.ok || ajouteClient2.rows === 0);

  const seProclameAdmin = await comme("authenticated", clientUid, "INSERT INTO admin_accounts (id, role, created_at) VALUES ($1,'admin',$2)", [clientUid, new Date().toISOString()]);
  check("NE PEUT PAS se nommer admin", !seProclameAdmin.ok || seProclameAdmin.rows === 0);
  const { rows: autoAdmin } = await pool.query("SELECT role FROM admin_accounts WHERE id = $1", [clientUid]);
  check("  … et n'est pas devenu admin", autoAdmin.length === 0);

  /* ================= AUTHENTIFIÉ ADMINISTRATEUR ================= */
  console.log("\n— administrateur connecté —");
  await pool.query("INSERT INTO admin_accounts (id, role, full_name, created_at) VALUES ($1,'admin','Test',$2)", [adminUid, new Date().toISOString()]);

  const adminFlotte = await comme("authenticated", adminUid, "SELECT * FROM vehicles");
  check("lit toute la flotte, désactivés compris", adminFlotte.ok && adminFlotte.rows >= 2, `${adminFlotte.rows} ligne(s)`);

  const adminResa = await comme("authenticated", adminUid, "SELECT * FROM reservations");
  check("lit les réservations", adminResa.ok && adminResa.rows > 0, `${adminResa.rows} ligne(s)`);

  const adminClients = await comme("authenticated", adminUid, "SELECT * FROM clients");
  check("lit les clients", adminClients.ok && adminClients.rows > 0);

  const adminAjoute = await comme("authenticated", adminUid, "INSERT INTO clients (last_name, created_at, updated_at) VALUES ('Nouveau client','2026-01-01','2026-01-01')");
  check("ajoute un client", adminAjoute.ok && adminAjoute.rows === 1);

  const adminModifie = await comme("authenticated", adminUid, "UPDATE reservations SET status = 'confirmee' WHERE ref = 'RLS-TEST'");
  check("change un statut", adminModifie.ok && adminModifie.rows === 1);

  const adminAjouteVoiture = await comme("authenticated", adminUid, "INSERT INTO vehicles (slug,name,created_at,updated_at) VALUES ('rls-admin','Voiture admin',$1,$1)", [new Date().toISOString()]);
  check("ajoute un véhicule", adminAjouteVoiture.ok && adminAjouteVoiture.rows === 1);

  const adminSupprime = await comme("authenticated", adminUid, "DELETE FROM vehicles WHERE slug = 'rls-admin'");
  check("supprime un véhicule", adminSupprime.ok && adminSupprime.rows === 1);

  const sonProfil = await comme("authenticated", adminUid, "SELECT * FROM admin_accounts WHERE id = $1", [adminUid]);
  check("lit son propre profil", sonProfil.ok && sonProfil.rows === 1);

  const profil_autre = await comme("authenticated", clientUid, "SELECT * FROM admin_accounts WHERE id = $1", [adminUid]);
  check("NE LIT PAS le profil d'un autre", !profil_autre.ok || profil_autre.rows === 0);
} catch (e) {
  console.error("ERREUR DE TEST :", e.message);
  fail++;
} finally {
  await pool.query("DELETE FROM reservations WHERE ref LIKE 'RLS-%'").catch(() => {});
  await pool.query("DELETE FROM clients WHERE last_name LIKE 'Rls%' OR last_name IN ('Nouveau client','Faux')").catch(() => {});
  await pool.query("DELETE FROM vehicles WHERE slug LIKE 'rls-%'").catch(() => {});
  /* Uniquement les deux comptes créés par ce test : un DELETE global
     effacerait le vrai compte administrateur de l'agence. */
  await pool.query("DELETE FROM admin_accounts WHERE id = ANY($1::uuid[])", [[adminUid, clientUid]]).catch(() => {});
  await supprimerCompte(adminUid).catch(() => {});
  await supprimerCompte(clientUid).catch(() => {});
  console.log(`\n${pass} reussis, ${fail} echecs`);
  await pool.end();
}