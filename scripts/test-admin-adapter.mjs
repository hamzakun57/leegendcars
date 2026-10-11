/**
 * Comparaison des deux chemins d'accès au back-office.
 *
 * La même opération est exécutée deux fois :
 *   - via le serveur Express (/api/admin/…)
 *   - via l'adaptateur Supabase, dans un navigateur simulé
 *
 * Puis on compare la FORME des réponses (clés et types, récursivement). Si une
 * clé disparaît ou change de type, l'écran affichera autre chose : ce test
 * l'attrape avant la mise en ligne.
 *
 * Usage : npm run test:adapter
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { hashPassword } from "../server/auth.js";
import { createUser, deleteUser } from "../server/db.js";
import { closeDb } from "../server/pg.js";

const B = process.env.TEST_URL || "http://127.0.0.1:3199";
const EMAIL = process.env.ADMIN_EMAIL;
const PASS = process.env.ADMIN_PASS;
/* Le serveur Express garde son ancien mécanisme d'authentification : on lui
   crée un compte éphémère pour la comparaison. */
const VIEUX = "adapter_" + Date.now().toString(36);
const VIEUX_PASS = "ancien-mot-de-passe-123";

let pass = 0, fail = 0;
const check = (nom, ok, extra = "") => { console.log(`${ok ? "  OK  " : "ECHEC"} ${nom}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

/* ---------- signature de forme ---------- */
function forme(valeur, chemin = "", profondeur = 0) {
  if (profondeur > 4) return [];
  if (valeur === null) return [`${chemin}:null`];
  if (Array.isArray(valeur)) {
    if (!valeur.length) return [`${chemin}:array-vide`];
    return [`${chemin}:array`, ...forme(valeur[0], `${chemin}[]`, profondeur + 1)];
  }
  if (typeof valeur === "object") {
    const sortie = [`${chemin}:objet`];
    for (const cle of Object.keys(valeur).sort()) {
      sortie.push(...forme(valeur[cle], chemin ? `${chemin}.${cle}` : cle, profondeur + 1));
    }
    return sortie;
  }
  return [`${chemin}:${typeof valeur}`];
}

const comparer = (a, b) => {
  const fa = forme(a).sort();
  const fb = forme(b).sort();
  const manquants = fa.filter((x) => !fb.includes(x));
  const enTrop = fb.filter((x) => !fa.includes(x));
  return { ok: manquants.length === 0 && enTrop.length === 0, manquants, enTrop };
};

if (!EMAIL || !PASS) {
  console.log("(variables ADMIN_EMAIL / ADMIN_PASS absentes : test ignoré)");
  process.exit(0);
}

await createUser(VIEUX, hashPassword(VIEUX_PASS));

/* ---------- session côté serveur Express ---------- */
let cookieServeur = "";
{
  const r = await fetch(`${B}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: VIEUX, password: VIEUX_PASS }),
  });
  cookieServeur = r.headers.getSetCookie?.()[0]?.split(";")[0] || "";
}

/* ---------- session côté navigateur simulé ---------- */
const dom = new JSDOM("<html></html>", { url: "https://leegendcars.netlify.app/admin", runScripts: "outside-only" });
const w = dom.window;
w.fetch = globalThis.fetch;
w.console = console;
/* JSDOM ne sait pas naviguer et fournit déjà un localStorage : on n'y touche
   pas, le test s'en sert comme un vrai navigateur. */
for (const f of ["vendor/supabase.js", "server/public/admin-config.js", "server/public/admin-api.js"]) {
  w.eval(readFileSync(f, "utf8"));
}
check("adaptateur présent", !!w.LCAdmin);
check("mode « supabase »", w.LCAdmin?.mode === "supabase", w.LCAdmin?.mode);

/* Déclaré hors du bloc d'essai : le finally doit pouvoir nettoyer même si le
   test échoue avant la création du véhicule de travail. */
let voitureCreee = null;

