import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(here, "data", "leegend.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  tagline      TEXT DEFAULT '',
  transmission TEXT DEFAULT '',
  fuel         TEXT DEFAULT '',
  doors        INTEGER DEFAULT 5,
  seats        INTEGER DEFAULT 5,
  price_from   INTEGER NOT NULL DEFAULT 0,
  deposit      INTEGER NOT NULL DEFAULT 0,
  approx       INTEGER DEFAULT 0,
  badge        TEXT DEFAULT '',
  accent       TEXT DEFAULT '',
  description  TEXT DEFAULT '[]',
  ideal_for    TEXT DEFAULT '[]',
  gallery      TEXT DEFAULT '[]',
  tiers        TEXT DEFAULT '[]',
  active       INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_slug TEXT NOT NULL REFERENCES vehicles(slug) ON DELETE CASCADE,
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  reason       TEXT DEFAULT '',
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ref           TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'nouvelle',
  vehicle_slug  TEXT DEFAULT '',
  vehicle_name  TEXT DEFAULT '',
  first_name    TEXT DEFAULT '',
  last_name     TEXT DEFAULT '',
  country_code  TEXT DEFAULT '',
  phone         TEXT DEFAULT '',
  licence_number TEXT DEFAULT '',
  licence_date  TEXT DEFAULT '',
  passport      TEXT DEFAULT '',
  pickup        TEXT DEFAULT '',
  ret           TEXT DEFAULT '',
  pickup_date   TEXT DEFAULT '',
  pickup_time   TEXT DEFAULT '',
  return_date   TEXT DEFAULT '',
  return_time   TEXT DEFAULT '',
  baby_seat     INTEGER NOT NULL DEFAULT 0,
  one_way       INTEGER NOT NULL DEFAULT 0,
  days          INTEGER NOT NULL DEFAULT 0,
  daily         INTEGER NOT NULL DEFAULT 0,
  seat_total    INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  notes         TEXT DEFAULT '',
  summary       TEXT DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_res_status  ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_res_created ON reservations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocked    ON blocked_dates(vehicle_slug, start_date);
`);

export const now = () => new Date().toISOString();

/* Toute date stockée passe par ici : format AAAA-MM-JJ *et* existence réelle
   dans le calendrier (2026-02-30 est refusé). Retourne la date normalisée, ou
   une chaîne vide si la valeur est inexploitable. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoOrEmpty = (v) => {
  const s = String(v ?? "").trim().slice(0, 10);
  if (!ISO_DATE.test(s)) return "";
  const d = new Date(s + "T00:00:00");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s ? s : "";
};
/* Les champs dont le nom se termine par « date » (ou « birthdate »). */
const DATE_FIELD = /(?:_date|birthdate)$/;

/* ---------- migrations ----------
   SQLite has no "ADD COLUMN IF NOT EXISTS"; on an existing file we compare the
   real columns with the ones we expect and add only what is missing. */
const VEHICLE_MIGRATIONS = [
  ["modele", "TEXT DEFAULT ''"],
  ["matricule_ww", "TEXT DEFAULT ''"],
  ["matricule", "TEXT DEFAULT ''"],
  ["couleur", "TEXT DEFAULT ''"],
  ["kilometrage", "INTEGER DEFAULT 0"],
  ["puissance_fiscale", "INTEGER DEFAULT 0"],
  ["energie", "TEXT DEFAULT ''"],
  ["climatisation", "TEXT DEFAULT ''"],
  ["categorie", "TEXT DEFAULT ''"],
  ["date_circulation", "TEXT DEFAULT ''"],
  ["en_service", "INTEGER NOT NULL DEFAULT 1"],
];

function migrateVehicles() {
  const cols = db.prepare("PRAGMA table_info(vehicles)").all().map((c) => c.name);
  const added = [];
  for (const [name, def] of VEHICLE_MIGRATIONS) {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE vehicles ADD COLUMN ${name} ${def}`);
      added.push(name);
    }
  }
  return added;
}

