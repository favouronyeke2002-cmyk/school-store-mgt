-- ============================================================
--  PRODUCTION RESET: Wipe Mock / Seed Transactional Data
--  Run this ONCE via the Supabase SQL Editor (Dashboard).
--
--  PRESERVES (untouched):
--    pos_users          — admin & cashier login accounts
--    school_settings    — school name, logo, session config
--    inventory          — product catalogue & stock levels
--    inventory_categories — product category groups
--    fee_types          — fee definitions (school fee templates)
--    bundles            — bundle definitions (acceptance / registration)
--    bundle_items       — items linked to each bundle
--
--  CLEARS (mock / seed transactional data):
--    transaction_items  — purchase line items
--    applicant_payments — partial payment ledger for applicants
--    stock_adjustments  — manual stock change log
--    student_fees       — per-student fee ledger rows
--    transactions       — master transaction log (receipts)
--    shifts             — cashier shift records
--    applicants         — walk-in / pending admission records
--    students           — student directory
--
--  RESETS serial sequences so that:
--    • First real transaction_id  → 1  (receipt #0001)
--    • First real shift id        → 1
--    • First real applicant id    → 1
--    • All other cleared serials  → 1
--    • students.student_id is app-generated (TEXT, no sequence);
--      once the table is empty the app will issue OIS-0001 next.
-- ============================================================

BEGIN;

-- ── 1. LEAF TABLES (depend on deeper tables; clear first) ────────────────────

-- Line items that belong to transactions (CASCADE from transactions,
-- but we truncate here first to satisfy the inventory RESTRICT FK)
TRUNCATE TABLE transaction_items RESTART IDENTITY;

-- Applicant partial-payment ledger (child of applicants)
TRUNCATE TABLE applicant_payments RESTART IDENTITY;

-- Manual stock change log (child of inventory, which we keep)
TRUNCATE TABLE stock_adjustments  RESTART IDENTITY;

-- Per-student fee rows (child of students AND fee_types; keep fee_types)
TRUNCATE TABLE student_fees       RESTART IDENTITY;

-- ── 2. MID-LEVEL TABLES ──────────────────────────────────────────────────────

-- Master receipt / transaction log
-- student_id is nullable (SET NULL semantics via app logic);
-- all transaction_items already cleared above so no RESTRICT block.
TRUNCATE TABLE transactions       RESTART IDENTITY;

-- Cashier shift records (pos_users is preserved; shifts are transactional)
TRUNCATE TABLE shifts             RESTART IDENTITY;

-- Walk-in applicants (enrolled_student_id FK → students is ON DELETE SET NULL,
-- so this is safe to clear before or after students)
TRUNCATE TABLE applicants         RESTART IDENTITY;

-- ── 3. ROOT STUDENT TABLE ────────────────────────────────────────────────────

-- students uses a TEXT primary key (e.g. OIS-0001) — no DB sequence.
-- The application reads all existing IDs and issues the next one, so
-- once this table is empty the very next enrolment becomes OIS-0001.
DELETE FROM students;

-- ── 4. SANITY CHECKS (informational — will appear in SQL Editor output) ──────

DO $$
DECLARE
  student_count       INTEGER;
  txn_count           INTEGER;
  shift_count         INTEGER;
  applicant_count     INTEGER;
  student_fee_count   INTEGER;
  txn_item_count      INTEGER;
  adj_count           INTEGER;
  appl_pay_count      INTEGER;
  user_count          INTEGER;
  inventory_count     INTEGER;
  fee_type_count      INTEGER;
BEGIN
  SELECT COUNT(*) INTO student_count     FROM students;
  SELECT COUNT(*) INTO txn_count         FROM transactions;
  SELECT COUNT(*) INTO shift_count       FROM shifts;
  SELECT COUNT(*) INTO applicant_count   FROM applicants;
  SELECT COUNT(*) INTO student_fee_count FROM student_fees;
  SELECT COUNT(*) INTO txn_item_count    FROM transaction_items;
  SELECT COUNT(*) INTO adj_count         FROM stock_adjustments;
  SELECT COUNT(*) INTO appl_pay_count    FROM applicant_payments;
  SELECT COUNT(*) INTO user_count        FROM pos_users;
  SELECT COUNT(*) INTO inventory_count   FROM inventory;
  SELECT COUNT(*) INTO fee_type_count    FROM fee_types;

  RAISE NOTICE '─────────────────────────────────────────────';
  RAISE NOTICE 'CLEARED TABLES (all must be 0):';
  RAISE NOTICE '  students           : %', student_count;
  RAISE NOTICE '  transactions       : %', txn_count;
  RAISE NOTICE '  transaction_items  : %', txn_item_count;
  RAISE NOTICE '  shifts             : %', shift_count;
  RAISE NOTICE '  applicants         : %', applicant_count;
  RAISE NOTICE '  applicant_payments : %', appl_pay_count;
  RAISE NOTICE '  student_fees       : %', student_fee_count;
  RAISE NOTICE '  stock_adjustments  : %', adj_count;
  RAISE NOTICE '─────────────────────────────────────────────';
  RAISE NOTICE 'PRESERVED TABLES (must be > 0):';
  RAISE NOTICE '  pos_users          : %', user_count;
  RAISE NOTICE '  inventory          : %', inventory_count;
  RAISE NOTICE '  fee_types          : %', fee_type_count;
  RAISE NOTICE '─────────────────────────────────────────────';

  -- Abort if anything that should be preserved was accidentally emptied
  IF user_count = 0 THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: pos_users is empty — aborting rollback!';
  END IF;
  IF inventory_count = 0 THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: inventory is empty — aborting rollback!';
  END IF;

  RAISE NOTICE 'All checks passed. Reset complete.';
END $$;

COMMIT;
