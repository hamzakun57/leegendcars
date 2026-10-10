/* Test de bout en bout contre la vraie base Supabase.
   Crée un compte, un véhicule et des réservations temporaires, exerce toutes
   les routes, puis supprime tout ce qu'il a créé. */
import { randomBytes } from "node:crypto";
import { hashPassword } from "../server/auth.js";
import { createUser, deleteUser } from "../server/db.js";
import { closeDb, query } from "../server/pg.js";

const B = process.env.TEST_URL || "http://127.0.0.1:3199";
const H = { "Content-Type": "application/json" };
const TAG = randomBytes(3).toString("hex");
const USER = "test_" + TAG;
const PASS = "temp-test-1234";
const VOITURE = "test-voiture-" + TAG;

let cookie = "";
let pass = 0, fail = 0;
const aNettoyer = [];

const check = (name, ok, extra = "") => {
  console.log(`${ok ? "  OK  " : "ECHEC"} ${name}${extra ? " — " + extra : ""}`);
  ok ? pass++ : fail++;
};

const req = async (method, path, body, auth = true) => {
  const headers = { ...H };
  if (auth && cookie) headers.cookie = cookie;
  const r = await fetch(B + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.getSetCookie?.()[0];
  if (set) cookie = set.split(";")[0];
  return r;
};
const json = async (r) => { try { return await r.json(); } catch { return {}; } };

/* petit PNG 1x1 */
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

await createUser(USER, hashPassword(PASS));

try {
  /* ---------- public ---------- */
  const v = await json(await req("GET", "/api/vehicles", null, false));
  check("GET /api/vehicles", Array.isArray(v.vehicles) && v.vehicles.length > 0, `${v.vehicles?.length} vehicules`);
  const slug = v.vehicles[0].slug;
  check("forme publique (camelCase)", v.vehicles[0].priceFrom !== undefined && Array.isArray(v.vehicles[0].gallery));

  const prix = await json(await req("GET", `/api/pricing?vehicle=${slug}&from=2026-11-02&to=2026-11-09&babySeat=0`, null, false));
  check("GET /api/pricing", prix.days === 7 && prix.total > 0, `${prix.days} j, ${prix.total} MAD`);

  const resa = await req("POST", "/api/reservations", {
    firstName: "Test", lastName: "Public " + TAG, phone: "+212612345678", licenceNumber: "AB123456",
    licenceDate: "2015-04-01", pickup: "Tanger", ret: "Tanger",
    pickupDate: "2026-11-02", returnDate: "2026-11-09", pickupTime: "10:00", returnTime: "10:00",
    vehicleSlug: slug, countryCode: "+212", babySeat: 0,
  }, false);
  const body = await json(resa);
  check("POST /api/reservations", resa.status === 201 && /^LC-/.test(body.ref || ""), body.ref);
  if (body.ref) aNettoyer.push(["DELETE /api/reservations/" + body.ref, "DELETE FROM reservations WHERE ref = $1", [body.ref]]);

  const invalide = await req("POST", "/api/reservations", { firstName: "", lastName: "X" }, false);
  check("POST /api/reservations (invalide -> 422)", invalide.status === 422);

  /* ---------- session ---------- */
  check("POST /api/admin/login", (await req("POST", "/api/admin/login", { username: USER, password: PASS })).status === 200);
  check("login refuse (401)", (await req("POST", "/api/admin/login", { username: USER, password: "faux" })).status === 401);
  check("route admin protegee (401)", (await fetch(B + "/api/admin/stats")).status === 401);

  const avant = await json(await req("GET", "/api/admin/stats"));
  check("GET /api/admin/stats", typeof avant.total === "number" && avant.vehicles === v.vehicles.length, JSON.stringify(avant));

  /* ---------- réservations ---------- */
  const liste = await json(await req("GET", "/api/admin/reservations"));
  check("GET /api/admin/reservations", liste.reservations.length === avant.total, `${liste.reservations.length} lignes`);
  const filtre = await json(await req("GET", "/api/admin/reservations?status=confirmee"));
  check("filtre par statut", filtre.reservations.every((r) => r.status === "confirmee"), `${filtre.reservations.length} confirmees`);
  const recherche = await json(await req("GET", "/api/admin/reservations?q=kaissouni"));
  check("recherche insensible a la casse", recherche.reservations.length === 3, `${recherche.reservations.length} resultats`);

  /* Une réservation qui nous appartient : le test ne doit jamais modifier un
     dossier réel, sinon chaque exécution abîme les données du client. */
  const manuelle = await json(await req("POST", "/api/admin/reservations", {
    first_name: "Yassine", last_name: "Agent " + TAG, phone: "+212611111111", licence_number: "ZZ1",
    licence_date: "2020-01-01", pickup: "Casablanca", ret: "Rabat",
    pickup_date: "2026-12-01", return_date: "2026-12-05", vehicle_slug: slug, status: "confirmee",
  }));
  check("POST reservation manuelle", manuelle.ok && manuelle.days === 4 && manuelle.reservation.created_by === USER);
  const cible = manuelle.reservation;
  if (cible?.ref) aNettoyer.push(["reservation de test " + cible.ref, "DELETE FROM reservations WHERE ref = $1", [cible.ref]]);

  /* ---------- dossier ---------- */
  const confirme = await json(await req("PATCH", `/api/admin/reservations/${cible.id}`, { status: "confirmee", kms_depart: 100, kms_return: 350, d1_cin: "AB123", insurance: "Premium" }));
  check("PATCH dossier", confirme.ok && confirme.reservation.status === "confirmee");
  check("km calcules", confirme.reservation.kmDone === 250, `kmDone=${confirme.reservation.kmDone}`);
  check("total_paid derive des reglements", typeof confirme.reservation.totalPaid === "number");
  const annulee = await json(await req("PATCH", `/api/admin/reservations/${cible.id}`, { status: "annulee" }));
  check("statut annulee", annulee.reservation.status === "annulee");
  await req("PATCH", `/api/admin/reservations/${cible.id}`, { status: "confirmee" });

  /* ---------- règlements ---------- */
  const pay = await json(await req("POST", `/api/admin/reservations/${cible.id}/payments`, { amount: 500, method: "cb", note: "acompte" }));
  check("POST reglement", pay.ok && pay.reservation.totalPaid === 500, `verse=${pay.reservation?.totalPaid}`);
  check("reste calcule", pay.reservation.reste === pay.reservation.totalTTC - 500);
  check("DELETE reglement", (await req("DELETE", `/api/admin/payments/${pay.payments[0].id}`)).status === 200);

  /* ---------- pièces jointes ---------- */
  const att = await json(await req("POST", `/api/admin/reservations/${cible.id}/attachments`, { kind: "permis", name: "permis.png", files: [PNG] }));
  check("POST piece jointe", att.ok && att.attachments.length >= 1, att.attachments?.[0]?.stored_name);
  const stored = att.attachments[0].stored_name;
  const dl = await fetch(`${B}/uploads/reservations/${stored}`);
  check("lecture /uploads/… depuis le stockage", dl.status === 200 && dl.headers.get("content-type") === "image/png", `HTTP ${dl.status} ${dl.headers.get("content-type")}`);
  check("DELETE piece jointe", (await req("DELETE", `/api/admin/attachments/${att.attachments[0].id}`)).status === 200);
  check("fichier supprime du stockage", (await fetch(`${B}/uploads/reservations/${stored}`)).status === 404);

  /* ---------- contrat / facture ---------- */
  const ctr = await req("GET", `/api/admin/reservations/${cible.id}/contract`);
  const html = await ctr.text();
  check("GET contrat", ctr.status === 200 && html.includes("Contrat"), `${html.length} octets`);
  const apres = await json(await req("GET", `/api/admin/reservations/${cible.id}`));
  check("n° de contrat = reference", apres.reservation.contract_number === apres.reservation.ref, apres.reservation.contract_number);

  const fac = await req("GET", `/api/admin/reservations/${cible.id}/invoice`);
  const fhtml = await fac.text();
  const numero = (fhtml.match(/F\d{4}-\d{4}/) || [])[0];
  check("GET facture", fac.status === 200 && !!numero, numero);
  const f2 = await req("GET", `/api/admin/reservations/${cible.id}/invoice`);
  check("numero de facture stable", (await f2.text()).includes(numero));

  /* ---------- signature ---------- */
  const lien = await json(await req("POST", `/api/admin/reservations/${cible.id}/signature/link`));
  check("POST lien signature", !!lien.token, lien.token?.slice(0, 12) + "…");
  check("GET page de signature", (await fetch(`${B}/sign/${lien.token}`)).status === 200);
  const sign = await fetch(`${B}/sign/${lien.token}`, { method: "POST", headers: H, body: JSON.stringify({ name: "Hamza Test", signature: PNG }) });
  check("POST signature", sign.status === 200);
  const dossier = await json(await req("GET", `/api/admin/reservations/${cible.id}`));
  check("signature enregistree", dossier.reservation.signatureSigned === true && dossier.reservation.signatureMode === "remote");
  check("DELETE signature", (await req("DELETE", `/api/admin/reservations/${cible.id}/signature`)).status === 200);

  /* ---------- clients ---------- */
  const cl = await json(await req("POST", "/api/admin/clients", { last_name: "Test" + TAG, first_name: "Ali", phone: "+212600000000", cin: "BK1234", birthdate: "1990-05-02" }));
  check("POST client", cl.ok && cl.client.full_name === "Ali Test" + TAG, cl.client?.full_name);
  aNettoyer.push(["client " + cl.client?.id, "DELETE FROM clients WHERE id = $1", [cl.client.id]]);
  check("PATCH client", (await json(await req("PATCH", `/api/admin/clients/${cl.client.id}`, { email: "ali@test.ma" }))).client.email === "ali@test.ma");
  check("recherche clients", (await json(await req("GET", `/api/admin/clients?q=test${TAG}`))).clients.length === 1);
  check("DELETE client", (await req("DELETE", `/api/admin/clients/${cl.client.id}`)).status === 200);

  /* ---------- véhicules ---------- */
  const nv = await json(await req("POST", "/api/admin/vehicles", { name: "Test Voiture " + TAG, price_from: 350, photos: [PNG] }));
  check("POST vehicule (slug auto)", nv.ok && nv.vehicle.slug === VOITURE, nv.vehicle?.slug);
  check("photo stockee", nv.vehicle?.gallery?.[0]?.startsWith("uploads/"), nv.vehicle?.gallery?.[0]);
  const photo = nv.vehicle?.gallery?.[0];
  const upMaj = await json(await req("PUT", `/api/admin/vehicles/${VOITURE}`, { price_from: 400, keepPhotos: [photo] }));
  check("PUT vehicule", upMaj.vehicle?.price_from === 400 && upMaj.vehicle?.gallery?.length === 1);
  const renomme = await json(await req("PUT", `/api/admin/vehicles/${VOITURE}`, { slug: VOITURE + "-b" }));
  check("renommage du slug", renomme.vehicle?.slug === VOITURE + "-b", renomme.vehicle?.slug);
  const nouveauSlug = renomme.vehicle?.slug || VOITURE + "-b";
  aNettoyer.push(["vehicule " + nouveauSlug, "DELETE FROM vehicles WHERE slug = $1", [nouveauSlug]]);

  /* ---------- disponibilités ---------- */
  const dispo = await json(await req("POST", "/api/admin/blocked", { vehicle_slug: slug, start_date: "2027-01-05", end_date: "2027-01-10", reason: "test" }));
  check("POST indisponibilite", dispo.ok && dispo.id > 0);
  check("GET indisponibilites", (await json(await req("GET", `/api/admin/blocked?vehicle=${slug}`))).blocked.length === 1);
  check("prix indisponible", (await json(await req("GET", `/api/pricing?vehicle=${slug}&from=2027-01-06&to=2027-01-08`, null, false))).available === false);
  check("DELETE indisponibilite", (await req("DELETE", `/api/admin/blocked/${dispo.id}`)).status === 200);

  /* ---------- mot de passe ---------- */
  check("POST changement de mot de passe", (await req("POST", "/api/admin/password", { current: PASS, next: "nouveau-mdp-123" })).status === 200);

  /* ---------- pages ---------- */
  for (const [path, attendu] of [["/", 200], ["/admin/login", 200], ["/admin-assets/admin.css", 200], ["/server/db.js", 404], ["/.env", 404]]) {
    const r = await fetch(B + path, { redirect: "manual" });
    check(`GET ${path} -> ${attendu}`, r.status === attendu, `recu ${r.status}`);
  }
} finally {
  await fetch(B + "/api/admin/logout", { method: "POST" });
  for (const [nom, sql, params] of aNettoyer) {
    await query(sql, params).catch((e) => console.log(`  ! nettoyage ${nom} : ${e.message}`));
  }
  await query("DELETE FROM users WHERE username = $1", [USER]);

  /* Les essais consomment des numéros de facture : on rebat le compteur sur la
     dernière facture réellement attribuée, sinon la numérotation saute. */
  const max = await query(
    `select coalesce(max(nullif(regexp_replace(invoice_number, '^F(\\d{4})-', ''), '')::int), 0) as n
       from reservations where invoice_number <> ''`
  );
  await query("update counters set value = $1 where name = 'invoice:' || extract(year from now())", [max.rows[0].n]);

  const reste = await query("SELECT count(*)::int AS n FROM users");
  console.log(`\n${pass} reussis, ${fail} echecs | comptes restants : ${reste.rows[0].n} | compteur facture : ${max.rows[0].n}`);
  await closeDb();
}