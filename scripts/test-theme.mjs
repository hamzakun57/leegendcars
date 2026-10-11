/* Verifie le bouton de theme : presence dans le HTML, CSS clair livre, et
   disparition des couleurs codees en dur qui ne marchaient qu'en sombre.
   Usage : npm run test:theme (le serveur doit tourner) */
import { readFileSync } from "node:fs";
import { adminShell, loginPage } from "../server/views.js";

let pass = 0, fail = 0;
const check = (n, ok, extra = "") => { console.log(`${ok ? "  OK  " : "ECHEC"} ${n}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

const css = readFileSync("server/public/admin.css", "utf8");
const shell = adminShell();
const login = loginPage(false);

/* --- presence du bouton --- */
for (const [nom, html] of [["back-office", shell], ["page de connexion", login]]) {
  check(`bouton dans le ${nom}`, /data-theme-toggle/.test(html));
  check(`script theme.js dans le ${nom}`, /\/admin-assets\/theme\.js/.test(html));
  check(`script charge dans <head> (avant le rendu)`, html.indexOf("theme.js") < html.indexOf("</head>"));
}

/* --- CSS clair --- */
check("bloc [data-theme=light] present", /\[data-theme="light"\]\s*\{/.test(css));
check("color-scheme bascule", /color-scheme:\s*dark/.test(css) && /color-scheme:\s*light/.test(css));
for (const v of ["--bg", "--panel", "--text", "--muted", "--line", "--red", "--green", "--amber", "--blue", "--shadow", "--overlay"]) {
  check(`variable ${v} redefinie en clair`, new RegExp(`\\[data-theme="light"\\][\\s\\S]*?${v}\\s*:`).test(css));
}
/* Le papier, lui, ne doit PAS basculer : on relit un document imprimé. */
const blocLight = css.slice(css.indexOf('[data-theme="light"]'), css.indexOf("/* ---"));
check("papier volontairement inchange en clair", !/--paper\s*:/.test(blocLight));

/* --- plus de blanc translucide en dur (survols, bordures, pastilles) --- */
const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
check("aucun fond blanc en dur", !/background:#ffffff[0-9a-f]{2}\b/i.test(sansCommentaires));
check("aucune bordure blanche en dur", !/border-color:#ffffff[0-9a-f]{2}\b/i.test(sansCommentaires));

/* --- le papier (contrat, signature) reste clair dans les deux themes --- */
check("apercu contrat sur papier", /\.doc\{[\s\S]*?var\(--paper\)/.test(css));
check("zone de signature sur papier", /\.sig-padbox\{[\s\S]*?var\(--paper\)/.test(css));
check("papier defini une seule fois", (css.match(/--paper:#fff/g) || []).length === 1);

/* --- le script de theme --- */
const js = readFileSync("server/public/theme.js", "utf8");
check("aucun eval ni innerHTML dans theme.js", !/eval\(|innerHTML/.test(js));
check("tolerant a un stockage indisponible", /catch/.test(js) && (js.match(/try/g) || []).length >= 3);
check("defaut sombre", /=== "clair" \? "clair" : "sombre"/.test(js));

/* --- routes servies --- */
const r = await fetch("http://127.0.0.1:3199/admin-assets/theme.js");
check("GET /admin-assets/theme.js", r.status === 200 && (await r.text()).includes("lc_theme"));
const c = await fetch("http://127.0.0.1:3199/admin-assets/admin.css");
check("GET admin.css", c.status === 200 && (await c.text()).includes('data-theme="light"'));

console.log(`\n${pass} reussis, ${fail} echecs`);
await import("../server/pg.js").then((m) => m.closeDb());