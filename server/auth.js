import crypto from "node:crypto";
import { countUsers, createUser, getUser } from "./db.js";

const COOKIE = "lc_admin";
const MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12h

/* ---------- password hashing (scrypt) ---------- */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, key] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

/* ---------- signed session cookie ---------- */
function secret() {
  if (!process.env.SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET manquant. Génère-en un avec : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return process.env.SESSION_SECRET;
}

const b64 = (buf) => Buffer.from(buf).toString("base64url");

export function issueToken(username) {
  const payload = b64(JSON.stringify({ u: username, exp: Date.now() + MAX_AGE_MS }));
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function setSessionCookie(res, username) {
  res.cookie(COOKIE, issueToken(username), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: "/" });
}

/* ---------- middleware ---------- */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export async function attachUser(req, _res, next) {
  req.user = null;
  try {
    const data = readToken(parseCookies(req.headers.cookie)[COOKIE]);
    if (data && (await getUser(data.u))) req.user = { username: data.u };
  } catch {
    /* base injoignable : on laisse passer en anonyme plutôt que de bloquer tout le site */
  }
  next();
}

/** Guard for the JSON API only (mounted under /api). Always answers 401 JSON.
    HTML pages use requireAdminPage below, which redirects to the login form. */
export function requireAdmin(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ error: "Non autorisé" });
}

/** Guard for HTML admin pages: sends a browser to the login form instead of JSON. */
export function requireAdminPage(req, res, next) {
  if (req.user) return next();
  return res.redirect("/admin/login");
}

/* ---------- first-run setup ---------- */
export const needsSetup = async () => (await countUsers()) === 0;

export async function setupAdmin(username, password) {
  if (await needsSetup()) return createUser(username, hashPassword(password));
  throw new Error("Un administrateur existe déjà.");
}