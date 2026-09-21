/*
# Add Bundles, Applicants, Enrollment Eligibility, Partial Payment Settings

1. New Tables
  - `bundles`: Named product bundles with lump-sum pricing
    - id, name, description, base_price, bundle_type, is_active, created_at
  - `bundle_items`: Links bundles to inventory items with quantities
    - id, bundle_id, item_id, quantity, created_at
  - `applicants`: Walk-in applicants pending enrollment
    - id, first_name, last_name, proposed_class, phone, status, eligible_at, enrolled_student_id, created_at

2. Modified Tables
  - `school_settings`: Add min_partial_payment_floor, min_acceptance_partial_floor
  - `students`: Add enrollment_status ('pending' | 'eligible' | 'enrolled')
  - `transactions`: Add applicant_id for walk-in transactions, bundle_id for bundle purchases

3. Security
  - RLS enabled on all new tables with anon+authenticated CRUD

4. Seed Data
  - Hard Copy Admission Form inventory item
  - Bible inventory item
  - Morning Assembly Manual inventory item
  - Uniform Set inventory item
  - Textbook Pack inventory item
  - Long Notes inventory item
  - Short Notes inventory item
  - Acceptance Fee Bundle (Bible + Manual)
  - Registration Fee Bundle (Uniform + Textbook + Long Notes 14 + Short Notes 12)
*/

-- ── Add partial payment floor to school_settings ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'school_settings' AND column_name = 'min_partial_payment_floor'
  ) THEN
    ALTER TABLE school_settings ADD COLUMN min_partial_payment_floor NUMERIC NOT NULL DEFAULT 30000;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'school_settings' AND column_name = 'min_acceptance_partial_floor'
  ) THEN
    ALTER TABLE school_settings ADD COLUMN min_acceptance_partial_floor NUMERIC NOT NULL DEFAULT 5000;
  END IF;
END $$;

