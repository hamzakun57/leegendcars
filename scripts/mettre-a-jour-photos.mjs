/* Repart d'un stockage propre :
   1. les photos restées dans l'ancien bucket privé sont déplacées vers le
      bucket public, et les véhicules mis à jour (le site ne pouvait pas les
      servir) ;
   2. les objets de test orphelins sont supprimés. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SB = process.env.SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = readFileSync("assets/js/data.js", "utf8").split("supabaseAnonKey: ")[1].split(",")[0].replace(/"/g, "").trim();
const admin = createClient(SB, K, { auth: { persistSession: false } });
const entetes = { apikey: K, Authorization: "Bearer " + K };

const { data: session } = await createClient(SB, ANON, { auth: { persistSession: false } })
  .auth.signInWithPassword({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASS });

const deplacer = async (ancien) => {
  const nom = String(ancien).split("/").pop();
  const telecharger = await fetch(`${SB}/storage/v1/object/uploads/uploads/${nom}`, { headers: entetes });
  if (!telecharger.ok) return null;
  const octets = new Uint8Array(await telecharger.arrayBuffer());
  const cible = `${SB}/storage/v1/object/photos/photos/${nom}`;
  const envoi = await fetch(cible, {
    method: "POST",
    headers: { ...entetes, "Content-Type": "image/jpeg", "x-upsert": "true" },
    body: octets,
  });
  if (!envoi.ok) return null;
  await fetch(`${SB}/storage/v1/object/uploads/uploads/${nom}`, { method: "DELETE", headers: entetes });
  return `https://dqygspzmndcsbkxeiulm.supabase.co/storage/v1/object/public/photos/photos/${nom}`;
};

const vehicules = await admin.from("vehicles").select("slug, gallery");
for (const v of vehicules.data || []) {
  let galerie;
  try { galerie = JSON.parse(v.gallery || "[]"); } catch { galerie = []; }
  const nouvelle = [];
  for (const ancien of galerie) {
    if (String(ancien).startsWith("http")) { nouvelle.push(ancien); continue; }
    const deplace = await deplacer(ancien);
    if (deplace) nouvelle.push(deplace);
  }
  if (nouvelle.length !== galerie.length || nouvelle.some((n, i) => n !== galerie[i])) {
    await admin.from("vehicles").update({ gallery: JSON.stringify(nouvelle) }).eq("slug", v.slug);
    console.log(`${v.slug} : ${galerie.length} photo(s) -> ${nouvelle.length}`);
  }
}

/* Suppression des objets de test qui ne sont référencés par aucun véhicule. */
const referenced = new Set();
for (const v of (await admin.from("vehicles").select("gallery")).data || []) {
  for (const p of JSON.parse(v.gallery || "[]")) if (p.startsWith("http")) referenced.add(p.split("/").pop());
}
const liste = await fetch(`${SB}/storage/v1/object/list/photos`, {
  method: "POST", headers: { ...entetes, "Content-Type": "application/json" },
  body: JSON.stringify({ prefix: "photos/", limit: 500 }),
}).then((r) => r.json());

let supprimes = 0;
for (const o of Array.isArray(liste) ? liste : []) {
  if (o.name === "photos" || referenced.has(o.name)) continue;
  const r = await fetch(`${SB}/storage/v1/object/photos/photos/${o.name}`, { method: "DELETE", headers: entetes });
  if (r.ok) supprimes++;
}
console.log(`\n${supprimes} photo(s) de test supprimée(s)`);

const reste = await fetch(`${SB}/storage/v1/object/list/photos`, {
  method: "POST", headers: { ...entetes, "Content-Type": "application/json" },
  body: JSON.stringify({ prefix: "photos/", limit: 500 }),
}).then((r) => r.json());
console.log("bucket photos :", JSON.stringify((reste || []).map((o) => o.name)));