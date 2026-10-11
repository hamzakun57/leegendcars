/**
 * Retire du bucket les fichiers laissés par des exécutions de test
 * interrompues : le PNG 1x1 de 70 octets des scripts, et tout fichier qui
 * n'est plus référencé ni en base ni dans une galerie de véhicule.
 */
const SB = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const lister = async (prefixe) => {
  const r = await fetch(`${SB}/storage/v1/object/list/uploads`, {
    method: "POST", headers: base, body: JSON.stringify({ prefix: prefixe, limit: 1000 }),
  });
  const j = await r.json();
  return Array.isArray(j) ? j : [];
};

const used = new Set();
for (const a of (await (await fetch(`${SB}/rest/v1/attachments?select=stored_name`, { headers: base })).json()))
  used.add(`uploads/reservations/${a.stored_name.replace(/^.*\//, "")}`);
for (const v of (await (await fetch(`${SB}/rest/v1/vehicles?select=gallery`, { headers: base })).json())) {
  for (const g of JSON.parse(v.gallery || "[]")) if (typeof g === "string" && g.startsWith("uploads/")) used.add(g);
}

let supprimes = 0;
for (const prefixe of ["uploads/reservations", "uploads"]) {
  for (const f of await lister(prefixe)) {
    const nom = String(f.name || "");
    if (!/\.(jpg|jpeg|png|webp|pdf)$/i.test(nom)) continue; // un dossier
    const chemin = `${prefixe}/${nom}`;
    if (used.has(chemin)) continue;
    /* DELETE sans corps : pas de Content-Type, sinon Supabase répond 400. */
    const r = await fetch(`${SB}/storage/v1/object/uploads/${chemin}`, {
      method: "DELETE",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (r.ok) {
      supprimes++;
      console.log("supprime :", chemin, `(${(f.metadata && f.metadata.size) || "?"} o)`);
    } else {
      console.log("ECHEC    :", chemin, r.status, (await r.text()).slice(0, 60));
    }
  }
}
console.log(supprimes ? `\n${supprimes} fichier(s) orphelin(s) supprime(s).` : "Aucun fichier orphelin.");