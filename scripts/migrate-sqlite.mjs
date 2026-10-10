/**
 * Migre les données de l'ancien serveur vers Supabase.
 *
 *   npm run migrate:sqlite              -> refuse de s'exécuter si la base cible
 *                                          contient déjà des données
 *   npm run migrate:sqlite -- --force   -> vide les tables cibles d'abord
 *
 * Tout est repris : comptes, flotte, fiches clients, dossiers, règlements,
 * signatures, compteurs. Les fichiers de uploads/ sont envoyés dans le bucket
 * « uploads » avec exactement le même chemin, pour que les liens déjà stockés
 * en base et dans l'admin continuent de fonctionner.
 */
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const SQLITE_PATH = join(ROOT, "server", "data", "leegend.db");
const UPLOAD_DIR = join(ROOT, "uploads");

const force = process.argv.includes("--force");

/* L'ordre suit les clés étrangères : un dossier doit exister avant son règlement. */
const TABLES = [
  "users", "vehicles", "clients", "reservations", "payments", "attachments",
  "blocked_dates", "counters",
];

if (!existsSync(SQLITE_PATH)) {
  console.error("Base SQLite introuvable :", SQLITE_PATH);
  process.exit(1);
}

const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const pgColumns = async (table) => {
  const { rows } = await pool.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
    [table]
  );
  return rows.map((r) => r.column_name);
};

const alreadyThere = async () => {
  const { rows } = await pool.query("select count(*)::int as n from reservations");
  const { rows: v } = await pool.query("select count(*)::int as n from vehicles");
  return rows[0].n + v[0].n;
};

const client = await pool.connect();
try {
  const existing = await alreadyThere();
  if (existing > 0 && !force) {
    console.error(
      `La base Supabase contient déjà ${existing} ligne(s) (réservations + véhicules).\n` +
        "Relance avec --force pour tout remplacer, ou vide les tables à la main."
    );
    process.exitCode = 1;
  } else {
    if (existing > 0) {
      console.log("Vidage des tables cibles (--force)…");
      await client.query(
        "TRUNCATE payments, attachments, blocked_dates, reservations, clients, vehicles, users, counters RESTART IDENTITY CASCADE"
      );
    }

    await client.query("BEGIN");

    let total = 0;
    for (const table of TABLES) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      if (!rows.length) {
        console.log(`  ${table.padEnd(14)} 0`);
        continue;
      }
      const target = new Set(await pgColumns(table));
      const cols = Object.keys(rows[0]).filter((c) => target.has(c));
      if (!cols.length) continue;

      // PGSQL n'accepte pas plus de 65535 paramètres par requête : on découpe.
      const CHUNK = Math.max(1, Math.floor(60000 / cols.length));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const values = [];
        const tuples = slice.map((row, r) => {
          const marks = cols.map((c, ci) => {
            values.push(row[c] === undefined ? null : row[c]);
            return `$${r * cols.length + ci + 1}`;
          });
          return `(${marks.join(", ")})`;
        });
        await client.query(
          `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${tuples.join(", ")}`,
          values
        );
      }
      total += rows.length;
      console.log(`  ${table.padEnd(14)} ${rows.length}`);
    }

    await client.query("COMMIT");

    // Les identifiants viennent de SQLite : on recale les séquences PostgreSQL
    // sur le maximum réellement importé, sinon le prochain INSERT se heurte à la
    // clé primaire.
    for (const table of ["users", "blocked_dates", "reservations", "payments", "attachments", "clients"]) {
      await client.query(
        `SELECT setval(
           pg_get_serial_sequence($1, 'id'),
           COALESCE((SELECT MAX(id) FROM ${table}), 1),
           (SELECT MAX(id) FROM ${table}) IS NOT NULL
         )`,
        [table]
      );
    }
    console.log(`\n${total} ligne(s) migree(s) vers Supabase.`);
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Echec de la migration :", e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
  sqlite.close();
}

/* ---------- fichiers ---------- */
const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SB_URL || !SB_KEY || process.exitCode) {
  console.log("\nFichiers : ignores (Supabase Storage non configure).");
} else {
  const walk = async (dir) => {
    const out = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await walk(full)));
      else out.push(full);
    }
    return out;
  };

  if (existsSync(UPLOAD_DIR)) {
    const files = await walk(UPLOAD_DIR);
    const MIME = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" };
    let ok = 0, ko = 0;
    for (const file of files) {
      const key = "uploads/" + relative(UPLOAD_DIR, file).split(sep).join("/");
      const mime = MIME[file.slice(file.lastIndexOf(".")).toLowerCase()] || "application/octet-stream";
      const r = await fetch(
        `${SB_URL}/storage/v1/object/uploads/${key.split("/").map(encodeURIComponent).join("/")}`,
        { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": mime }, body: readFileSync(file) }
      );
      if (r.ok) ok++;
      else {
        ko++;
        console.error(`  ! ${key} -> ${r.status}`);
      }
    }
    console.log(`\nFichiers : ${ok} envoye(s), ${ko} en erreur.`);
  } else {
    console.log("\nFichiers : aucun dossier uploads/ a envoyer.");
  }
}