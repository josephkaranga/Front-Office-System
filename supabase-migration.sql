-- KYSHAKEZ Front Office System - Supabase Migration
-- Run this ENTIRE script in Supabase Dashboard > SQL Editor > New Query

-- Drop existing tables if re-running
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS checkins CASCADE;
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'receptionist',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  login_time TIMESTAMPTZ DEFAULT now(),
  logout_time TIMESTAMPTZ
);

CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  room_number TEXT UNIQUE NOT NULL,
  room_type TEXT NOT NULL,
  floor INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  rate_per_night NUMERIC NOT NULL,
  rate_double NUMERIC,
  status TEXT NOT NULL DEFAULT 'available',
  description TEXT,
  amenities TEXT,
  image_url TEXT
);

CREATE TABLE guests (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  id_type TEXT,
  id_number TEXT,
  nationality TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  vip_status TEXT DEFAULT 'regular',
  notes TEXT,
  registered_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE checkins (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  checkin_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  checkout_date TIMESTAMPTZ,
  expected_checkout DATE NOT NULL,
  num_guests INTEGER DEFAULT 1,
  stay_type TEXT DEFAULT 'night',
  car_registration TEXT,
  purpose TEXT,
  status TEXT DEFAULT 'checked_in',
  checked_in_by INTEGER REFERENCES users(id),
  checked_out_by INTEGER REFERENCES users(id),
  special_requests TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  reservation_date TIMESTAMPTZ DEFAULT now(),
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  num_guests INTEGER DEFAULT 1,
  stay_type TEXT DEFAULT 'night',
  status TEXT DEFAULT 'confirmed',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  car_registration TEXT
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  checkin_id INTEGER REFERENCES checkins(id),
  reservation_id INTEGER REFERENCES reservations(id),
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT now(),
  reference_number TEXT,
  description TEXT,
  status TEXT DEFAULT 'completed',
  received_by INTEGER REFERENCES users(id),
  transaction_id TEXT
);

CREATE TABLE extras (
  id SERIAL PRIMARY KEY,
  checkin_id INTEGER NOT NULL REFERENCES checkins(id),
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  notes TEXT,
  added_by INTEGER REFERENCES users(id),
  added_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_checkins_status ON checkins(status);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_guests_name ON guests(last_name, first_name);
CREATE INDEX idx_shifts_user ON shifts(user_id);
CREATE INDEX idx_payments_received ON payments(received_by);
CREATE INDEX idx_extras_checkin ON extras(checkin_id);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('hotel_name', 'KYSHAKEZ'),
  ('hotel_tagline', 'Front Office System'),
  ('currency', 'KES'),
  ('country', 'Kenya'),
  ('timezone', 'Africa/Nairobi')
ON CONFLICT (key) DO NOTHING;

-- RLS: Allow full access (server-side auth via JWT, not Supabase auth)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON guests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON checkins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON reservations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON extras FOR ALL USING (true) WITH CHECK (true);
