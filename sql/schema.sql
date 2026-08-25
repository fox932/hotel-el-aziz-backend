-- Hôtel El Aziz — schéma de base de données PostgreSQL

CREATE TABLE IF NOT EXISTS rooms (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(60) UNIQUE NOT NULL,
  name          VARCHAR(120) NOT NULL,
  capacity_text VARCHAR(80) NOT NULL,       -- ex: "2 personnes"
  bed_text      VARCHAR(120) NOT NULL,      -- ex: "1 lit double · 20 m²"
  guests        INTEGER NOT NULL DEFAULT 1, -- capacité numérique, pour filtres
  price         INTEGER NOT NULL,           -- prix par nuit en DA
  total_units   INTEGER NOT NULL DEFAULT 1, -- nombre de chambres de ce type dans l'hôtel
  amenities     TEXT[] NOT NULL DEFAULT '{}',
  description   TEXT,
  images        TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) UNIQUE NOT NULL,
  phone         VARCHAR(40),
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(60) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(30) NOT NULL DEFAULT 'reception',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offers (
  id               SERIAL PRIMARY KEY,
  title            VARCHAR(160) NOT NULL,
  description      TEXT,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  valid_from       DATE,
  valid_to         DATE,
  image            TEXT,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id                  SERIAL PRIMARY KEY,
  reservation_number  VARCHAR(20) UNIQUE NOT NULL,
  room_id             INTEGER NOT NULL REFERENCES rooms(id),
  customer_id         INTEGER REFERENCES customers(id),
  guest_name          VARCHAR(120) NOT NULL,
  guest_email         VARCHAR(160) NOT NULL,
  guest_phone         VARCHAR(40),
  check_in            DATE NOT NULL,
  check_out           DATE NOT NULL,
  adults              INTEGER NOT NULL DEFAULT 1,
  children            INTEGER NOT NULL DEFAULT 0,
  rooms_count         INTEGER NOT NULL DEFAULT 1,
  status              VARCHAR(20) NOT NULL DEFAULT 'en_attente',
    -- 'confirme' | 'en_attente' | 'termine' | 'annule'
  payment_status      VARCHAR(20) NOT NULL DEFAULT 'non_paye',
    -- 'paye' | 'partiel' | 'non_paye' | 'rembourse'
  total_price         INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_dates CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_dates ON bookings (room_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings (customer_id);
