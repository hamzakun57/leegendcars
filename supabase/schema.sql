-- Leegend Cars — schéma PostgreSQL (Supabase)
-- Les colonnes reprennent exactement celles de l'ancien fichier SQLite :
-- les entiers restent des entiers (0/1) et les dates restent des chaînes ISO,
-- pour que le code applicatif n'ait rien à convertir.

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  slug               TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  tagline            TEXT DEFAULT '',
  transmission       TEXT DEFAULT '',
  fuel               TEXT DEFAULT '',
  doors              INTEGER DEFAULT 5,
  seats              INTEGER DEFAULT 5,
  price_from         INTEGER NOT NULL DEFAULT 0,
  deposit            INTEGER NOT NULL DEFAULT 0,
  approx             INTEGER DEFAULT 0,
  badge              TEXT DEFAULT '',
  accent             TEXT DEFAULT '',
  description        TEXT DEFAULT '[]',
  ideal_for          TEXT DEFAULT '[]',
  gallery            TEXT DEFAULT '[]',
  tiers              TEXT DEFAULT '[]',
  active             INTEGER NOT NULL DEFAULT 1,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  modele             TEXT DEFAULT '',
  matricule_ww       TEXT DEFAULT '',
  matricule          TEXT DEFAULT '',
  couleur            TEXT DEFAULT '',
  kilometrage        INTEGER DEFAULT 0,
  puissance_fiscale  INTEGER DEFAULT 0,
  energie            TEXT DEFAULT '',
  climatisation      TEXT DEFAULT '',
  categorie          TEXT DEFAULT '',
  date_circulation   TEXT DEFAULT '',
  en_service         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  id           BIGSERIAL PRIMARY KEY,
  vehicle_slug TEXT NOT NULL REFERENCES vehicles(slug) ON DELETE CASCADE,
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  reason       TEXT DEFAULT '',
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
  id              BIGSERIAL PRIMARY KEY,
  ref             TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'nouvelle',
  vehicle_slug    TEXT DEFAULT '',
  vehicle_name    TEXT DEFAULT '',
  first_name      TEXT DEFAULT '',
  last_name       TEXT DEFAULT '',
  country_code    TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  licence_number  TEXT DEFAULT '',
  licence_date    TEXT DEFAULT '',
  passport        TEXT DEFAULT '',
  pickup          TEXT DEFAULT '',
  ret             TEXT DEFAULT '',
  pickup_date     TEXT DEFAULT '',
  pickup_time     TEXT DEFAULT '',
  return_date     TEXT DEFAULT '',
  return_time     TEXT DEFAULT '',
  baby_seat       INTEGER NOT NULL DEFAULT 0,
  one_way         INTEGER NOT NULL DEFAULT 0,
  days            INTEGER NOT NULL DEFAULT 0,
  daily           INTEGER NOT NULL DEFAULT 0,
  seat_total      INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL DEFAULT 0,
  notes           TEXT DEFAULT '',
  summary         TEXT DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  created_by      TEXT DEFAULT '',
  client_id       INTEGER DEFAULT 0,
  commercial      TEXT DEFAULT '',
  agency          TEXT DEFAULT '',
  kms_depart      INTEGER DEFAULT 0,
  kms_return      INTEGER DEFAULT 0,
  distance_km     INTEGER DEFAULT 0,
  delivery_type   TEXT DEFAULT '',
  extra_fee_label TEXT DEFAULT '',
  extra_fee       INTEGER NOT NULL DEFAULT 0,
  total_paid      INTEGER NOT NULL DEFAULT 0,
  confirmed_at    TEXT DEFAULT '',
  driver2_first_name    TEXT DEFAULT '',
  driver2_last_name     TEXT DEFAULT '',
  driver2_phone         TEXT DEFAULT '',
  driver2_licence       TEXT DEFAULT '',
  driver2_licence_date  TEXT DEFAULT '',
  internal_notes        TEXT DEFAULT '',
  d1_birthdate      TEXT DEFAULT '',
  d1_nationality    TEXT DEFAULT '',
  d1_address        TEXT DEFAULT '',
  d1_cin            TEXT DEFAULT '',
  d1_cin_date       TEXT DEFAULT '',
  d1_passport_date  TEXT DEFAULT '',
  driver2_birthdate      TEXT DEFAULT '',
  driver2_nationality    TEXT DEFAULT '',
  driver2_address        TEXT DEFAULT '',
  driver2_cin            TEXT DEFAULT '',
  driver2_cin_date       TEXT DEFAULT '',
  driver2_passport_date  TEXT DEFAULT '',
  contract_number   TEXT DEFAULT '',
  invoice_number    TEXT DEFAULT '',
  insurance         TEXT DEFAULT 'Normale',
  payment_mode      TEXT DEFAULT '',
  observations      TEXT DEFAULT '',
  fuel_depart       TEXT DEFAULT '',
  fuel_return       TEXT DEFAULT '',
  options           TEXT DEFAULT '',
  equipment         TEXT DEFAULT '',
  signature_status      TEXT DEFAULT '',
  signature_token       TEXT DEFAULT '',
  signature_data        TEXT DEFAULT '',
  signature_name        TEXT DEFAULT '',
  signature_mode        TEXT DEFAULT '',
  signature_signed_at   TEXT DEFAULT '',
  signature_requested_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS payments (
  id             BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL DEFAULT 0,
  method         TEXT NOT NULL DEFAULT 'especes',
  paid_at        TEXT NOT NULL,
  note           TEXT DEFAULT '',
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id             BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS maintenance (
  id            BIGSERIAL PRIMARY KEY,
  vehicle_slug  TEXT NOT NULL REFERENCES vehicles(slug) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'autre',
  label         TEXT DEFAULT '',
  due_date      TEXT NOT NULL,
  period_days   INTEGER NOT NULL DEFAULT 0,
  period_km     INTEGER NOT NULL DEFAULT 0,
  last_done_at  TEXT DEFAULT '',
  last_cost     INTEGER NOT NULL DEFAULT 0,
  last_km       INTEGER NOT NULL DEFAULT 0,
  notes         TEXT DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_maint_veh  ON maintenance(vehicle_slug);
CREATE INDEX IF NOT EXISTS idx_maint_due  ON maintenance(due_date);

CREATE TABLE IF NOT EXISTS clients (
  id             BIGSERIAL PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_res_status  ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_res_created ON reservations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_res_sig_token ON reservations(signature_token);
CREATE INDEX IF NOT EXISTS idx_blocked     ON blocked_dates(vehicle_slug, start_date);
CREATE INDEX IF NOT EXISTS idx_pay_res     ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_att_res     ON attachments(reservation_id);

-- Le numéro de contrat est la référence de la réservation.
UPDATE reservations SET contract_number = ref
 WHERE contract_number IS NULL OR contract_number = '' OR contract_number <> ref;

-- L'import depuis SQLite a conservé les identifiants d'origine : les séquences
-- doivent repartir juste après, sinon le prochain INSERT entre en conflit avec
-- la clé primaire. Sans effet sur une base créée par le schéma.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','blocked_dates','reservations','payments','attachments','clients','maintenance'
  ] LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT MAX(id) FROM %I), 1), (SELECT MAX(id) FROM %I) IS NOT NULL)',
      t, 'id', t, t
    );
  END LOOP;
END $$;

-- RLS activée, aucune policy : les tables ne sont atteignables que par le
-- serveur (connexion directe au rôle postgres), jamais par la clé anon.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','vehicles','blocked_dates','reservations',
    'payments','attachments','counters','clients'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;