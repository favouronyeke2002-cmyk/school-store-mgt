CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_name
  ON expense_categories (LOWER(name));

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_categories_select" ON expense_categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "expense_categories_insert" ON expense_categories
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "expense_categories_update" ON expense_categories
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "expense_categories_delete" ON expense_categories
  FOR DELETE TO anon, authenticated USING (true);

GRANT ALL ON expense_categories TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE expense_categories_id_seq TO anon, authenticated;

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

INSERT INTO expense_categories (name)
VALUES
  ('Utilities'),
  ('Supplies'),
  ('Maintenance'),
  ('Transportation'),
  ('Salaries'),
  ('Equipment'),
  ('Miscellaneous'),
  ('Other'),
  ('Water Tanker'),
  ('Generator Fuel'),
  ('Kitchen Supplies'),
  ('Repairs')
ON CONFLICT DO NOTHING;

INSERT INTO expense_categories (name)
SELECT DISTINCT category
FROM expenses
WHERE NULLIF(TRIM(category), '') IS NOT NULL
ON CONFLICT DO NOTHING;
