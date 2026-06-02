-- test_arthasync.sql
-- commands with "\" should be run after in postgres shell
-- 1. Basic info
SELECT current_database() AS db, inet_server_addr() AS server_ip, inet_server_port() AS server_port;
-- \dx 

-- 2. Schemas and tables
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'arthasync%';
-- \dt arthasync.*

-- 3. Describe tables
-- \d+ arthasync.sales
-- \d+ arthasync.purchase
-- \d+ arthasync.quotation
-- \d+ arthasync.expense
-- \d+ arthasync.ledger
-- \d+ arthasync.users
-- \d+ arthasync.file_uploads

-- 4. Indexes and triggers (examples)
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'arthasync' AND tablename = 'sales';
SELECT tgname, pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid = 'arthasync.sales'::regclass;

-- 5. Row counts before tests
SELECT 'sales' AS tbl, count(*) FROM arthasync.sales
UNION ALL SELECT 'purchase', count(*) FROM arthasync.purchase
UNION ALL SELECT 'quotation', count(*) FROM arthasync.quotation
UNION ALL SELECT 'expense', count(*) FROM arthasync.expense
UNION ALL SELECT 'ledger', count(*) FROM arthasync.ledger
UNION ALL SELECT 'users', count(*) FROM arthasync.users;

-- 6. Insert one test row into each table and return computed/generated columns
-- Sales test
INSERT INTO arthasync.sales (invoice_number, invoice_date, customer_name, items, subtotal, cgst_amount, sgst_amount, grand_total)
VALUES ('TEST-S-001', current_date, 'Test Customer', '[]'::jsonb, 1000.00, 90.00, 90.00, 1180.00)
RETURNING id, invoice_number, total_tax, amount_due;

-- Purchase test
INSERT INTO arthasync.purchase (invoice_number, invoice_date, vendor_name, items, subtotal, cgst_amount, sgst_amount, grand_total)
VALUES ('TEST-P-001', current_date, 'Test Vendor', '[]'::jsonb, 500.00, 45.00, 45.00, 590.00)
RETURNING id, invoice_number, total_tax, amount_due;

-- Quotation test
INSERT INTO arthasync.quotation (quotation_no, quotation_date, customer_name, items, subtotal, cgst_amount, sgst_amount, grand_total)
VALUES ('TEST-Q-001', current_date, 'Quote Customer', '[]'::jsonb, 200.00, 18.00, 18.00, 236.00)
RETURNING id, quotation_no, total_tax, grand_total;

-- Expense test
INSERT INTO arthasync.expense (expense_id, date, expense_category, vendor_name, vendor_email, expense_amount, gst_applicable, gst_percent, gst_amount, amount_paid)
VALUES ('TEST-E-001', current_date, 'Office', 'Test Vendor', 'vendor@example.com', 100.00, true, 18.00, 18.00, 20.00)
RETURNING id, expense_id, total_amount, amount_due;

-- Ledger test
INSERT INTO arthasync.ledger (entry_id, date, source_type, party, party_mail, direction, amount)
VALUES ('TEST-L-001', current_date, 'invoice', 'Test Party', 'party@example.com', 'in', 1180.00)
RETURNING id, entry_id, amount;

-- Users test
-- Phone must be set separately via UPDATE since the helper predates the phone column.
-- Option A: use helper function (pgcrypto must be available)
SELECT arthasync.create_user_with_bcrypt(
  'testuser',
  'TestPassword123!',
  'Test User',
  'testuser@example.com'
) AS created_user_id;

-- Set phone separately after insert (format: +CountryCode-Number)
UPDATE arthasync.users
  SET phone = '+91-9999999999'
  WHERE username ILIKE 'testuser';

