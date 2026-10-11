/**
 * Remise à zéro de l'application : vide les dossiers, les clients et la flotte,
 * pour repartir d'une base propre à partager avec l'agence.
 *
 *   node scripts/reset-demo.mjs              -> sauvegarde et affiche ce qui
 *                                               serait supprimé, sans rien faire
 *   node scripts/reset-demo.mjs --confirm    -> sauvegarde puis purge
 *   node scripts/reset-demo.mjs --restore <dossier>
 *
 * Le compte administrateur et le fichier .env ne sont jamais touchés.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const SB = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BASE = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
/* Supabase refuse un DELETE sans corps quand le Content-Type est déclaré : on
   réserve l'en-tête JSON aux requêtes qui en ont vraiment un. */
const BASE_SANS_CORPS = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const objUrl = (chemin) => `${SB}/storage/v1/object/uploads/${chemin}`;
const COFFRE = "C:\\Users\\PC\\AppData\\Local\\Temp\\opencode\\sauvegardes-leegend";

/* Les tables sont purgées dans cet ordre : enfants d'abord, même si les clés
   étrangèresiraient déjà le faire. Le compte utilisateur reste en place. */
const TABLES = ["maintenance", "blocked_dates", "payments", "attachments", "reservations", "clients", "counters", "vehicles"];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const horodatage = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