try {
  /* Connexion : elle seule passe par l'adaptateur (le serveur a son ancien
     mécanisme, volontairement conservé). */
  const connexion = await w.eval(`window.LCAdmin.api("/api/admin/login", { method: "POST", body: { email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)} } })`);
  check("connexion administrateur", connexion && connexion.ok === true);

  const moi = await fetch(`${B}/api/admin/me`, { headers: { cookie: cookieServeur } }).then((r) => r.json());
  const moiAdaptateur = await w.eval(`window.LCAdmin.api("/api/admin/me")`);
  check("GET /api/admin/me : un compte est reconnu", !!moi.user && !!moiAdaptateur.user);
  check("GET /api/admin/me : même forme", comparer(moi, moiAdaptateur).ok,
    JSON.stringify(comparer(moi, moiAdaptateur).enTrop).slice(0, 120));

  const requetes = [
    ["/api/admin/stats", "tableau de bord"],
    ["/api/admin/reservations?limit=50", "liste des réservations"],
    ["/api/admin/vehicles", "flotte"],
    ["/api/admin/clients", "clients"],
    ["/api/admin/blocked", "indisponibilités"],
    ["/api/admin/maintenance", "maintenance"],
    ["/api/admin/stats/vehicles", "rendement par voiture"],
  ];

  for (const [chemin, libelle] of requetes) {
    const ancien = await fetch(B + chemin, { headers: { cookie: cookieServeur } }).then((r) => r.json());
    const nouveau = await w.eval(`window.LCAdmin.api(${JSON.stringify(chemin)})`);
    const ecart = comparer(ancien, nouveau);
    check(`${libelle} — même forme`, ecart.ok,
      ecart.ok ? "" : "manque " + JSON.stringify(ecart.manquants.slice(0, 4)) + " en trop " + JSON.stringify(ecart.enTrop.slice(0, 4)));
  }

  /* Le dossier complet est le plus riche : totaux, règlements, pièces,
     signature. Il faut une vraie réservation pour l'exercer — on en crée une
     par l'API du serveur (donc avec toutes les valeurs possibles), on compare,
     puis on la supprime. */
  const brut = await fetch(`${B}/api/admin/vehicles`, { headers: { cookie: cookieServeur } });
  const flotte = await brut.json();
  /* Déclaré ici : le finally doit pouvoir le nettoyer même si le test échoue
     avant la création de la réservation. */
  let nomVoiture = flotte.vehicles && flotte.vehicles[0] ? flotte.vehicles[0].slug : null;
  if (!nomVoiture) {
    const r = await fetch(`${B}/api/admin/vehicles`, {
      method: "POST",
      headers: { cookie: cookieServeur, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Adaptateur ${Date.now()}`, price_from: 500 }),
    });
    voitureCreee = (await r.json()).vehicle.slug;
    nomVoiture = voitureCreee;
  }
  const creation = await fetch(`${B}/api/admin/reservations`, {
    method: "POST",
    headers: { cookie: cookieServeur, "Content-Type": "application/json" },
    body: JSON.stringify({
      first_name: "Comparaison", last_name: "Formes", phone: "+212600000000",
      licence_number: "ZZ999", licence_date: "2020-01-01",
      pickup: "Tanger", ret: "Rabat", pickup_date: "2026-11-02", return_date: "2026-11-09",
      vehicle_slug: nomVoiture, status: "confirmee",
      kms_depart: 100, kms_return: 350, d1_cin: "AB123", insurance: "Premium",
    }),
  }).then((r) => r.json());

  if (creation.ok) {
    const id = creation.reservation.id;
    /* Un règlement : le dossier doit exposer « payments » et « totalPaid ». */
    await fetch(`${B}/api/admin/reservations/${id}/payments`, {
      method: "POST",
      headers: { cookie: cookieServeur, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 500, method: "cb" }),
    });

    const ancienDossier = await fetch(`${B}/api/admin/reservations/${id}`, { headers: { cookie: cookieServeur } }).then((r) => r.json());
    const nouveauDossier = await w.eval(`window.LCAdmin.api("/api/admin/reservations/${id}")`);
    const ecart = comparer(ancienDossier, nouveauDossier);
    check("dossier complet — même forme", ecart.ok, ecart.ok ? "" : "manque " + JSON.stringify(ecart.manquants.slice(0, 8)));

    /* Et les valeurs calculées doivent être identiques, pas seulement la forme :
       un dossier qui affiche « reste dû » faux est un bug visible. */
    const a = ancienDossier.reservation, n = nouveauDossier.reservation;
    for (const champ of ["totalTTC", "totalPaid", "reste", "kmDone", "dossierOpen", "paymentModeLabel", "insurance", "contractNumber"]) {
      check(`dossier — ${champ} identique`, JSON.stringify(a[champ]) === JSON.stringify(n[champ]), `${JSON.stringify(a[champ])} vs ${JSON.stringify(n[champ])}`);
    }

    /* Une mise à jour doit produire le même dossier des deux côtés. */
    const ancienApres = await fetch(`${B}/api/admin/reservations/${id}`, {
      method: "PATCH", headers: { cookie: cookieServeur, "Content-Type": "application/json" },
      body: JSON.stringify({ kms_depart: 10, kms_return: 90, internal_notes: "comparaison" }),
    }).then((r) => r.json());
    const nouveauApres = await w.eval(`window.LCAdmin.api("/api/admin/reservations/${id}", { method: "PATCH", body: { kms_depart: 10, kms_return: 90, internal_notes: "comparaison" } })`);
    check("PATCH dossier — même forme", comparer(ancienApres.reservation, nouveauApres.reservation).ok,
      JSON.stringify(comparer(ancienApres.reservation, nouveauApres.reservation).manquants.slice(0, 5)));
    check("PATCH dossier — km identique", ancienApres.reservation.kmDone === nouveauApres.reservation.kmDone, `${ancienApres.reservation.kmDone} vs ${nouveauApres.reservation.kmDone}`);

    /* Création d'un véhicule par l'écran d'édition, avec un corps objet : c'est
       exactement ce que fait admin.js. Le test passa par l'API du serveur, il
       ne verrait donc jamais une régression de l'adaptateur sur cette route —
       celle qui a produit « [object Object] is not valid JSON » à l'écran. */
    const fiche = { name: `Saisie ${Date.now()}`, price_from: 750, deposit: 5000, transmission: "Automatique", gallery: [] };
    const ficheServeur = await fetch(`${B}/api/admin/vehicles`, {
      method: "POST", headers: { cookie: cookieServeur, "Content-Type": "application/json" },
      body: JSON.stringify(fiche),
    }).then((r) => r.json());
    /* Même nom des deux côtés : on libère d'abord le slug pris par le
       serveur, puis on rejoue la création à l'identique via l'adaptateur. */
    await fetch(`${B}/api/admin/vehicles/${ficheServeur.vehicle.slug}`, { method: "DELETE", headers: { cookie: cookieServeur } });
    const ficheAdaptateur = await w.eval(
      `window.LCAdmin.api("/api/admin/vehicles", { method: "POST", body: ${JSON.stringify(fiche)} })`,
    );
    check("création véhicule — corps objet accepté", !!ficheAdaptateur.vehicle, JSON.stringify(ficheAdaptateur).slice(0, 120));
    check("création véhicule — mêmes champs", comparer(ficheServeur.vehicle, ficheAdaptateur.vehicle).ok,
      JSON.stringify(comparer(ficheServeur.vehicle, ficheAdaptateur.vehicle).enTrop.slice(0, 5)));

    /* Un véhicule sans photo ne doit produire ni « undefined » ni image cassée. */
    check("création véhicule — galerie vide acceptée",
      Array.isArray(ficheAdaptateur.vehicle.gallery) && ficheAdaptateur.vehicle.gallery.length === 0,
      JSON.stringify(ficheAdaptateur.vehicle.gallery));

    await w.eval(`window.LCAdmin.api("/api/admin/vehicles/${ficheAdaptateur.vehicle.slug}", { method: "DELETE" })`).catch(() => {});
    await fetch(`${B}/api/admin/vehicles/${ficheServeur.vehicle.slug}`, { method: "DELETE", headers: { cookie: cookieServeur } }).catch(() => {});

    await fetch(`${B}/api/admin/reservations/${id}`, { method: "DELETE", headers: { cookie: cookieServeur } });
  } else {
    check("dossier complet — comparé", false, JSON.stringify(creation).slice(0, 120));
  }
} catch (e) {
  check("erreur inattendue", false, e.message);
} finally {
  /* La voiture de travail n'est créée que si le parc est vide : sans ce
     nettoyage, chaque passage laissait un véhicule « Adaptateur <date> » dans
     la base de l'agence. */
  if (voitureCreee) {
    await fetch(`${B}/api/admin/vehicles/${voitureCreee}`, { method: "DELETE", headers: { cookie: cookieServeur } }).catch(() => {});
  }
  await deleteUser(VIEUX).catch(() => {});
  console.log(`\n${pass} reussis, ${fail} echecs`);
  await closeDb();
}
