import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { api } from "./api.js";
import { attachUser, needsSetup, requireAdminPage } from "./auth.js";
import { contractHtml } from "./contract.js";
import { db, getDossier, getReservationBySignatureToken, getVehicle, isDossierOpen, saveSignature } from "./db.js";
import { signPageHtml } from "./signature.js";
import { adminShell, loginPage } from "./views.js";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const app = express();
app.disable("x-powered-by");
app.locals.db = db;

/* Les photos arrivent en base64 dans le JSON. Ce parseur doit passer AVANT le
   parseur global, sinon une photo de plusieurs Mo serait rejetée en 413.
   body-parser ignore ensuite le corps, déjà décodé (req._body). */
app.use("/api/admin/vehicles", express.json({ limit: "30mb" }));
/* Les pièces jointes partent en base64 dans le JSON (max 15 Mo par fichier) :
   elles Passent très vite au-dessus de la limite générale de 128 ko. */
app.use(/^\/api\/admin\/reservations\/\d+\/attachments$/, express.json({ limit: "25mb" }));
app.use(/^\/api\/admin\/reservations\/\d+\/signature$/, express.json({ limit: "2mb" }));
app.use(/^\/sign\/[\w-]+$/, express.json({ limit: "2mb" }));
app.use(express.json({ limit: "128kb" }));

/* Security headers. The CSP allows only self-hosted assets; Google Fonts is the one external origin. */
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join("; ")
  );
  next();
});

app.use(attachUser);

/* ---------- API ---------- */
app.use("/api", api);

/* ---------- admin UI ---------- */
app.get("/admin-assets/login.js", (_req, res) => res.sendFile(join(here, "public", "login.js")));
app.get("/admin-assets/admin.js", (_req, res) => res.sendFile(join(here, "public", "admin.js")));
app.get("/admin-assets/admin.css", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.type("text/css").sendFile(join(here, "public", "admin.css"));
});
app.get("/admin-assets/signature-pad.js", (_req, res) => res.sendFile(join(here, "public", "signature-pad.js")));
app.get("/doc-assets/doc-print.js", (_req, res) => res.sendFile(join(here, "public", "doc-print.js")));
app.get("/doc-assets/signature-pad.js", (_req, res) => res.sendFile(join(here, "public", "signature-pad.js")));
app.get("/doc-assets/sign-page.js", (_req, res) => res.sendFile(join(here, "public", "sign-page.js")));

/* ---------- signature client (lien public, protégé par jeton) ---------- */
app.get("/sign/:token/contrat", (req, res) => {
  const r = getReservationBySignatureToken(req.params.token);
  if (!r) return res.status(404).type("text/plain").send("Lien de signature introuvable ou expiré.");
  if (!isDossierOpen(r)) {
    return res.status(410).type("text/plain").send("Ce contrat n'est plus ouvert à la signature.");
  }
  const vehicle = r.vehicle_slug ? getVehicle(r.vehicle_slug) : null;
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(contractHtml(getDossier(r.id), vehicle, { toolbar: false }));
});

app.get("/sign/:token", (req, res) => {
  const r = getReservationBySignatureToken(req.params.token);
  if (!r) return res.status(404).type("text/plain").send("Lien de signature introuvable ou expiré.");
  if (!isDossierOpen(r)) {
    return res.status(410).type("text/plain").send("Ce contrat n'est plus ouvert à la signature.");
  }
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(signPageHtml(getDossier(r.id), req.params.token));
});

app.post("/sign/:token", (req, res) => {
  const r = getReservationBySignatureToken(req.params.token);
  if (!r) return res.status(404).json({ error: "Lien de signature introuvable ou expiré." });
  if (!isDossierOpen(r)) {
    return res.status(410).json({ error: "Ce contrat n'est plus ouvert à la signature." });
  }
  const signature = String(req.body?.signature || "");
  const name = String(req.body?.name || "").trim().slice(0, 120);
  if (!name) return res.status(400).json({ error: "Merci d'indiquer votre nom complet." });
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length > 2_000_000) {
    return res.status(400).json({ error: "Signature invalide." });
  }
  /* Le jeton est conservé : le client peut ainsi relire son contrat signé. */
  saveSignature(r.id, { data: signature, name, mode: "remote", keepToken: true });
  res.json({ ok: true });
});

app.get("/admin/login", (req, res) => {
  if (req.user) return res.redirect("/admin");
  res.send(loginPage(needsSetup()));
});

app.get("/admin", requireAdminPage, (_req, res) => res.send(adminShell()));

/* ---------- public site (static) ---------- */
/* Only the site itself is public. Everything under server/, node_modules/ and the
   package files must stay unreachable, or the SQLite database (and therefore the
   admin password hash) would be downloadable. */
const PRIVATE = [
  /^\/server(\/|$)/i,
  /^\/node_modules(\/|$)/i,
  /^\/package(-lock)?\.json$/i,
  /^\/\.git(\/|$)/i,
  /^\/\.env/i,
];

app.use((req, res, next) => {
  const p = decodeURIComponent(req.path);
  if (PRIVATE.some((re) => re.test(p))) {
    return res.status(404).json({ error: "Introuvable" });
  }
  next();
});

app.use(
  express.static(ROOT, {
    extensions: ["html"],
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-cache");
    },
  })
);

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/admin")) {
    return res.status(404).json({ error: "Introuvable" });
  }
  res.status(404).sendFile(join(ROOT, "index.html"));
});

/* ---------- error handler ----------
   Sans ceci, Express renvoie une page HTML contenant la stack trace et les
   chemins de fichiers, même en production. */
app.use((err, req, res, _next) => {
  const isApi = req.path.startsWith("/api/");
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Fichier trop volumineux (15 Mo par pièce, 25 Mo par envoi)." });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Requête invalide." });
  }
  console.error("[erreur]", req.method, req.path, "-", err?.message);
  if (isApi) return res.status(500).json({ error: "Erreur serveur." });
  res.status(500).type("text/plain").send("Erreur serveur.");
});

/* ---------- start ---------- */
const checkEnv = () => {
  if (!process.env.SESSION_SECRET) {
    console.warn(
      "\n  ⚠  SESSION_SECRET absent — génération d'une clé temporaire (les sessions seront invalidées au redémarrage).\n" +
      "     Pour un déploiement, définissez SESSION_SECRET dans l'environnement.\n"
    );
    process.env.SESSION_SECRET = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
};

if (process.argv[1] && existsSync(process.argv[1])) {
  checkEnv();
  app.listen(PORT, HOST, () => {
    const base = `http://${HOST}:${PORT}`;
    console.log(`\n  Leegend Cars`);
    console.log(`  ─────────────────────────────────`);
    console.log(`  Site      ${base}/`);
    console.log(`  Admin     ${base}/admin`);
    if (needsSetup()) console.log(`\n  ⚠  Première connexion : créez le compte admin sur ${base}/admin\n`);
    else console.log(`  Connexion : ${base}/admin/login\n`);
  });
}

export default app;