const RESERVATION_MIGRATIONS = [
  ["created_by", "TEXT DEFAULT ''"],
  /* Fiche client rattachée (facultatif) : la réservation garde les coordonnées
     copiées, la fiche sert de répertoire pour retrouver le conducteur. */
  ["client_id", "INTEGER DEFAULT 0"],
  ["commercial", "TEXT DEFAULT ''"],
  ["agency", "TEXT DEFAULT ''"],
  ["kms_depart", "INTEGER DEFAULT 0"],
  ["kms_return", "INTEGER DEFAULT 0"],
  ["distance_km", "INTEGER DEFAULT 0"],
  ["delivery_type", "TEXT DEFAULT ''"],
  ["extra_fee_label", "TEXT DEFAULT ''"],
  ["extra_fee", "INTEGER NOT NULL DEFAULT 0"],
  ["total_paid", "INTEGER NOT NULL DEFAULT 0"],
  ["confirmed_at", "TEXT DEFAULT ''"],
  ["driver2_first_name", "TEXT DEFAULT ''"],
  ["driver2_last_name", "TEXT DEFAULT ''"],
  ["driver2_phone", "TEXT DEFAULT ''"],
  ["driver2_licence", "TEXT DEFAULT ''"],
  ["driver2_licence_date", "TEXT DEFAULT ''"],
  ["internal_notes", "TEXT DEFAULT ''"],
];

function migrateReservations() {
  const cols = db.prepare("PRAGMA table_info(reservations)").all().map((c) => c.name);
  const added = [];
  for (const [name, def] of RESERVATION_MIGRATIONS) {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE reservations ADD COLUMN ${name} ${def}`);
      added.push(name);
    }
  }
  return added;
}

const CONTRACT_MIGRATIONS = [
  // identité du 1er conducteur
  ["d1_birthdate", "TEXT DEFAULT ''"],
  ["d1_nationality", "TEXT DEFAULT ''"],
  ["d1_address", "TEXT DEFAULT ''"],
  ["d1_cin", "TEXT DEFAULT ''"],
  ["d1_cin_date", "TEXT DEFAULT ''"],
  ["d1_passport_date", "TEXT DEFAULT ''"],
  // identité du 2ème conducteur
  ["driver2_birthdate", "TEXT DEFAULT ''"],
  ["driver2_nationality", "TEXT DEFAULT ''"],
  ["driver2_address", "TEXT DEFAULT ''"],
  ["driver2_cin", "TEXT DEFAULT ''"],
  ["driver2_cin_date", "TEXT DEFAULT ''"],
  ["driver2_passport_date", "TEXT DEFAULT ''"],
  // contrat
  ["contract_number", "TEXT DEFAULT ''"],
  // facture
  ["invoice_number", "TEXT DEFAULT ''"],
  ["insurance", "TEXT DEFAULT 'Normale'"],
  ["payment_mode", "TEXT DEFAULT ''"],
  ["observations", "TEXT DEFAULT ''"],
  ["fuel_depart", "TEXT DEFAULT ''"],
  ["fuel_return", "TEXT DEFAULT ''"],
  ["options", "TEXT DEFAULT ''"],
  ["equipment", "TEXT DEFAULT ''"],
];

function migrateContracts() {
  const cols = db.prepare("PRAGMA table_info(reservations)").all().map((c) => c.name);
  const added = [];
  for (const [name, def] of CONTRACT_MIGRATIONS) {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE reservations ADD COLUMN ${name} ${def}`);
      added.push(name);
    }
  }
  return added;
}

/* Signature client : hors de DOSSIER_FIELDS, elle ne doit pas être modifiable
   par le PATCH générique du dossier (signature_data est une image base64). */