-- Option B: insert directly if you already have a bcrypt hash
--           Phone must be in +CountryCode-Number format to pass CHECK constraint
-- INSERT INTO arthasync.users (username, password_hash, full_name, email, phone)
-- VALUES ('testuser2', '$2b$12$examplehashplaceholder..............', 'Test User 2', 'testuser2@example.com', '+91-8888888888')
-- RETURNING id, username;

-- 7. Validate generated columns and computed values
SELECT invoice_number, total_tax, grand_total, amount_paid, amount_due FROM arthasync.sales WHERE invoice_number = 'TEST-S-001';
SELECT invoice_number, total_tax, grand_total, amount_due FROM arthasync.purchase WHERE invoice_number = 'TEST-P-001';
SELECT quotation_no, total_tax, grand_total FROM arthasync.quotation WHERE quotation_no = 'TEST-Q-001';
SELECT expense_id, total_amount, amount_due FROM arthasync.expense WHERE expense_id = 'TEST-E-001';
SELECT entry_id, amount FROM arthasync.ledger WHERE entry_id = 'TEST-L-001';

SELECT id, username, full_name, email, phone, created_at, last_login
  FROM arthasync.users
  WHERE username ILIKE 'testuser';

-- Verify password with crypt() (pgcrypto) — returns row only when password matches
SELECT id, username
  FROM arthasync.users
  WHERE username ILIKE 'testuser'
    AND password_hash = crypt('TestPassword123!', password_hash);

-- 8. Test immutability triggers (these should raise exceptions)
-- Attempt to change immutable business key on sales (expected to fail)
BEGIN;
UPDATE arthasync.sales SET invoice_number = 'TEST-S-001-CHG' WHERE invoice_number = 'TEST-S-001';
ROLLBACK;

-- Attempt allowed update (should succeed)
UPDATE arthasync.sales SET remark = 'updated remark', amount_paid = 200.00 WHERE invoice_number = 'TEST-S-001';
SELECT invoice_number, amount_paid, amount_due, updated_at FROM arthasync.sales WHERE invoice_number = 'TEST-S-001';
BEGIN;
UPDATE arthasync.users SET username = 'testuser-changed' WHERE username ILIKE 'testuser';
ROLLBACK;
UPDATE arthasync.users
  SET full_name  = 'Test User Updated',
      phone      = '+91-9999999999',
      last_login = now()
  WHERE username ILIKE 'testuser';

SELECT id, username, full_name, email, phone, last_login
  FROM arthasync.users
  WHERE username ILIKE 'testuser';

-- 9. Row counts after tests
SELECT 'sales' AS tbl, count(*) FROM arthasync.sales
UNION ALL SELECT 'purchase', count(*) FROM arthasync.purchase
UNION ALL SELECT 'quotation', count(*) FROM arthasync.quotation
UNION ALL SELECT 'expense', count(*) FROM arthasync.expense
UNION ALL SELECT 'ledger', count(*) FROM arthasync.ledger
UNION ALL SELECT 'users', count(*) FROM arthasync.users;

-- 10. Cleanup test rows (uncomment to remove test data)
-- DELETE FROM arthasync.sales WHERE invoice_number = 'TEST-S-001';
-- DELETE FROM arthasync.purchase WHERE invoice_number = 'TEST-P-001';
-- DELETE FROM arthasync.quotation WHERE quotation_no = 'TEST-Q-001';
-- DELETE FROM arthasync.expense WHERE expense_id = 'TEST-E-001';
-- DELETE FROM arthasync.ledger WHERE entry_id = 'TEST-L-001';
-- DELETE FROM arthasync.users WHERE username ILIKE 'testuser';
-- DELETE FROM arthasync.users WHERE username ILIKE 'testuser2';

-- 11. Final check of triggers present (includes users)
SELECT tgname, pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid IN (
  'arthasync.sales'::regclass,
  'arthasync.purchase'::regclass,
  'arthasync.quotation'::regclass,
  'arthasync.expense'::regclass,
  'arthasync.ledger'::regclass,
  'arthasync.users'::regclass
);