async function lister(prefixe) {
  if (!SB || !KEY) return [];
  const r = await fetch(`${SB}/storage/v1/object/list/uploads`, {
    method: "POST", headers: BASE, body: JSON.stringify({ prefix: prefixe, limit: 1000 }),
  });
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

/* ------------------------------------------------------------------ sauvegarde */
async function sauvegarder() {
  const dossier = join(COFFRE, horodatage());
  mkdirSync(join(dossier, "fichiers"), { recursive: true });
  const vide = {};

  for (const table of [...TABLES, "users"]) {
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    vide[table] = rows;
    writeFileSync(join(dossier, `${table}.json`), JSON.stringify(rows, null, 2), "utf8");
  }

  /* Les fichiers du bucket sont recopiés localement : une fois le bucket vidé,
     la pièce d'identité d'un client ne serait plus récupérable nulle part.
     Un manifeste fait le lien entre le nom de sauvegarde et le chemin d'origine. */
  const manifeste = [];
  let fichiers = 0;
  if (SB && KEY) {
    for (const prefixe of ["uploads/reservations", "uploads"]) {
      for (const f of await lister(prefixe)) {
        const chemin = `${prefixe}/${f.name}`;
        if (!/\.(jpg|jpeg|png|webp|pdf)$/i.test(chemin)) continue; // un dossier, pas un fichier
        const r = await fetch(objUrl(chemin), { headers: BASE_SANS_CORPS });
        if (!r.ok) continue;
        const nomLocal = chemin.replace(/\//g, "__");
        writeFileSync(join(dossier, "fichiers", nomLocal), Buffer.from(await r.arrayBuffer()));
        manifeste.push({ fichier: nomLocal, chemin });
        fichiers++;
      }
    }
  }
  writeFileSync(join(dossier, "fichiers", "manifeste.json"), JSON.stringify(manifeste, null, 2), "utf8");

  writeFileSync(
    join(dossier, "LISEZ-MOI.txt"),
    [
      `Sauvegarde Leegend Cars — ${new Date().toLocaleString("fr-FR")}`,
      "",
      `${vide.users.length} compte(s) administrateur, ${vide.reservations.length} réservation(s),`,
      `${vide.clients.length} client(s), ${vide.vehicles.length} véhicule(s), ${fichiers} fichier(s).`,
      "",
      "Pour restaurer :",
      `  node scripts/reset-demo.mjs --restore "${dossier}"`,
      "",
      "Les fichiers sont dans le sous-dossier « fichiers » (le chemin d'origine",
      "est remonté à la place des « / »).",
    ].join("\n"),
    "utf8"
  );

  console.log(`Sauvegarde : ${dossier}`);
  return { dossier, vide, fichiers };
}

/* -------------------------------------------------------------------- purge */
async function purger() {
  await pool.query("BEGIN");
  try {
    for (const table of TABLES) await pool.query(`DELETE FROM ${table}`);
    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  let supprimes = 0;
  if (SB && KEY) {
    for (const prefixe of ["uploads/reservations", "uploads"]) {
      for (const f of await lister(prefixe)) {
        const chemin = `${prefixe}/${f.name}`;
        if (!/\.(jpg|jpeg|png|webp|pdf)$/i.test(chemin)) continue;
        const r = await fetch(objUrl(chemin), { method: "DELETE", headers: BASE_SANS_CORPS });
        if (r.ok) supprimes++;
        else console.error(`  ! suppression ${chemin} -> HTTP ${r.status}`);
      }
    }
  }
  return supprimes;
}

/* ------------------------------------------------------------------ restauration */
async function restaurer(dossier) {
  if (!existsSync(join(dossier, "reservations.json"))) {
    throw new Error(`Ce dossier ne ressemble pas à une sauvegarde : ${dossier}`);
  }
  const lire = (t) => JSON.parse(readFileSync(join(dossier, `${t}.json`), "utf8"));

  await pool.query("BEGIN");
  try {
    for (const table of TABLES) await pool.query(`DELETE FROM ${table}`);

    /* Les identifiants d'origine sont réinjectés : les règlements et pièces
       jointes rattachés aux réservations retrouvent leur dossier. */
    const compte = {};
    for (const table of ["clients", "vehicles", "reservations", "payments", "attachments", "maintenance", "blocked_dates", "counters"]) {
      const lignes = lire(table);
      compte[table] = lignes.length;
      for (const ligne of lignes) {
        const cols = Object.keys(ligne);
        const valeurs = cols.map((c) => ligne[c]);
        await pool.query(
          `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
          valeurs
        );
      }
      // Les séquences repartent après les identifiants restaurés.
      if (lignes.length) {
        await pool.query(
          `SELECT setval(pg_get_serial_sequence($1,'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`,
          [table]
        );
      }
    }
    await pool.query("COMMIT");
    console.log("Restauré :", JSON.stringify(compte));
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  let fichiers = 0;
  const dossierFichiers = join(dossier, "fichiers");
  const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" };
  if (SB && KEY && existsSync(join(dossierFichiers, "manifeste.json"))) {
    for (const entree of JSON.parse(readFileSync(join(dossierFichiers, "manifeste.json"), "utf8"))) {
      const source = join(dossierFichiers, entree.fichier);
      if (!existsSync(source)) continue;
      const ext = entree.fichier.slice(entree.fichier.lastIndexOf(".")).toLowerCase();
      const r = await fetch(objUrl(entree.chemin), {
        method: "POST",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": MIME[ext] || "application/octet-stream" },
        body: readFileSync(source),
      });
      if (r.ok) fichiers++;
      else console.error(`  ! ${entree.chemin} -> ${r.status}`);
    }
  }
  console.log(`Fichiers renvoyes dans le bucket : ${fichiers}`);
}

/* ------------------------------------------------------------------- programme */
const args = process.argv.slice(2);

try {
  if (args[0] === "--restore") {
    await restaurer(args[1]);
  } else {
    const { dossier, vide, fichiers } = await sauvegarder();
    console.log(`\nSauvegarde complete (${fichiers} fichier(s)).\n`);
    console.log("Ce qui sera supprime :");
    for (const t of TABLES) console.log(`  ${t.padEnd(15)} ${vide[t].length}`);
    console.log(`  ${"fichiers".padEnd(15)} ${fichiers} (dans le bucket)`);
    console.log(`\nCe qui est conserve :`);
    console.log(`  ${"users".padEnd(15)} ${vide.users.length} (compte admin)`);

    if (args.includes("--confirm")) {
      const supprimes = await purger();
      console.log(`\nPurge terminee : ${supprimes} fichier(s) supprime(s) du bucket.`);
      console.log(`Restauration possible depuis : ${dossier}`);
    } else {
      console.log("\nRien n'a ete supprime. Relance avec --confirm pour valider.");
    }
  }
} catch (e) {
  console.error("Echec :", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}