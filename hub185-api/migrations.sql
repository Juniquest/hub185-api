-- HUB 185 / Cowork Auto — Banco (Postgres)
-- Rode no Render Postgres (Query/PSQL)

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('HOLD','PAID','EXPIRED','CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO resources (id, name) VALUES
('MEETING_ROOM','Sala de Reunião'),
('PC1','Estação 1'),
('PC2','Estação 2')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id TEXT NOT NULL REFERENCES resources(id),
  customer_email TEXT,
  status booking_status NOT NULL DEFAULT 'HOLD',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  asaas_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE bookings
  ADD CONSTRAINT no_overlap_paid_or_hold
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status IN ('HOLD','PAID'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Teste:
-- SELECT * FROM resources;
