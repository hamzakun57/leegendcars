/**
 * Vérifie que le site public lit et écrit dans Supabase en direct, sans
 * passer par le serveur Express — exactement comme le fera la version
 * déployée sur Netlify.
 *
 * Les fichiers réellement livrés sont chargés dans un navigateur simulé, puis
 * toute la scénario est exécuté à l'intérieur de cette fenêtre : c'est le
 * seul contexte fidèle à ce que fera un visiteur.
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const check = (n, ok, extra = "") => { console.log(`${ok ? "  OK  " : "ECHEC"} ${n}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

const SB = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = (chemin, opts = {}) =>
  fetch(`${SB}/rest/v1/${chemin}`, {
    ...opts,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });

const dom = new JSDOM(readFileSync("index.html", "utf8"), {
  url: "https://leegendcars.netlify.app/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const w = dom.window;
w.fetch = globalThis.fetch;
w.console = console;

/* Un véhicule de travail, pour que le scénario ait de la matière. */
const VEHICULE = "essai-client-direct";
await admin(`vehicles?slug=eq.${VEHICULE}`, { method: "DELETE" });
await admin("vehicles", {
  method: "POST",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify({
    slug: VEHICULE, name: "Essai Direct", tagline: "Automatique", transmission: "Automatique",
    fuel: "Essence", doors: 5, seats: 5, price_from: 500, deposit: 5000, approx: 50,
    tiers: [{ days: 7, price: 400 }], gallery: "[]", description: "[]", ideal_for: "[]",
    active: 1, en_service: 1, sort_order: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }),
});

try {
  /* Même ordre de chargement que index.html. */
  for (const f of ["vendor/supabase.js", "assets/js/icons.js", "assets/js/data.js", "assets/js/data-source.js"]) {
    w.eval(readFileSync(f, "utf8"));
  }

  check("window.DATA exposé", !!w.DATA && !!w.DATA.CFG);
  check("client Supabase embarqueé", typeof w.supabase?.createClient === "function");
  check("LCData présent", !!w.LCData);
  check("mode « supabase » (aucun serveur requis)", w.LCData?.mode === "supabase", w.LCData?.mode);

  /* Aucune clé secrète ne doitFuivre dans un fichier servi au navigateur. */
  for (const f of ["assets/js/data.js", "assets/js/data-source.js", "index.html", "vendor/supabase.js"]) {
    check(`pas de clé service_role dans ${f}`, !readFileSync(f, "utf8").includes(KEY));
  }
  check("le bundle n'expose qu'un client public", !readFileSync("vendor/supabase.js", "utf8").includes("service_role"));

  /* Le scénario s'exécute dans la fenêtre : même contexte qu'un visiteur. */
  const resultat = await w.eval(`
    (async () => {
      const out = [];
      const note = (nom, ok, extra) => out.push({ nom, ok, extra: extra || "" });

      try {
        const flotte = await window.LCData.vehicles();
        note("lecture de la flotte", Array.isArray(flotte.vehicles), flotte.vehicles.length + " vehicule(s)");
        const v = flotte.vehicles[0];
        note("forme publique (camelCase)", !!v && v.priceFrom !== undefined && Array.isArray(v.gallery) && Array.isArray(v.tiers));

        const p = await window.LCData.pricing({ vehicle: v.slug, from: "2026-11-02", to: "2026-11-09", babySeat: 0 });
        note("tarif sur 7 jours", p.days === 7 && p.total > 0, p.days + " j, " + p.total + " MAD");
        note("tarif dégressif applique", p.daily === 400, p.daily + " MAD/jour (au lieu de " + v.priceFrom + ")");

        const siege = await window.LCData.pricing({ vehicle: v.slug, from: "2026-11-02", to: "2026-11-09", babySeat: 2 });
        note("siege bebe facture", siege.total === p.total + 2 * p.days, siege.total + " MAD");

        const res = await window.LCData.envoyerReservation({
          firstName: "Navigateur", lastName: "Direct", phone: "+212612345678",
          licenceNumber: "AB123456", licenceDate: "2015-04-01",
          pickup: "Tanger", ret: "Tanger",
          pickupDate: "2026-12-01", returnDate: "2026-12-05",
          pickupTime: "10:00", returnTime: "10:00",
          countryCode: "+212", babySeat: 0, vehicleSlug: v.slug,
        });
        note("demande acceptee", res.ok === true && /^LC-/.test(res.ref || ""), res.ref || res.error);
        note("totaux renvoyes", res.days === 4 && res.total === 2000, res.days + " j, " + res.total + " MAD");
        window.__ref = res.ref;

        const mauvais = await window.LCData.envoyerReservation({ firstName: "", lastName: "X" });
        note("formulaire incomplet refuse", mauvais.ok === false && mauvais.fields.includes("firstName"), (mauvais.fields || []).join(","));
      } catch (e) {
        note("erreur inattendue", false, e.message);
      }
      return out;
    })()
  `);

  for (const r of resultat) check(r.nom, r.ok, r.extra);

  /* Ce que la base a réellement retenu, lu hors RLS avec la clé de service. */
  const ref = w.__ref;
  if (ref) {
    const r = await admin(`reservations?ref=eq.${ref}&select=*`);
    const [ligne] = await r.json();
    check("demande bien enregistree", !!ligne, ref);
    check("statut force a « nouvelle »", ligne?.status === "nouvelle", ligne?.status);
    check("total calcule (4 j x 500)", ligne?.total === 2000, String(ligne?.total));
    check("aucun encaissement invente", ligne?.total_paid === 0, String(ligne?.total_paid));
    check("aucun numero de contrat", !ligne?.contract_number, ligne?.contract_number);
    check("aucune signature", !ligne?.signature_data);
    check("resume lisible", String(ligne?.summary || "").includes("Navigateur Direct"));
    await admin(`reservations?ref=eq.${ref}`, { method: "DELETE" });
  }

  /* Et la preuve que le visiteur ne peut pas relire sa demande. */
  if (ref) {
    const anon = process.env.SUPABASE_ANON_KEY;
    const tentative = await fetch(`${SB}/rest/v1/reservations?ref=eq.${ref}`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    const lu = await tentative.text();
    check("le visiteur ne peut pas relire sa demande", lu === "[]", lu.slice(0, 40));
  }
} catch (e) {
  check("erreur de test", false, e.message);
} finally {
  await admin(`vehicles?slug=eq.${VEHICULE}`, { method: "DELETE" });
  await admin(`reservations?ref=like.LC-*&created_by=eq.`, { method: "DELETE" });
}

console.log(`\n${pass} reussis, ${fail} echecs`);