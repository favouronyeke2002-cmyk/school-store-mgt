/*
# Add School Settings, Inventory Categories, and Fee Management

1. New Tables
  - `school_settings`: Singleton config row for receipt customization.
    - id (always 1), school_name, tagline, phone_number, logo_url, academic_session, address, created_at, updated_at
  - `inventory_categories`: Category groups for inventory items.
    - id (serial), name (unique), color (hex), created_at
  - `fee_types`: Named school fees that can be assigned to classes or students.
    - id (serial), name, description, academic_session, amount (default), class_filter (nullable text),
      created_at
  - `student_fees`: Per-student fee ledger rows (one per fee_type per student).
    - id (serial), student_id (FK), fee_type_id (FK), amount_due, amount_paid (default 0), created_at

2. Modified Tables
  - `inventory`: Add category_id (FK → inventory_categories, nullable)
  - `transactions`: Add fee_type_id (FK → fee_types, nullable) for fee payment traceability

3. Security
  - RLS enabled on all new tables, anon+authenticated CRUD (single-tenant POS)

4. Seed Data
  - Default school settings row (id=1)
  - 4 default inventory categories (Stationery, Uniform, Textbooks, Snacks)
*/

-- ── school_settings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  school_name TEXT NOT NULL DEFAULT 'School Store',
  tagline TEXT NOT NULL DEFAULT 'Excellence in Education',
  phone_number TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  academic_session TEXT NOT NULL DEFAULT '2025/2026',
  address TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON school_settings;
CREATE POLICY "settings_select" ON school_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "settings_insert" ON school_settings;
CREATE POLICY "settings_insert" ON school_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "settings_update" ON school_settings;
CREATE POLICY "settings_update" ON school_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO school_settings (id, school_name, tagline, phone_number, academic_session, address)
VALUES (1, 'School Store', 'Excellence in Education', '', '2025/2026', '')
ON CONFLICT (id) DO NOTHING;

-- ── inventory_categories ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_cat_select" ON inventory_categories;
CREATE POLICY "inv_cat_select" ON inventory_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "inv_cat_insert" ON inventory_categories;
CREATE POLICY "inv_cat_insert" ON inventory_categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "inv_cat_update" ON inventory_categories;
CREATE POLICY "inv_cat_update" ON inventory_categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "inv_cat_delete" ON inventory_categories;
CREATE POLICY "inv_cat_delete" ON inventory_categories FOR DELETE TO anon, authenticated USING (true);

INSERT INTO inventory_categories (name, color) VALUES
  ('Stationery',  '#3b82f6'),
  ('Uniform',     '#8b5cf6'),
  ('Textbooks',   '#f59e0b'),
  ('Snacks',      '#10b981')
ON CONFLICT (name) DO NOTHING;

-- ── Add category_id to inventory ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE inventory ADD COLUMN category_id INTEGER REFERENCES inventory_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── fee_types ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  academic_session TEXT NOT NULL DEFAULT '2025/2026',
  amount NUMERIC NOT NULL DEFAULT 0.00,
  class_filter TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fee_types_select" ON fee_types;
CREATE POLICY "fee_types_select" ON fee_types FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "fee_types_insert" ON fee_types;
CREATE POLICY "fee_types_insert" ON fee_types FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "fee_types_update" ON fee_types;
CREATE POLICY "fee_types_update" ON fee_types FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "fee_types_delete" ON fee_types;
CREATE POLICY "fee_types_delete" ON fee_types FOR DELETE TO anon, authenticated USING (true);

-- ── student_fees (per-student fee ledger) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_fees (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  fee_type_id INTEGER NOT NULL REFERENCES fee_types(id) ON DELETE CASCADE,
  amount_due NUMERIC NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, fee_type_id)
);

CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_fee_type ON student_fees(fee_type_id);

ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sf_select" ON student_fees;
CREATE POLICY "sf_select" ON student_fees FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sf_insert" ON student_fees;
CREATE POLICY "sf_insert" ON student_fees FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sf_update" ON student_fees;
CREATE POLICY "sf_update" ON student_fees FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sf_delete" ON student_fees;
CREATE POLICY "sf_delete" ON student_fees FOR DELETE TO anon, authenticated USING (true);

-- ── Add fee_type_id to transactions ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'fee_type_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN fee_type_id INTEGER REFERENCES fee_types(id) ON DELETE SET NULL;
  END IF;
END $$;