const SIGNATURE_MIGRATIONS = [
  ["signature_status", "TEXT DEFAULT ''"],
  ["signature_token", "TEXT DEFAULT ''"],
  ["signature_data", "TEXT DEFAULT ''"],
  ["signature_name", "TEXT DEFAULT ''"],
  ["signature_mode", "TEXT DEFAULT ''"],
  ["signature_signed_at", "TEXT DEFAULT ''"],
  ["signature_requested_at", "TEXT DEFAULT ''"],
];

function migrateSignatures() {
  const cols = db.prepare("PRAGMA table_info(reservations)").all().map((c) => c.name);
  const added = [];
  for (const [name, def] of SIGNATURE_MIGRATIONS) {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE reservations ADD COLUMN ${name} ${def}`);
      added.push(name);
    }
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_res_sig_token ON reservations(signature_token)");
  return added;
}

/** Numérotation des factures, séquence repartant chaque année : F2026-0001. */
export function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const name = `invoice:${year}`;
  const row = db.prepare("SELECT value FROM counters WHERE name = ?").get(name);
  const next = (row ? Number(row.value) : 0) + 1;
  db.prepare(
    "INSERT INTO counters (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value"
  ).run(name, next);
  return `F${year}-${String(next).padStart(4, "0")}`;
}

/* ---------- signature client ---------- */

/** Crée (ou réutilise) le jeton du lien de signature à distance. */
export function createSignatureToken(reservationId) {
  const r = getReservation(reservationId);
  if (!r) return null;
  if (r.signature_token) return r.signature_token;
  const token = randomBytes(24).toString("base64url");
  db.prepare(
    "UPDATE reservations SET signature_token = ?, signature_status = ?, signature_requested_at = ?, updated_at = ? WHERE id = ?"
  ).run(token, "pending", now(), now(), reservationId);
  return token;
}

export const getReservationBySignatureToken = (token) =>
  /^[\w-]{20,64}$/.test(token || "")
    ? db.prepare("SELECT * FROM reservations WHERE signature_token = ?").get(token)
    : null;

/** Enregistre la signature : dataUrl = PNG base64, mode = 'onsite' | 'remote'. */
export function saveSignature(reservationId, { data, name, mode, keepToken }) {
  const r = getReservation(reservationId);
  if (!r) return null;
  db.prepare(
    `UPDATE reservations
        SET signature_data = ?, signature_name = ?, signature_mode = ?,
            signature_signed_at = ?, signature_status = 'signed',
            signature_token = ?, updated_at = ?
      WHERE id = ?`
  ).run(data, name || "", mode || "onsite", now(), keepToken ? r.signature_token : "", now(), reservationId);
  return getDossier(reservationId);
}

/** Réinitialise la signature et invalide le lien de signature à distance. */
export function clearSignature(reservationId) {
  const r = getReservation(reservationId);
  if (!r) return null;
  db.prepare(
    `UPDATE reservations
        SET signature_data = '', signature_name = '', signature_mode = '',
            signature_signed_at = '', signature_status = '', signature_token = '',
            updated_at = ?
      WHERE id = ?`
  ).run(now(), reservationId);
  return getDossier(reservationId);
}

db.exec(`
CREATE TABLE IF NOT EXISTS payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL DEFAULT 0,
  method         TEXT NOT NULL DEFAULT 'especes',
  paid_at        TEXT NOT NULL,
  note           TEXT DEFAULT '',
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL DEFAULT 'piece',
  stored_name    TEXT NOT NULL,
  original_name  TEXT NOT NULL,
  mime           TEXT NOT NULL,
  size           INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  client_type    TEXT NOT NULL DEFAULT 'particulier',
  last_name      TEXT NOT NULL DEFAULT '',
  first_name     TEXT DEFAULT '',
  birthdate      TEXT DEFAULT '',
  phone          TEXT DEFAULT '',
  email          TEXT DEFAULT '',
  address        TEXT DEFAULT '',
  licence_number TEXT DEFAULT '',
  licence_date   TEXT DEFAULT '',
  cin            TEXT DEFAULT '',
  cin_date       TEXT DEFAULT '',
  passport       TEXT DEFAULT '',
  passport_date  TEXT DEFAULT '',
  entry_number   TEXT DEFAULT '',
  entry_date     TEXT DEFAULT '',
  nationality    TEXT DEFAULT '',
  notes          TEXT DEFAULT '',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_res ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_att_res ON attachments(reservation_id);
`);

export const migratedColumns = [
  ...migrateVehicles(),
  ...migrateReservations(),
  ...migrateContracts(),
  ...migrateSignatures(),
];

/* Le numéro de contrat est la référence de la réservation. Les lignes créées
   avant ce choix portaient un compteur : on les réaligne une fois pour toutes. */
db.prepare(
  "UPDATE reservations SET contract_number = ref WHERE contract_number IS NULL OR contract_number = '' OR contract_number <> ref"
).run();

/* ---------- users ---------- */
export const countUsers = () => db.prepare("SELECT COUNT(*) AS n FROM users").get().n;

export const getUser = (username) =>
  db.prepare("SELECT * FROM users WHERE username = ?").get(username);

export const createUser = (username, passwordHash) =>
  db
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run(username, passwordHash, now());

/* ---------- vehicles ---------- */
const JSON_FIELDS = ["description", "ideal_for", "gallery", "tiers"];

export function rowToVehicle(row) {
  if (!row) return null;
  const v = { ...row, active: !!row.active, en_service: row.en_service === undefined ? true : !!row.en_service };
  for (const f of JSON_FIELDS) {
    try {
      v[f] = JSON.parse(row[f] || "[]");
    } catch {
      v[f] = [];
    }
  }
  /* La galerie ne contient que des chemins relatifs : les entrées envoyées par
     d'anciennes versions de l'admin étaient des objets. */
  v.gallery = (Array.isArray(v.gallery) ? v.gallery : [])
    .map((p) => (typeof p === "string" ? p : p?.publicPath || p?.storedName || ""))
    .filter(Boolean);
  return v;
}

export const listVehicles = ({ includeInactive = true } = {}) => {
  const sql = includeInactive
    ? "SELECT * FROM vehicles ORDER BY sort_order, name"
    : "SELECT * FROM vehicles WHERE active = 1 ORDER BY sort_order, name";
  return db.prepare(sql).all().map(rowToVehicle);
};

export const getVehicle = (slug) => rowToVehicle(db.prepare("SELECT * FROM vehicles WHERE slug = ?").get(slug));

/* Columns the admin can write. Order matters only for readability. */
const VEHICLE_FIELDS = [
  "slug", "name", "modele", "tagline", "matricule_ww", "matricule", "couleur",
  "kilometrage", "transmission", "energie", "fuel", "doors", "seats",
  "puissance_fiscale", "climatisation", "categorie", "date_circulation",
  "price_from", "deposit", "approx", "badge", "accent",
  "description", "ideal_for", "gallery", "tiers", "active", "en_service", "sort_order",
];

const INT_FIELDS = new Set(["doors", "seats", "price_from", "deposit", "approx", "kilometrage", "puissance_fiscale", "sort_order"]);
const BOOL_FIELDS = new Set(["active", "en_service"]);
const JSON_FIELDS_SET = new Set(["description", "ideal_for", "gallery", "tiers"]);

const num = (v, d = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

/** Keeps only known keys, with the right type for each. */
function cleanVehicleInput(input = {}) {
  const out = {};
  for (const key of VEHICLE_FIELDS) {
    if (input[key] === undefined) continue;
    let v = input[key];
    if (BOOL_FIELDS.has(key)) v = v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
    else if (INT_FIELDS.has(key)) v = num(v, 0);
    else if (JSON_FIELDS_SET.has(key)) v = JSON.stringify(Array.isArray(v) ? v : []);
    else v = String(v ?? "").trim().slice(0, key === "accent" || key === "description" ? 2000 : 300);
    out[key] = v;
  }
  return out;
}

export function insertVehicle(input) {
  const v = cleanVehicleInput(input);
  if (!v.slug || !v.name) throw new Error("slug et name requis");
  const now_ = now();
  const cols = Object.keys(v);
  db.prepare(
    `INSERT INTO vehicles (${cols.join(", ")}, created_at, updated_at) VALUES (${cols.map(() => "?").join(", ")}, ?, ?)`
  ).run(...cols.map((c) => v[c]), now_, now_);
  return getVehicle(v.slug);
}

export function updateVehicle(slug, input) {
  const cur = db.prepare("SELECT * FROM vehicles WHERE slug = ?").get(slug);
  if (!cur) return null;
  const v = cleanVehicleInput(input);
  delete v.slug; // le slug d'origine sert de cible ; le nouveau est géré ci-dessous
  if (!Object.keys(v).length) return getVehicle(slug);

  const sets = Object.keys(v).map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE vehicles SET ${sets}, updated_at = ? WHERE slug = ?`).run(
    ...Object.keys(v).map((k) => v[k]),
    now(),
    slug
  );

  const newSlug = input.slug && input.slug !== slug ? cleanVehicleInput({ slug: input.slug }).slug : null;
  if (newSlug) {
    db.prepare("UPDATE vehicles SET slug = ? WHERE slug = ?").run(newSlug, slug);
    db.prepare("UPDATE reservations SET vehicle_slug = ? WHERE vehicle_slug = ?").run(newSlug, slug);
    db.prepare("UPDATE blocked_dates SET vehicle_slug = ? WHERE vehicle_slug = ?").run(newSlug, slug);
    return getVehicle(newSlug);
  }
  return getVehicle(slug);
}

