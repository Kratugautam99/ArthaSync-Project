-- create_arthasync.sql

-- 0. Create role if missing (optional)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arthasync_user') THEN
    CREATE ROLE arthasync_user WITH LOGIN PASSWORD 'ChangeThisStrongPassword';
  END IF;
END$$;

-- 1. Extensions (requires superuser)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- 2. Top-level schema
CREATE SCHEMA IF NOT EXISTS arthasync AUTHORIZATION arthasync_user;

SET search_path = arthasync, public;

-- 3. Sales table
CREATE TABLE IF NOT EXISTS arthasync.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_no BIGINT GENERATED ALWAYS AS IDENTITY,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  gst_no TEXT,
  customer_name TEXT NOT NULL,
  customer_email CITEXT,
  customer_phone TEXT,
  customer_address TEXT,
  customer_gstin TEXT,
  items JSONB NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
  cgst_percent NUMERIC(5,2) DEFAULT 0 CHECK (cgst_percent BETWEEN 0 AND 100),
  cgst_amount NUMERIC(15,2) DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_percent NUMERIC(5,2) DEFAULT 0 CHECK (sgst_percent BETWEEN 0 AND 100),
  sgst_amount NUMERIC(15,2) DEFAULT 0 CHECK (sgst_amount >= 0),
  total_tax NUMERIC(15,2) GENERATED ALWAYS AS (cgst_amount + sgst_amount) STORED,
  grand_total NUMERIC(18,2) NOT NULL CHECK (grand_total >= 0),
  currency CHAR(3) DEFAULT 'INR',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending','paid','partial','overdue')) DEFAULT 'pending',
  payment_method TEXT,
  amount_paid NUMERIC(15,2) DEFAULT 0 CHECK (amount_paid >= 0),
  amount_due NUMERIC(15,2) GENERATED ALWAYS AS (grand_total - amount_paid) STORED,
  pdf_file_url TEXT,
  terms TEXT,
  archive_status BOOLEAN DEFAULT FALSE,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_invoice_number_gstin ON arthasync.sales (invoice_number, customer_gstin);
CREATE INDEX IF NOT EXISTS ix_sales_invoice_date ON arthasync.sales (invoice_date);
CREATE INDEX IF NOT EXISTS ix_sales_customer_gstin ON arthasync.sales (customer_gstin);

-- 4. Purchase table
CREATE TABLE IF NOT EXISTS arthasync.purchase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_no BIGINT GENERATED ALWAYS AS IDENTITY,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  gst_no TEXT,
  vendor_name TEXT NOT NULL,
  vendor_email CITEXT,
  vendor_phone TEXT,
  vendor_address TEXT,
  vendor_gstin TEXT,
  items JSONB NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
  cgst_percent NUMERIC(5,2) DEFAULT 0 CHECK (cgst_percent BETWEEN 0 AND 100),
  cgst_amount NUMERIC(15,2) DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_percent NUMERIC(5,2) DEFAULT 0 CHECK (sgst_percent BETWEEN 0 AND 100),
  sgst_amount NUMERIC(15,2) DEFAULT 0 CHECK (sgst_amount >= 0),
  total_tax NUMERIC(15,2) GENERATED ALWAYS AS (cgst_amount + sgst_amount) STORED,
  grand_total NUMERIC(18,2) NOT NULL CHECK (grand_total >= 0),
  currency CHAR(3) DEFAULT 'INR',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending','paid','partial','overdue')) DEFAULT 'pending',
  payment_method TEXT,
  amount_paid NUMERIC(15,2) DEFAULT 0 CHECK (amount_paid >= 0),
  amount_due NUMERIC(15,2) GENERATED ALWAYS AS (grand_total - amount_paid) STORED,
  pdf_file_url TEXT,
  terms TEXT,
  archive_status BOOLEAN DEFAULT FALSE,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_purchase_invoice_number_vendor ON arthasync.purchase (invoice_number, vendor_gstin);
CREATE INDEX IF NOT EXISTS ix_purchase_invoice_date ON arthasync.purchase (invoice_date);
CREATE INDEX IF NOT EXISTS ix_purchase_vendor_gstin ON arthasync.purchase (vendor_gstin);

