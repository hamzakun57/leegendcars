/**
 * Prépare le site pour un hébergement statique (Netlify).
 *
 *   1. copie le client Supabase en un seul fichier local
 *   2. copie les ressources du back-office à la racine du site
 *   3. génère les deux pages d'administration à partir de server/views.js
 *   4. copie les gabarits de documents pour les Edge Functions
 *
 * Aucun empaquetage, aucune dépendance de build : la version officielle déjà
 * publiée par Supabase est un fichier unique qui s'expose dans la page
 * (`window.supabase`). Rien à compiler, donc rien qui puisse échouer sur
 * l'hébergeur.
 *
 * Les pages d'administration viennent de server/views.js — la même source que
 * le serveur Express : il n'existe qu'une seule version de l'écran.
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { adminShell, loginPage } from "../server/views.js";

const here = dirname(fileURLToPath(import.meta.url));
const racine = join(here, "..");
const p = (...b) => join(racine, ...b);

/* ---------- 1. le client Supabase ---------- */
await mkdir(p("vendor"), { recursive: true });
await copyFile(
  p("node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js"),
  p("vendor", "supabase.js")
);
console.log("vendor/supabase.js — client officiel, copié tel quel");

/* ---------- 2. les ressources du back-office ---------- */
await mkdir(p("admin-assets"), { recursive: true });
for (const nom of ["admin.css", "admin.js", "admin-api.js", "admin-config.js", "theme.js", "login.js", "signature-pad.js", "doc-print.js", "sign-page.js"]) {
  await copyFile(p("server", "public", nom), p("admin-assets", nom));
}
console.log("admin-assets/ — ressources du back-office");

/* ---------- 3. les pages d'administration ---------- */
await mkdir(p("admin"), { recursive: true });
await writeFile(p("admin", "index.html"), adminShell(), "utf8");
await writeFile(p("admin", "login.html"), loginPage(false), "utf8");
console.log("admin/index.html et admin/login.html générés depuis server/views.js");

/* ---------- 4. les gabarits pour les Edge Functions ---------- */
/* Du JavaScript pur, sans API Node : ils tournent tels quels dans Deno. On les
   copie plutôt que de les dupliquer, pour qu'une retouche du modèle se
   retrouve partout. */
const partage = p("supabase", "functions", "_shared");
await mkdir(partage, { recursive: true });
for (const nom of ["company.js", "contract.js", "invoice.js"]) {
  await copyFile(p("server", nom), join(partage, nom));
}
console.log("supabase/functions/_shared/ — gabarits de documents copiés");