export const deleteVehicle = (slug) => {
  const used = db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE vehicle_slug = ?").get(slug).n;
  if (used > 0) return { ok: false, reason: "used", reservations: used };
  db.prepare("DELETE FROM vehicles WHERE slug = ?").run(slug);
  return { ok: true };
};

/* ---------- blocked dates ---------- */
export const listBlocked = (slug) =>
  slug
    ? db.prepare("SELECT * FROM blocked_dates WHERE vehicle_slug = ? ORDER BY start_date").all(slug)
    : db.prepare("SELECT * FROM blocked_dates ORDER BY start_date").all();

export function addBlocked(b) {
  db.prepare(
    "INSERT INTO blocked_dates (vehicle_slug, start_date, end_date, reason, created_at) VALUES (?,?,?,?,?)"
  ).run(b.vehicle_slug, b.start_date, b.end_date, b.reason || "", now());
  return db.prepare("SELECT last_insert_rowid() AS id").get().id;
}

export const deleteBlocked = (id) => db.prepare("DELETE FROM blocked_dates WHERE id = ?").run(id);

/* ---------- reservations ---------- */
const RES_COLUMNS = [
  "vehicle_slug", "vehicle_name", "first_name", "last_name", "country_code", "phone",
  "licence_number", "licence_date", "passport", "pickup", "ret",
  "pickup_date", "pickup_time", "return_date", "return_time",
  "baby_seat", "one_way", "days", "daily", "seat_total", "total", "notes", "summary",
];