-- 5. Quotation table
CREATE TABLE IF NOT EXISTS arthasync.quotation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_no BIGINT GENERATED ALWAYS AS IDENTITY,
  quotation_no TEXT NOT NULL,
  quotation_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email CITEXT,
  customer_phone TEXT,
  customer_address TEXT,
  customer_gstin TEXT,
  items JSONB NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
  cgst_percent NUMERIC(5,2) DEFAULT 0 CHECK (cgst_percent BETWEEN 0 AND 100),
  cgst_amount NUMERIC(15,2) DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_percent NUMERIC(5,2) DEFAULT 0 CHECK (sgst_percent BETWEEN 0 AND 100),
  sgst_amount NUMERIC(15,2) DEFAULT 0 CHECK (sgst_amount >= 0),
  total_tax NUMERIC(15,2) GENERATED ALWAYS AS (cgst_amount + sgst_amount) STORED,
  grand_total NUMERIC(18,2) NOT NULL CHECK (grand_total >= 0),
  pdf_file_url TEXT,
  terms TEXT,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_quotation_no ON arthasync.quotation (quotation_no);
CREATE INDEX IF NOT EXISTS ix_quotation_date ON arthasync.quotation (quotation_date);

-- 6. Expense table
CREATE TABLE IF NOT EXISTS arthasync.expense (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id TEXT NOT NULL,
  date DATE NOT NULL,
  due_date DATE,
  expense_category TEXT,
  expense_description TEXT,
  vendor_name TEXT,
  vendor_phone TEXT,
  vendor_email CITEXT,
  vendor_gst_no TEXT,
  expense_amount NUMERIC(15,2) NOT NULL CHECK (expense_amount >= 0),
  gst_applicable BOOLEAN DEFAULT FALSE,
  gst_percent NUMERIC(5,2) DEFAULT 0 CHECK (gst_percent BETWEEN 0 AND 100),
  gst_amount NUMERIC(15,2) DEFAULT 0 CHECK (gst_amount >= 0),
  total_amount NUMERIC(18,2) GENERATED ALWAYS AS (expense_amount + gst_amount) STORED,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending','paid','partial','overdue')) DEFAULT 'pending',
  payment_method TEXT,
  amount_paid NUMERIC(15,2) DEFAULT 0 CHECK (amount_paid >= 0),
  -- amount_due computed directly from base columns (not from generated total_amount)
  amount_due NUMERIC(15,2) GENERATED ALWAYS AS (expense_amount + gst_amount - amount_paid) STORED,
  source_type TEXT,
  direction TEXT,
  entry_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archive_status BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_expense_expense_id ON arthasync.expense (expense_id);
CREATE INDEX IF NOT EXISTS ix_expense_date ON arthasync.expense (date);

-- 7. Ledger table
CREATE TABLE IF NOT EXISTS arthasync.ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL,
  date DATE NOT NULL,
  source_type TEXT,
  source_id UUID,
  party TEXT,
  party_no TEXT,
  party_mail CITEXT,
  direction TEXT CHECK (direction IN ('in','out','transfer')),
  payment_method TEXT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_entry_id ON arthasync.ledger (entry_id);
CREATE INDEX IF NOT EXISTS ix_ledger_date ON arthasync.ledger (date);

-- 8. Generic immutability trigger function using TG_ARGV
CREATE OR REPLACE FUNCTION arthasync.prevent_immutable_updates() RETURNS trigger AS $$
DECLARE
  i INT;
  colname TEXT;
  oldval TEXT;
  newval TEXT;
BEGIN
  FOR i IN 0..TG_NARGS-1 LOOP
    colname := TG_ARGV[i];
    EXECUTE format('SELECT ($1).%I::text', colname) INTO oldval USING OLD;
    EXECUTE format('SELECT ($1).%I::text', colname) INTO newval USING NEW;
    IF oldval IS DISTINCT FROM newval THEN
      RAISE EXCEPTION 'Attempt to modify immutable column % on table %', colname, TG_TABLE_NAME;
    END IF;
  END LOOP;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Attach triggers (pass immutable column names as trigger args)
DROP TRIGGER IF EXISTS trg_sales_immutable ON arthasync.sales;
CREATE TRIGGER trg_sales_immutable
BEFORE UPDATE ON arthasync.sales
FOR EACH ROW
EXECUTE FUNCTION arthasync.prevent_immutable_updates('invoice_number','invoice_date','customer_gstin');

DROP TRIGGER IF EXISTS trg_purchase_immutable ON arthasync.purchase;
CREATE TRIGGER trg_purchase_immutable
BEFORE UPDATE ON arthasync.purchase
FOR EACH ROW
EXECUTE FUNCTION arthasync.prevent_immutable_updates('invoice_number','invoice_date','vendor_gstin');

DROP TRIGGER IF EXISTS trg_quotation_immutable ON arthasync.quotation;
CREATE TRIGGER trg_quotation_immutable
BEFORE UPDATE ON arthasync.quotation
FOR EACH ROW
EXECUTE FUNCTION arthasync.prevent_immutable_updates('quotation_no','quotation_date');

DROP TRIGGER IF EXISTS trg_expense_immutable ON arthasync.expense;
CREATE TRIGGER trg_expense_immutable
BEFORE UPDATE ON arthasync.expense
FOR EACH ROW
EXECUTE FUNCTION arthasync.prevent_immutable_updates('expense_id','date');

DROP TRIGGER IF EXISTS trg_ledger_immutable ON arthasync.ledger;
CREATE TRIGGER trg_ledger_immutable
BEFORE UPDATE ON arthasync.ledger
FOR EACH ROW
EXECUTE FUNCTION arthasync.prevent_immutable_updates('entry_id','date');

-- 10. Grant privileges to app user
GRANT USAGE ON SCHEMA arthasync TO arthasync_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA arthasync TO arthasync_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA arthasync GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO arthasync_user;

-- 11. Users table
CREATE TABLE IF NOT EXISTS arthasync.users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      CITEXT      NOT NULL,
  password_hash TEXT        NOT NULL,
  full_name     TEXT,
  email         CITEXT,
  phone         TEXT        CHECK (phone ~ '^\+[1-9]\d{0,2}-\d{7,12}$'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login    TIMESTAMPTZ DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username ON arthasync.users (username);
CREATE INDEX IF NOT EXISTS ix_users_email         ON arthasync.users (email);
CREATE INDEX IF NOT EXISTS ix_users_phone         ON arthasync.users (phone);

-- 12. Helper: create user via pgcrypto bcrypt (optional convenience function)
CREATE OR REPLACE FUNCTION arthasync.create_user_with_bcrypt(
  p_username  TEXT,
  p_password  TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_email     TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_hash TEXT;
  v_id   UUID;
BEGIN
  v_hash := crypt(p_password, gen_salt('bf', 12));
  INSERT INTO arthasync.users (username, password_hash, full_name, email)
  VALUES (p_username, v_hash, p_full_name, p_email)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION arthasync.create_user_with_bcrypt(TEXT, TEXT, TEXT, TEXT)
  OWNER TO arthasync_user;

-- 13. Dedicated immutability function for users (no updated_at on this table)
--     Cannot reuse prevent_immutable_updates() — it unconditionally sets NEW.updated_at
CREATE OR REPLACE FUNCTION arthasync.prevent_immutable_updates_users() RETURNS trigger AS $$
DECLARE
  i       INT;
  colname TEXT;
  oldval  TEXT;
  newval  TEXT;
BEGIN
  FOR i IN 0..TG_NARGS-1 LOOP
    colname := TG_ARGV[i];
    EXECUTE format('SELECT ($1).%I::text', colname) INTO oldval USING OLD;
    EXECUTE format('SELECT ($1).%I::text', colname) INTO newval USING NEW;
    IF oldval IS DISTINCT FROM newval THEN
      RAISE EXCEPTION 'Attempt to modify immutable column % on table %', colname, TG_TABLE_NAME;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_immutable ON arthasync.users;
CREATE TRIGGER trg_users_immutable
BEFORE UPDATE ON arthasync.users
FOR EACH ROW
EXECUTE FUNCTION arthasync.prevent_immutable_updates_users('username');

-- 14. Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE arthasync.users TO arthasync_user;

-- 15 File Uploads Table
CREATE TABLE IF NOT EXISTS arthasync.file_uploads (
    file_id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    suffix TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    extracted_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);