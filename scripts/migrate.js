require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  mobile        TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('applicant','officer')),
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('suite','room')),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  office          TEXT NOT NULL,
  grp             TEXT NOT NULL CHECK (grp IN ('A','BC')),
  visit_type      TEXT NOT NULL CHECK (visit_type IN ('duty','private','other','retired','guest')),
  room_type       TEXT NOT NULL CHECK (room_type IN ('suite','room')),
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  mobile          TEXT NOT NULL,
  remarks         TEXT DEFAULT '',
  pay_mode        TEXT NOT NULL CHECK (pay_mode IN ('upi','cash')),
  upi_ref         TEXT DEFAULT '',
  cash_remark     TEXT DEFAULT '',
  estimated_total INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
  decided_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at      TIMESTAMPTZ,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_dates CHECK (check_out > check_in)
);
CREATE INDEX IF NOT EXISTS idx_bookings_status  ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user    ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room    ON bookings(room_id, check_in, check_out);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('approved','rejected')),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifs_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_unread ON notifications(user_id,is_read) WHERE is_read=FALSE;

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  UUID,
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
`;

(async () => {
  console.log('Running migrations on Neon…');
  try {
    await sql.query(SCHEMA);
    console.log('✓ Done.');
  } catch (e) { console.error('Migration failed:', e.message); process.exit(1); }
})();