/* Champs modifiables depuis l'admin une fois la réservation confirmée. */
export const DOSSIER_FIELDS = [
  "created_by", "client_id", "commercial", "agency", "kms_depart", "kms_return", "distance_km",
  "delivery_type", "extra_fee_label", "extra_fee", "internal_notes",
  "driver2_first_name", "driver2_last_name", "driver2_phone",
  "driver2_licence", "driver2_licence_date",
  ...CONTRACT_MIGRATIONS.map(([name]) => name),
  "notes", "status", "pickup", "ret", "pickup_date", "pickup_time", "return_date", "return_time",
];

export function createReservation(r) {
  const ref = makeRef();
  const stmt = db.prepare(
    `INSERT INTO reservations (ref, status, ${RES_COLUMNS.join(", ")}, created_at, updated_at)
     VALUES (?, 'nouvelle', ${RES_COLUMNS.map(() => "?").join(", ")}, ?, ?)`
  );
  stmt.run(ref, ...RES_COLUMNS.map((c) => r[c] ?? (typeof r[c] === "number" ? r[c] : 0)), now(), now());
  return getReservationByRef(ref);
}

export const getReservation = (id) =>
  db.prepare("SELECT * FROM reservations WHERE id = ?").get(id);

export const getReservationByRef = (ref) =>
  db.prepare("SELECT * FROM reservations WHERE ref = ?").get(ref);

