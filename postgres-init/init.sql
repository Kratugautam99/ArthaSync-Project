-- create_arthasync.sql (Simplified)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arthasync_user') THEN
    CREATE ROLE arthasync_user WITH LOGIN PASSWORD 'ChangeThisStrongPassword';
  END IF;
END$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- DROP SCHEMA IF EXISTS arthasync CASCADE; -- Warning: this deletes all data! We'll just rely on IF NOT EXISTS
CREATE SCHEMA IF NOT EXISTS arthasync AUTHORIZATION arthasync_user;

SET search_path = arthasync, public;

-- 1. Invoices Table
CREATE TABLE IF NOT EXISTS arthasync.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  vendor_name TEXT,
  customer_name TEXT,
  invoice_date DATE,
  due_date DATE,
  total_amount NUMERIC(18,2) DEFAULT 0,
  tax_amount NUMERIC(18,2) DEFAULT 0,
  subtotal NUMERIC(18,2) DEFAULT 0,
  currency CHAR(3) DEFAULT 'INR',
  type TEXT CHECK (type IN ('sales', 'purchase')),
  payment_status TEXT CHECK (payment_status IN ('pending','paid','partial','overdue')) DEFAULT 'pending',
  items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_invoices_date ON arthasync.invoices (invoice_date);

-- 2. Short Term Memory Table
CREATE TABLE IF NOT EXISTS arthasync.short_term_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_memory_session ON arthasync.short_term_memory (session_id);

-- 3. File Upload Table
CREATE TABLE IF NOT EXISTS arthasync.file_upload (
  file_id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  suffix TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  extracted_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant Privileges
GRANT USAGE ON SCHEMA arthasync TO arthasync_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA arthasync TO arthasync_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA arthasync GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO arthasync_user;