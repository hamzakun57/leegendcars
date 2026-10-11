/* Tests de la page Maintenance (vignette, assurance, vidange…).
   Crée ses propres entrées et les supprime : aucune donnée réelle n'est touchée.
   Usage : npm run test:maintenance (le serveur doit tourner sur TEST_URL) */
import { hashPassword } from "../server/auth.js";
import { createUser, deleteUser } from "../server/db.js";
import { closeDb, query } from "../server/pg.js";

const B = process.env.TEST_URL || "http://127.0.0.1:3199";
const USER = "verif_mnt";
let pass = 0, fail = 0;
const check = (n, ok, extra = "") => { console.log(`${ok ? "  OK  " : "ECHEC"} ${n}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

await createUser(USER, hashPassword("temp-test-1234"));
const r = await fetch(`${B}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: USER, password: "temp-test-1234" }) });
const cookie = r.headers.getSetCookie()[0].split(";")[0];
const H = { "Content-Type": "application/json", cookie };
const call = async (m, p, b) => {
  const res = await fetch(B + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const jours = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const slug = (await (await fetch(B + "/api/vehicles")).json()).vehicles[0].slug;
const crees = [];

try {
  check("GET maintenance sans session", (await fetch(B + "/api/admin/maintenance")).status === 401);

  const vide = await call("GET", "/api/admin/maintenance");
  check("liste vide au depart", vide.data.items.length === 0);
  check("types proposes", vide.data.kinds.length === 9 && vide.data.kinds.some((k) => k.id === "vidange"), vide.data.kinds.map((k) => k.id).join(","));
  check("compteurs a zero", vide.data.compte.retard === 0 && vide.data.compte.ok === 0);

  /* --- creation --- */
  const vignette = await call("POST", "/api/admin/maintenance", { vehicle_slug: slug, kind: "vignette", due_date: jours(-12) });
  check("POST vignette (echue)", vignette.status === 201 && vignette.data.item.statut === "retard", `dans ${vignette.data.item?.jours} j`);
  check("cycle par defaut = 365 j", vignette.data.item.period_days === 365);
  crees.push(vignette.data.item.id);

  const vidange = await call("POST", "/api/admin/maintenance", { vehicle_slug: slug, kind: "vidange", due_date: jours(10) });
  check("POST vidange (bientot)", vidange.data.item.statut === "bientot" && vidange.data.item.period_days === 180);
  crees.push(vidange.data.item.id);

  const loiere = await call("POST", "/api/admin/maintenance", { vehicle_slug: slug, kind: "vidange", due_date: jours(200) });
  check("POST vidange (ok)", loiere.data.item.statut === "ok", `dans ${loiere.data.item?.jours} j`);
  crees.push(loiere.data.item.id);

  const perso = await call("POST", "/api/admin/maintenance", { vehicle_slug: slug, kind: "Bretelle Revised", due_date: jours(30) });
  check("type personnalise normalise", perso.data.item.kind === "bretelle-revised", perso.data.item?.kind);
  check("type inconnu = cycle 0", perso.data.item.period_days === 0);
  crees.push(perso.data.item.id);

  check("vehicule inconnu refuse", (await call("POST", "/api/admin/maintenance", { vehicle_slug: "inexistant", kind: "vidange", due_date: jours(1) })).status === 422);
  check("date invalide refusee", (await call("POST", "/api/admin/maintenance", { vehicle_slug: slug, kind: "vidange", due_date: "2026-02-30" })).status === 422);

  /* --- tri : les plus urgentes d'abord --- */
  const liste = await call("GET", "/api/admin/maintenance");
  const ordre = liste.data.items.map((m) => m.jours);
  check("tri par echeance", ordre.every((j, i) => i === 0 || ordre[i - 1] <= j), ordre.join(" < "));
  check("compteurs", liste.data.compte.retard === 1 && liste.data.compte.bientot === 2 && liste.data.compte.ok === 1, JSON.stringify(liste.data.compte));

  /* --- marquage « Fait » : la date se met a jour, l'echeance est reprogrammee --- */
  const fait = await call("POST", `/api/admin/maintenance/${vidange.data.item.id}/done`, { cost: 850, km: 130000 });
  const attendu = jours(180);
  check("POST done", fait.status === 200);
  check("date du jour enregistree", fait.data.item.last_done_at === jours(0), fait.data.item?.last_done_at);
  check("cout memorise", fait.data.item.last_cost === 850);
  check("kilometrage memorise", fait.data.item.last_km === 130000);
  check("echeance reprogrammee +180 j", fait.data.item.due_date === attendu, `${fait.data.item?.due_date} (attendu ${attendu})`);
  check("statut repasse a ok", fait.data.item.statut === "ok");

  /* Une echeance sans cycle ne bouge pas : c'est la vignette de l'an dernier. */
  const sansCycle = await call("POST", "/api/admin/maintenance", { vehicle_slug: slug, kind: "autre", due_date: jours(-5), period_days: 0 });
  await call("POST", `/api/admin/maintenance/${sansCycle.data.item.id}/done`, { cost: 0 });
  check("cycle 0 : echeance inchangee", sansCycle.data.item.due_date === jours(-5), sansCycle.data.item?.due_date);
  crees.push(sansCycle.data.item.id);

  /* --- modification --- */
  const maj = await call("PATCH", `/api/admin/maintenance/${loiere.data.item.id}`, { due_date: jours(-3) });
  check("PATCH echeance", maj.data.item.statut === "retard" && maj.data.item.jours === -3);
  check("PATCH date invalide refuse", (await call("PATCH", `/api/admin/maintenance/${loiere.data.item.id}`, { due_date: "boum" })).status === 422);
  check("PATCH entree inconnue", (await call("PATCH", "/api/admin/maintenance/999999", { due_date: jours(1) })).status === 404);

  /* --- filtres --- */
  const total = (await call("GET", "/api/admin/maintenance")).data.items.length;
  const parVeh = await call("GET", `/api/admin/maintenance?vehicle=${slug}`);
  check("filtre vehicule", parVeh.data.items.length === total, `${parVeh.data.items.length}/${total}`);
  const parKind = await call("GET", "/api/admin/maintenance?kind=vidange");
  check("filtre type", parKind.data.items.every((m) => m.kind === "vidange") && parKind.data.items.length === 2, `${parKind.data.items.length} resultats`);
  const parLesDeux = await call("GET", `/api/admin/maintenance?vehicle=${slug}&kind=vidange`);
  check("filtre combine", parLesDeux.data.items.length === 2, `${parLesDeux.data.items.length} resultats`);
  const parRien = await call("GET", "/api/admin/maintenance?kind=inconnu");
  check("filtre sans resultat", Array.isArray(parRien.data.items) && parRien.data.items.length === 0);

  /* --- suppression --- */
  check("DELETE", (await call("DELETE", `/api/admin/maintenance/${perso.data.item.id}`)).status === 200);
  check("entree supprimee", (await call("GET", "/api/admin/maintenance")).data.items.every((m) => m.id !== perso.data.item.id));

  /* --- la suppression d'un vehicule emporte ses suivis --- */
  const vtest = await call("POST", "/api/admin/vehicles", { name: "Essai MNT " + Date.now(), price_from: 100 });
  await call("POST", "/api/admin/maintenance", { vehicle_slug: vtest.data.vehicle.slug, kind: "vignette", due_date: jours(30) });
  await call("DELETE", "/api/admin/vehicles/" + vtest.data.vehicle.slug);
  const apres = await call("GET", "/api/admin/maintenance");
  check("suivis supprimes avec le vehicule", apres.data.items.every((m) => m.vehicle_slug !== vtest.data.vehicle.slug));
} finally {
  for (const id of crees) await call("DELETE", `/api/admin/maintenance/${id}`);
  await query("delete from maintenance where vehicle_slug in (select slug from vehicles where name like 'Essai MNT%')");
  await query("DELETE FROM users WHERE username = $1", [USER]);
  const reste = await query("select count(*)::int AS n FROM maintenance");
  console.log(`\n${pass} reussis, ${fail} echecs | suivis restants : ${reste.rows[0].n}`);
  await closeDb();
}