export const listReservations = ({ status, q, limit = 200, offset = 0 } = {}) => {
  const where = [];
  const params = [];
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR ref LIKE ? OR vehicle_name LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  const sql =
    "SELECT * FROM reservations" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  return db.prepare(sql).all(...params, limit, offset);
};

export const countReservations = () =>
  db.prepare("SELECT COUNT(*) AS n FROM reservations").get().n;

export const countByStatus = () =>
  db
    .prepare("SELECT status, COUNT(*) AS n FROM reservations GROUP BY status")
    .all()
    .reduce((acc, r) => ({ ...acc, [r.status]: r.n }), {});

export const updateReservation = (id, patch) => {
  const cur = getReservation(id);
  if (!cur) return null;
  const allowed = new Set([...RES_COLUMNS, ...DOSSIER_FIELDS]);
  /* Une date invalide est ignorée plutôt qu'écrite : elle partirait sur le contrat. */
  const keys = Object.keys(patch).filter(
    (k) => allowed.has(k) && (!DATE_FIELD.test(k) || isoOrEmpty(patch[k]))
  );
  if (!keys.length) return cur;
  const INT = new Set(["kms_depart", "kms_return", "distance_km", "extra_fee", "total_paid"]);
  const BOOL_JSON = new Set(["options", "equipment"]);
  const sets = keys.map((k) => `${k} = ?`);
  const values = keys.map((k) => {
    if (INT.has(k)) return Number(patch[k]) || 0;
    if (BOOL_JSON.has(k)) return JSON.stringify(patch[k] && typeof patch[k] === "object" ? patch[k] : {});
    if (DATE_FIELD.test(k)) return isoOrEmpty(patch[k]);
    return patch[k];
  });

  // Le statut et l'horodatage de confirmation restent cohérents entre eux.
  if (patch.status && patch.status !== cur.status) {
    if (["confirmee", "livree"].includes(patch.status) && !cur.confirmed_at) {
      values.push(now());
      sets.push("confirmed_at = ?");
    }
    if (patch.status === "annulee") {
      db.prepare("DELETE FROM payments WHERE reservation_id = ?").run(id);
    }
  }
  db.prepare(`UPDATE reservations SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).run(...values, now(), id);
  return getReservation(id);
};

/* ---------- dossier : totaux, règlements, pièces jointes ---------- */

/** Recalcule les totaux affichés dans le dossier (TTC, versé, reste). */
export function computeTotals(r) {
  const extra = r.extra_fee || 0;
  const ttc = (r.total || 0) + extra;
  const paid = r.total_paid || 0;
  return {
    extraFee: extra,
    totalTTC: ttc,
    totalPaid: paid,
    reste: ttc - paid,
  };
}

const LOCKED_STATUSES = ["confirmee", "livree"];

export const isDossierOpen = (r) => LOCKED_STATUSES.includes(r?.status);

/** Réservation enrichie : totaux, règlements, pièces, et l'état métier. */
export function getDossier(id) {
  const r = getReservation(id);
  if (!r) return null;
  const payments = db
    .prepare("SELECT * FROM payments WHERE reservation_id = ? ORDER BY paid_at DESC, id DESC")
    .all(id);
  const attachments = db
    .prepare("SELECT * FROM attachments WHERE reservation_id = ? ORDER BY id DESC")
    .all(id);

  const parseJson = (v) => {
    try { return JSON.parse(v || "{}"); } catch { return {}; }
  };
  const jsonish = parseJson(r.options);
  const equip = parseJson(r.equipment);

  /* Le mode de paiement affiché est celui du dernier règlement, avec la valeur
     saisie au dossier en repli (le modèle imprime « Espèce » par défaut). */
  const paymentMode = r.payment_mode || payments[0]?.method || "especes";
  const PAY_LABEL = { especes: "Espèce", cb: "Carte bancaire", virement: "Virement", cheque: "Chèque" };

  return {
    ...r,
    options: {
      radio: "radio" in jsonish ? !!jsonish.radio : !!r.baby_seat === false,
      gps: "gps" in jsonish ? !!jsonish.gps : false,
      babySeat: "babySeat" in jsonish ? !!jsonish.babySeat : !!r.baby_seat,
      climatiseur: "climatiseur" in jsonish ? !!jsonish.climatiseur : true,
    },
    equipment: {
      batterie: !!equip.batterie,
      outils: !!equip.outils,
      retroExt: !!equip.retroExt,
      feux: !!equip.feux,
      galerie: !!equip.galerie,
      posteRadio: "posteRadio" in equip ? !!equip.posteRadio : true,
      pressuSecours: !!equip.pressuSecours,
      alarmeCigare: !!equip.alarmeCigare,
    },
    paymentMode,
    paymentModeLabel: PAY_LABEL[paymentMode] || paymentMode,
    insurance: r.insurance || "Normale",
    contractNumber: r.contract_number || r.ref,
    invoiceNumber: r.invoice_number || "",
    /* Signature client : 'pending' = lien envoyé, 'signed' = signature enregistrée. */
    signatureStatus: r.signature_status || "",
    signatureName: r.signature_name || "",
    signatureMode: r.signature_mode || "",
    signatureSignedAt: r.signature_signed_at || "",
    signatureRequestedAt: r.signature_requested_at || "",
    signatureData: r.signature_data || "",
    signatureSigned: !!r.signature_data,
    kmDone: r.kms_depart && r.kms_return ? Math.max(0, r.kms_return - r.kms_depart) : 0,
    ...computeTotals(r),
    payments,
    attachments,
    dossierOpen: isDossierOpen(r),
  };
}

export function addPayment(reservationId, p) {
  const res = getReservation(reservationId);
  if (!res) return null;
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(p.paid_at || "") ? p.paid_at : now().slice(0, 10);
  db.prepare(
    "INSERT INTO payments (reservation_id, amount, method, paid_at, note, created_at) VALUES (?,?,?,?,?,?)"
  ).run(reservationId, p.amount || 0, p.method || "especes", paidAt, p.note || "", now());
  recalcPaid(reservationId);
  return listPayments(reservationId);
}

/** Le total versé est toujours dérivé des règlements : jamais saisi en double. */
export function recalcPaid(reservationId) {
  const sum = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE reservation_id = ?")
    .get(reservationId).n;
  db.prepare("UPDATE reservations SET total_paid = ?, updated_at = ? WHERE id = ?")
    .run(sum, now(), reservationId);
  return sum;
}

export const listPayments = (id) =>
  db.prepare("SELECT * FROM payments WHERE reservation_id = ? ORDER BY paid_at DESC, id DESC").all(id);

export const deletePayment = (paymentId) => {
  const row = db.prepare("SELECT reservation_id FROM payments WHERE id = ?").get(paymentId);
  if (!row) return false;
  db.prepare("DELETE FROM payments WHERE id = ?").run(paymentId);
  recalcPaid(row.reservation_id);
  return true;
};

export const listAttachments = (id) =>
  db.prepare("SELECT * FROM attachments WHERE reservation_id = ? ORDER BY id DESC").all(id);

export function addAttachment(reservationId, a) {
  db.prepare(
    "INSERT INTO attachments (reservation_id, kind, stored_name, original_name, mime, size, created_at) VALUES (?,?,?,?,?,?,?)"
  ).run(reservationId, a.kind || "piece", a.stored_name, a.original_name, a.mime || "", a.size || 0, now());
  return listAttachments(reservationId);
}

export const deleteAttachment = (attachmentId) => {
  const row = db.prepare("SELECT stored_name FROM attachments WHERE id = ?").get(attachmentId);
  if (!row) return false;
  db.prepare("DELETE FROM attachments WHERE id = ?").run(attachmentId);
  return row.stored_name;
};

export const deleteReservation = (id) => db.prepare("DELETE FROM reservations WHERE id = ?").run(id);

/* ---------- clients ---------- */

export const CLIENT_FIELDS = [
  "client_type", "last_name", "first_name", "birthdate", "phone", "email", "address",
  "licence_number", "licence_date", "cin", "cin_date", "passport", "passport_date",
  "entry_number", "entry_date", "nationality", "notes",
];

const CLIENT_TYPES = ["particulier", "professionnel", "entreprise"];

const rowToClient = (row) => {
  if (!row) return null;
  return {
    ...row,
    client_type: CLIENT_TYPES.includes(row.client_type) ? row.client_type : "particulier",
    full_name: `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.last_name || "",
  };
};