-- ── Add enrollment_status to students ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'enrollment_status'
  ) THEN
    ALTER TABLE students ADD COLUMN enrollment_status TEXT NOT NULL DEFAULT 'enrolled'
      CHECK (enrollment_status IN ('pending', 'eligible', 'enrolled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_enrollment_status ON students(enrollment_status);

-- ── bundles table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0.00,
  bundle_type TEXT NOT NULL DEFAULT 'registration' CHECK (bundle_type IN ('acceptance', 'registration', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bundles_select" ON bundles;
CREATE POLICY "bundles_select" ON bundles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "bundles_insert" ON bundles;
CREATE POLICY "bundles_insert" ON bundles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "bundles_update" ON bundles;
CREATE POLICY "bundles_update" ON bundles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bundles_delete" ON bundles;
CREATE POLICY "bundles_delete" ON bundles FOR DELETE TO anon, authenticated USING (true);

-- ── bundle_items table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundle_items (
  id SERIAL PRIMARY KEY,
  bundle_id INTEGER NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES inventory(item_id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (bundle_id, item_id)
);

ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bundle_items_select" ON bundle_items;
CREATE POLICY "bundle_items_select" ON bundle_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "bundle_items_insert" ON bundle_items;
CREATE POLICY "bundle_items_insert" ON bundle_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "bundle_items_update" ON bundle_items;
CREATE POLICY "bundle_items_update" ON bundle_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bundle_items_delete" ON bundle_items;
CREATE POLICY "bundle_items_delete" ON bundle_items FOR DELETE TO anon, authenticated USING (true);

-- ── applicants table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applicants (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  proposed_class TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'eligible', 'enrolled')),
  eligible_at TIMESTAMPTZ,
  enrolled_student_id TEXT REFERENCES students(student_id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_enrolled_student ON applicants(enrolled_student_id);

ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applicants_select" ON applicants;
CREATE POLICY "applicants_select" ON applicants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "applicants_insert" ON applicants;
CREATE POLICY "applicants_insert" ON applicants FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "applicants_update" ON applicants;
CREATE POLICY "applicants_update" ON applicants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "applicants_delete" ON applicants;
CREATE POLICY "applicants_delete" ON applicants FOR DELETE TO anon, authenticated USING (true);

-- ── Add applicant_id and bundle_id to transactions ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'applicant_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN applicant_id INTEGER REFERENCES applicants(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'bundle_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN bundle_id INTEGER REFERENCES bundles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Make student_id nullable to support applicant transactions
ALTER TABLE transactions ALTER COLUMN student_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_applicant ON transactions(applicant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bundle ON transactions(bundle_id);

-- ── applicant_payments table (tracks partial payments on bundles/fees) ─────────
CREATE TABLE IF NOT EXISTS applicant_payments (
  id SERIAL PRIMARY KEY,
  applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  bundle_id INTEGER REFERENCES bundles(id) ON DELETE SET NULL,
  fee_type_id INTEGER REFERENCES fee_types(id) ON DELETE SET NULL,
  amount_due NUMERIC NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applicant_payments_applicant ON applicant_payments(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applicant_payments_bundle ON applicant_payments(bundle_id);

ALTER TABLE applicant_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applicant_payments_select" ON applicant_payments;
CREATE POLICY "applicant_payments_select" ON applicant_payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "applicant_payments_insert" ON applicant_payments;
CREATE POLICY "applicant_payments_insert" ON applicant_payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "applicant_payments_update" ON applicant_payments;
CREATE POLICY "applicant_payments_update" ON applicant_payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "applicant_payments_delete" ON applicant_payments;
CREATE POLICY "applicant_payments_delete" ON applicant_payments FOR DELETE TO anon, authenticated USING (true);

-- ── Seed new inventory items for bundles ─────────────────────────────────────
-- First ensure the categories exist
INSERT INTO inventory_categories (name, color) VALUES
  ('Admission Materials', '#f97316'),
  ('Religious Items', '#059669')
ON CONFLICT (name) DO NOTHING;

-- Get category IDs (will be used application-side, but we can reference by name)
-- Hard Copy Admission Form
INSERT INTO inventory (item_name, barcode, cost_price, selling_price, stock_quantity, category_id)
SELECT 'Hard Copy Admission Form', 'ADM-001', 500, 3000, 200, id
FROM inventory_categories WHERE name = 'Admission Materials'
ON CONFLICT (barcode) DO NOTHING;

-- Bible
INSERT INTO inventory (item_name, barcode, cost_price, selling_price, stock_quantity, category_id)
SELECT 'Holy Bible', 'BIB-001', 1500, 3500, 150, id
FROM inventory_categories WHERE name = 'Religious Items'
ON CONFLICT (barcode) DO NOTHING;

-- Morning Assembly Manual
INSERT INTO inventory (item_name, barcode, cost_price, selling_price, stock_quantity, category_id)
SELECT 'Morning Assembly Manual', 'MAN-001', 300, 800, 150, id
FROM inventory_categories WHERE name = 'Admission Materials'
ON CONFLICT (barcode) DO NOTHING;

-- Uniform Set (complete set)
INSERT INTO inventory (item_name, barcode, cost_price, selling_price, stock_quantity, category_id)
SELECT 'Complete Uniform Set', 'UNI-SET-001', 8000, 15000, 100, id
FROM inventory_categories WHERE name = 'Uniform'
ON CONFLICT (barcode) DO NOTHING;

-- Textbook Pack (complete pack for a class)
INSERT INTO inventory (item_name, barcode, cost_price, selling_price, stock_quantity, category_id)
SELECT 'Complete Textbook Pack', 'TXT-PACK-001', 25000, 45000, 80, id
FROM inventory_categories WHERE name = 'Textbooks'
ON CONFLICT (barcode) DO NOTHING;

-- Long Notes (exercise books, configurable quantity)
INSERT INTO inventory (item_name, barcode, cost_price, selling_price, stock_quantity)
VALUES ('Long Notes (80pg Exercise Book)', 'LONG-NOTE-001', 50, 150, 500)
ON CONFLICT (barcode) DO NOTHING;

-- Short Notes (smaller exercise books, configurable quantity)  
INSERT INTO inventory (item_name, barcode, cost_price, selling_price, stock_quantity)
VALUES ('Short Notes (40pg Exercise Book)', 'SHORT-NOTE-001', 30, 80, 600)
ON CONFLICT (barcode) DO NOTHING;

-- ── Seed default bundles ───────────────────────────────────────────────────────
-- Acceptance Fee Bundle (Bible + Morning Assembly Manual)
INSERT INTO bundles (name, description, base_price, bundle_type, is_active)
VALUES ('Acceptance Fee Bundle', 'Includes Holy Bible and Morning Assembly Manual', 10000, 'acceptance', true)
RETURNING id;

-- Registration Fee Bundle  
INSERT INTO bundles (name, description, base_price, bundle_type, is_active)
VALUES ('Registration Fee Bundle', 'Complete registration package: Uniform Set, Textbook Pack, Long Notes (14), Short Notes (12)', 100000, 'registration', true)
RETURNING id;

-- Link bundle items (done via separate queries since we need the IDs)
-- We'll handle this in the app or via a function, but let's try:
DO $$
DECLARE
  acceptance_bundle_id INTEGER;
  registration_bundle_id INTEGER;
  bible_item_id INTEGER;
  manual_item_id INTEGER;
  uniform_item_id INTEGER;
  textbook_item_id INTEGER;
  long_note_id INTEGER;
  short_note_id INTEGER;
BEGIN
  -- Get bundle IDs
  SELECT id INTO acceptance_bundle_id FROM bundles WHERE name = 'Acceptance Fee Bundle';
  SELECT id INTO registration_bundle_id FROM bundles WHERE name = 'Registration Fee Bundle';
  
  -- Get item IDs
  SELECT item_id INTO bible_item_id FROM inventory WHERE barcode = 'BIB-001';
  SELECT item_id INTO manual_item_id FROM inventory WHERE barcode = 'MAN-001';
  SELECT item_id INTO uniform_item_id FROM inventory WHERE barcode = 'UNI-SET-001';
  SELECT item_id INTO textbook_item_id FROM inventory WHERE barcode = 'TXT-PACK-001';
  SELECT item_id INTO long_note_id FROM inventory WHERE barcode = 'LONG-NOTE-001';
  SELECT item_id INTO short_note_id FROM inventory WHERE barcode = 'SHORT-NOTE-001';
  
  -- Link acceptance bundle items
  IF acceptance_bundle_id IS NOT NULL AND bible_item_id IS NOT NULL THEN
    INSERT INTO bundle_items (bundle_id, item_id, quantity) VALUES (acceptance_bundle_id, bible_item_id, 1)
    ON CONFLICT (bundle_id, item_id) DO NOTHING;
  END IF;
  IF acceptance_bundle_id IS NOT NULL AND manual_item_id IS NOT NULL THEN
    INSERT INTO bundle_items (bundle_id, item_id, quantity) VALUES (acceptance_bundle_id, manual_item_id, 1)
    ON CONFLICT (bundle_id, item_id) DO NOTHING;
  END IF;
  
  -- Link registration bundle items
  IF registration_bundle_id IS NOT NULL AND uniform_item_id IS NOT NULL THEN
    INSERT INTO bundle_items (bundle_id, item_id, quantity) VALUES (registration_bundle_id, uniform_item_id, 1)
    ON CONFLICT (bundle_id, item_id) DO NOTHING;
  END IF;
  IF registration_bundle_id IS NOT NULL AND textbook_item_id IS NOT NULL THEN
    INSERT INTO bundle_items (bundle_id, item_id, quantity) VALUES (registration_bundle_id, textbook_item_id, 1)
    ON CONFLICT (bundle_id, item_id) DO NOTHING;
  END IF;
  IF registration_bundle_id IS NOT NULL AND long_note_id IS NOT NULL THEN
    INSERT INTO bundle_items (bundle_id, item_id, quantity) VALUES (registration_bundle_id, long_note_id, 14)
    ON CONFLICT (bundle_id, item_id) DO NOTHING;
  END IF;
  IF registration_bundle_id IS NOT NULL AND short_note_id IS NOT NULL THEN
    INSERT INTO bundle_items (bundle_id, item_id, quantity) VALUES (registration_bundle_id, short_note_id, 12)
    ON CONFLICT (bundle_id, item_id) DO NOTHING;
  END IF;
END $$;

-- ── Extend transaction type CHECK to include BUNDLE_PURCHASE ────────────────
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('STORE_PURCHASE', 'FEES_CASH_COLLECTION', 'REGISTRATION_PAYMENT', 'BUNDLE_PURCHASE', 'ACCEPTANCE_FEE'));
