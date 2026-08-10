-- The Supabase client uses the anon key, but existing policies on
-- student_book_issuances and ledger_entries are scoped to {authenticated} only,
-- causing 401 Unauthorized on inserts from the browser.
-- Add anon role to all CRUD policies on both tables.

-- student_book_issuances: replace authenticated-only policies with anon+authenticated
DROP POLICY IF EXISTS "select_issuances" ON student_book_issuances;
CREATE POLICY "select_issuances" ON student_book_issuances FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_issuances" ON student_book_issuances;
CREATE POLICY "insert_issuances" ON student_book_issuances FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_issuances" ON student_book_issuances;
CREATE POLICY "update_issuances" ON student_book_issuances FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_issuances" ON student_book_issuances;
CREATE POLICY "delete_issuances" ON student_book_issuances FOR DELETE
  TO anon, authenticated USING (true);

-- ledger_entries: replace authenticated-only policies with anon+authenticated
DROP POLICY IF EXISTS "select_ledger" ON ledger_entries;
CREATE POLICY "select_ledger" ON ledger_entries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_ledger" ON ledger_entries;
CREATE POLICY "insert_ledger" ON ledger_entries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ledger" ON ledger_entries;
CREATE POLICY "update_ledger" ON ledger_entries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_ledger" ON ledger_entries;
CREATE POLICY "delete_ledger" ON ledger_entries FOR DELETE
  TO anon, authenticated USING (true);