/** Liste filtrée : nom, prénom, téléphone, email, CIN, passeport, n° d'entrée. */
export function listClients({ q = "", type = "" } = {}) {
  const where = [];
  const params = [];
  if (type === "particulier" || type === "professionnel" || type === "entreprise") {
    where.push("client_type = ?");
    params.push(type);
  }
  const needle = String(q || "").trim();
  if (needle) {
    where.push(
      `(last_name LIKE ? OR first_name LIKE ? OR phone LIKE ? OR email LIKE ?
        OR cin LIKE ? OR passport LIKE ? OR licence_number LIKE ? OR entry_number LIKE ?)`
    );
    const like = `%${needle}%`;
    params.push(like, like, like, like, like, like, like, like);
  }
  const sql = `SELECT * FROM clients ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE, id DESC`;
  return db.prepare(sql).all(...params).map(rowToClient);
}

export const getClient = (id) =>
  rowToClient(db.prepare("SELECT * FROM clients WHERE id = ?").get(Number(id)));

export const countClients = () => db.prepare("SELECT COUNT(*) AS n FROM clients").get().n;

/** Ne conserve que les champs connus, en texte, pour éviter d'écrire du n'importe quoi. */
function cleanClient(input) {
  const out = {};
  for (const key of CLIENT_FIELDS) {
    if (!(key in input)) continue;
    let v = input[key];
    if (v === null || v === undefined) v = "";
    v = String(v).trim();
    if (key.endsWith("_date") || key === "birthdate") v = isoOrEmpty(v);
    out[key] = v.slice(0, 200);
  }
  if ("client_type" in out && !CLIENT_TYPES.includes(out.client_type)) out.client_type = "particulier";
  return out;
}

export function createClient(input) {
  const data = cleanClient(input);
  if (!data.last_name) return null;
  const cols = CLIENT_FIELDS.filter((f) => f in data);
  const res = db.prepare(
    `INSERT INTO clients (${cols.join(", ")}, created_at, updated_at)
     VALUES (${cols.map(() => "?").join(", ")}, ?, ?)`
  ).run(...cols.map((c) => data[c]), now(), now());
  return getClient(res.lastInsertRowid);
}

export function updateClient(id, input) {
  const target = getClient(id);
  if (!target) return null;
  const data = cleanClient(input);
  const cols = CLIENT_FIELDS.filter((f) => f in data);
  if (!cols.length) return target;
  db.prepare(`UPDATE clients SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
    .run(...cols.map((c) => data[c]), now(), Number(id));
  return getClient(id);
}

export const deleteClient = (id) =>
  db.prepare("DELETE FROM clients WHERE id = ?").run(Number(id)).changes > 0;

function makeRef() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return "LC-" + s;
}