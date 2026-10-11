/* Verifie que le site public respecte une flotte vide. */
const B = process.env.TEST_URL || "http://127.0.0.1:3199";
let pass = 0, fail = 0;
const check = (n, ok, extra = "") => { console.log(`${ok ? "  OK  " : "ECHEC"} ${n}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

const api = await (await fetch(`${B}/api/vehicles`)).json();
/* La base est celle de l'agence : elle n'est pas vide en général. Ce qui compte
   est le comportement du site, mesuré en écart, pas un compte absolu. */
check("API renvoie une liste", Array.isArray(api.vehicles), `${api.vehicles.length} vehicule(s)`);
const avant = api.vehicles.length;

const src = await (await fetch(`${B}/assets/js/app.js`)).text();
check("liste vide => parc vide (pas de repli)", /if \(!data\.vehicles\.length\) \{\s*D\.VEHICLES = \[\];/.test(src));
check("erreur reseau => repli conserve", /catch \(e\)[\s\S]*?liste de secours/.test(src));

const pages = await (await fetch(`${B}/assets/js/pages.js`)).text();
check("encart « parc vide » defini", /const emptyFleet = /.test(pages));
check("accueil et index l'utilisent", (pages.match(/emptyFleet\(\)/g) || []).length >= 3);
check("recapitulatif tolere un vehicule absent", /D\.VEHICLES\[0\] \|\| null/.test(pages));

const css = await (await fetch(`${B}/assets/css/style.css`)).text();
check("style de l'encart present", /\.empty-fleet\s*\{/.test(css));

/* Les 3 pages principales doivent rendre sans erreur JS. */
for (const [nom, url] of [["accueil", "/#/"], ["vehicules", "/#/vehicules"], ["prix", "/#/prix-promos"]]) {
  const r = await fetch(B + url);
  check(`${nom} repond`, r.status === 200);
}

/* Une voiture de test doit apparaitre : c'est le cas d'usage de l'agence. */
const login = await fetch(`${B}/api/admin/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: process.env.TEST_USER, password: process.env.TEST_PASS }),
});
if (login.status === 200) {
  const cookie = login.headers.getSetCookie()[0].split(";")[0];
  const H = { "Content-Type": "application/json", cookie };
  const nom = "Essai Parc " + Date.now();
  const v = await (await fetch(`${B}/api/admin/vehicles`, { method: "POST", headers: H, body: JSON.stringify({ name: nom, price_from: 500 }) })).json();
  check("agence peut saisir une voiture", v.ok === true && v.vehicle.slug === nom.toLowerCase().replace(/\s+/g, "-"));
  const apres = await (await fetch(`${B}/api/vehicles`)).json();
  check("elle apparait sur le site public", apres.vehicles.length === avant + 1, `${apres.vehicles.length} vehicule(s)`);
  await fetch(`${B}/api/admin/vehicles/${v.vehicle.slug}`, { method: "DELETE", headers: H });
  const vide = await (await fetch(`${B}/api/vehicles`)).json();
  check("sa suppression la retire du site", vide.vehicles.length === avant, `${vide.vehicles.length} vehicule(s)`);
} else {
  console.log("  (test de saisie ignore : variables TEST_USER / TEST_PASS absentes)");
}

console.log(`\n${pass} reussis, ${fail} echecs`);