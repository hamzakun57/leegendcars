/**
 * Prépare le site pour un hébergement statique (Netlify).
 *
 *   1. empaquette le client Supabase dans un seul fichier local
 *   2. copie les ressources du back-office à la racine du site
 *   3. génère les deux pages d'administration à partir de server/views.js
 *
 * Les pages sont générées depuis la même source que le serveur Express : il
 * n'existe donc qu'une seule version de l'écran, et les deux modes
 * d'hébergement affichent exactement la même chose.
 */
import { build } from "esbuild";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { adminShell, loginPage } from "../server/views.js";

const here = dirname(fileURLToPath(import.meta.url));
const racine = join(here, "..");
const p = (...b) => join(racine, ...b);

/* ---------- 1. le client Supabase, en un seul fichier ---------- */
const resultat = await build({
  entryPoints: [p("assets", "js", "supabase-entry.js")],
  bundle: true,
  format: "iife",
  globalName: "SupabaseJS",
  target: ["es2020"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  outfile: p("assets", "vendor", "supabase.bundle.js"),
  define: { "process.env.NODE_ENV": '"production"' },
  metafile: true,
});
const ko = Math.round(Object.values(resultat.metafile.outputs)[0].bytes / 1024);
console.log(`assets/vendor/supabase.bundle.js — ${ko} Ko`);

/* ---------- 2. les ressources du back-office, à la racine du site ---------- */
await mkdir(p("admin-assets"), { recursive: true });
await mkdir(p("vendor"), { recursive: true });
for (const nom of ["admin.css", "admin.js", "admin-api.js", "admin-config.js", "theme.js", "login.js", "signature-pad.js"]) {
  await copyFile(p("server", "public", nom), p("admin-assets", nom));
}
for (const nom of ["doc-print.js", "sign-page.js"]) {
  await copyFile(p("server", "public", nom), p("admin-assets", nom));
}
await copyFile(p("assets", "vendor", "supabase.bundle.js"), p("vendor", "supabase.bundle.js"));
console.log("admin-assets/ et vendor/ à jour");

/* ---------- 3. les pages d'administration ---------- */
await mkdir(p("admin"), { recursive: true });
await writeFile(p("admin", "index.html"), adminShell(), "utf8");
await writeFile(p("admin", "login.html"), loginPage(false), "utf8");
console.log("admin/index.html et admin/login.html générés depuis server/views.js");

/* ---------- 4. les documents, pour les Edge Functions ---------- */
/* Les gabarits de contrat et de facture sont du JavaScript pur, sans API Node :
   ils tournent tels quels dans Deno. On les copie plutôt que de les dupliquer,
   pour qu'une retouche du modèle se retrouve partout. */
const partage = p("supabase", "functions", "_shared");
await mkdir(partage, { recursive: true });
for (const nom of ["company.js", "contract.js", "invoice.js"]) {
  await copyFile(p("server", nom), join(partage, nom));
}
console.log("supabase/functions/_shared/ : gabarits de documents copiés");
