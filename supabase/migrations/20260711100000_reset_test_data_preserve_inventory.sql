-- ============================================================
--  PRODUCTION RESET (2026-07-11): Wipe All Test/Seed Data
--  Run ONCE via the Supabase Dashboard → SQL Editor.
--
--  PRESERVES (untouched):
--    pos_users            — admin & cashier login accounts
--    school_settings      — school name, logo, session config
--    inventory            — 48 product items · 3,744 units ← DO NOT TOUCH
--    inventory_categories — product category groups
--    fee_types            — fee template definitions (keep configured fees)
--    bundles              — acceptance & registration bundle definitions
--    bundle_items         — items linked to each bundle
--
--  CLEARS (transactional / people data only):
--    transaction_items    — purchase line items            (74 rows)
--    stock_adjustments    — manual stock change log         (3 rows)
--    transactions         — master transaction log         (29 rows)
--    expenses             — operational expenses            (1 row — already cleared)
--    shifts               — cashier shift records           (5 rows)
--    applicant_payments   — partial-payment ledger          (1 row — already cleared)
--    student_fees         — per-student fee ledger         (17 rows — already cleared)
--    applicants           — pending / enrolled applicants   (4 rows — already cleared)
--    students             — student directory              (15 rows)
--
--  SEQUENCE RESETS:
--    All serial PKs reset to 1 so first real receipt  → #1
--                              first real shift       → #1
--                              first real applicant   → #1
-- ============================================================

BEGIN;

-- ── SAFETY GUARD: abort immediately if inventory would be damaged ─────────────
DO $$
DECLARE
  inv_count  INTEGER;
  inv_units  NUMERIC;
BEGIN
  SELECT COUNT(*),  SUM(stock_quantity) INTO inv_count, inv_units FROM inventory;
  IF inv_count = 0 THEN
    RAISE EXCEPTION 'SAFETY ABORT: inventory table is empty — refusing to run reset!';
  END IF;
  RAISE NOTICE 'Pre-reset inventory: % items, % total units — safe to proceed.', inv_count, inv_units;
END $$;

-- ── STEP 1 · Financial leaf tables (children of transactions / inventory) ─────
TRUNCATE TABLE
  transaction_items,   -- line items per receipt
  stock_adjustments    -- audit log of manual stock changes
RESTART IDENTITY CASCADE;

-- ── STEP 2 · Master transaction log ──────────────────────────────────────────
TRUNCATE TABLE
  transactions         -- every receipt, fees collection, and bundle payment
RESTART IDENTITY CASCADE;

-- ── STEP 3 · Shift-linked operational data ───────────────────────────────────
TRUNCATE TABLE
  expenses             -- generator fuel, supplies, etc. (FK → shifts SET NULL)
RESTART IDENTITY CASCADE;

TRUNCATE TABLE
  shifts               -- cashier open/close sessions
RESTART IDENTITY CASCADE;

-- ── STEP 4 · People & ledger data ────────────────────────────────────────────
TRUNCATE TABLE
  applicant_payments,  -- partial-payment tracking per applicant/bundle
  student_fees         -- per-student fee ledger (amount_due / amount_paid)
RESTART IDENTITY CASCADE;

TRUNCATE TABLE
  applicants           -- walk-in admission applicants
RESTART IDENTITY CASCADE;

TRUNCATE TABLE
  students             -- enrolled student directory
RESTART IDENTITY CASCADE;

-- ── POST-RESET VERIFICATION ───────────────────────────────────────────────────
DO $$
DECLARE
  c_txn_items     INTEGER; c_stock_adj    INTEGER;
  c_transactions  INTEGER; c_expenses     INTEGER;
  c_shifts        INTEGER; c_appl_pay     INTEGER;
  c_student_fees  INTEGER; c_applicants   INTEGER;
  c_students      INTEGER;
  c_inventory     INTEGER; c_inv_units    NUMERIC;
  c_users         INTEGER; c_fee_types    INTEGER;
  c_bundles       INTEGER;
BEGIN
  SELECT COUNT(*) INTO c_txn_items     FROM transaction_items;
  SELECT COUNT(*) INTO c_stock_adj     FROM stock_adjustments;
  SELECT COUNT(*) INTO c_transactions  FROM transactions;
  SELECT COUNT(*) INTO c_expenses      FROM expenses;
  SELECT COUNT(*) INTO c_shifts        FROM shifts;
  SELECT COUNT(*) INTO c_appl_pay      FROM applicant_payments;
  SELECT COUNT(*) INTO c_student_fees  FROM student_fees;
  SELECT COUNT(*) INTO c_applicants    FROM applicants;
  SELECT COUNT(*) INTO c_students      FROM students;

  SELECT COUNT(*), SUM(stock_quantity) INTO c_inventory, c_inv_units FROM inventory;
  SELECT COUNT(*) INTO c_users         FROM pos_users;
  SELECT COUNT(*) INTO c_fee_types     FROM fee_types;
  SELECT COUNT(*) INTO c_bundles       FROM bundles;

  RAISE NOTICE '══════════════════════════════════════════════';
  RAISE NOTICE 'CLEARED TABLES (all must be 0):';
  RAISE NOTICE '  transaction_items  : %', c_txn_items;
  RAISE NOTICE '  stock_adjustments  : %', c_stock_adj;
  RAISE NOTICE '  transactions       : %', c_transactions;
  RAISE NOTICE '  expenses           : %', c_expenses;
  RAISE NOTICE '  shifts             : %', c_shifts;
  RAISE NOTICE '  applicant_payments : %', c_appl_pay;
  RAISE NOTICE '  student_fees       : %', c_student_fees;
  RAISE NOTICE '  applicants         : %', c_applicants;
  RAISE NOTICE '  students           : %', c_students;
  RAISE NOTICE '──────────────────────────────────────────────';
  RAISE NOTICE 'PRESERVED TABLES (must be > 0):';
  RAISE NOTICE '  inventory          : % items  /  % units', c_inventory, c_inv_units;
  RAISE NOTICE '  pos_users          : %', c_users;
  RAISE NOTICE '  fee_types          : %', c_fee_types;
  RAISE NOTICE '  bundles            : %', c_bundles;
  RAISE NOTICE '══════════════════════════════════════════════';

  -- Hard fail if anything preserved was accidentally wiped
  IF c_users = 0 THEN
    RAISE EXCEPTION 'INTEGRITY FAILURE: pos_users is empty — rolling back!';
  END IF;
  IF c_inventory = 0 THEN
    RAISE EXCEPTION 'INTEGRITY FAILURE: inventory is empty — rolling back!';
  END IF;

  -- Fail if any cleared table still has rows
  IF c_students > 0 OR c_transactions > 0 OR c_shifts > 0
     OR c_txn_items > 0 OR c_applicants > 0 OR c_student_fees > 0 THEN
    RAISE EXCEPTION 'INTEGRITY FAILURE: one or more cleared tables still have rows — rolling back!';
  END IF;

  RAISE NOTICE 'All checks passed — reset complete.';
END $$;

COMMIT;
