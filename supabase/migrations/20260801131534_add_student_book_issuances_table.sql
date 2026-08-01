/*
# Create student_book_issuances table (pending fulfillment)

1. Purpose
   When a parent pays for a bundle (acceptance fee, registration, etc.) that
   contains items temporarily out of stock, the paid-but-unfulfilled items are
   tracked here so staff can deliver them when stock arrives.

2. New Table: student_book_issuances
   - id (serial, PK)
   - student_id (text, nullable — links to students.student_id; nullable because
     applicants may not yet be enrolled as students at payment time)
   - applicant_id (integer, nullable — links to applicants.id for pre-enrollment)
   - transaction_id (integer, nullable — links to transactions.transaction_id)
   - item_id (integer, nullable — links to inventory.item_id)
   - book_name (text, not null) — snapshot of the item name at time of payment
   - quantity (integer, not null, default 1)
   - status (text, not null, default 'unassigned') — 'unassigned' | 'assigned'
   - created_at (timestamptz, default now())
   - assigned_at (timestamptz, nullable)
   - assigned_by (integer, nullable — user id of staff who fulfilled)

3. Security
   - Enable RLS on student_book_issuances.
   - This app has a sign-in screen, so policies are scoped to authenticated.
   - Full CRUD for authenticated users (cashiers and admins manage fulfillment).

4. Indexes
   - Index on student_id for per-student lookups.
   - Index on status for pending-item queries.
*/

CREATE TABLE IF NOT EXISTS student_book_issuances (
  id serial PRIMARY KEY,
  student_id text,
  applicant_id integer,
  transaction_id integer,
  item_id integer,
  book_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'unassigned',
  created_at timestamptz DEFAULT now(),
  assigned_at timestamptz,
  assigned_by integer
);

ALTER TABLE student_book_issuances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_issuances" ON student_book_issuances;
CREATE POLICY "select_issuances" ON student_book_issuances FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_issuances" ON student_book_issuances;
CREATE POLICY "insert_issuances" ON student_book_issuances FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_issuances" ON student_book_issuances;
CREATE POLICY "update_issuances" ON student_book_issuances FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_issuances" ON student_book_issuances;
CREATE POLICY "delete_issuances" ON student_book_issuances FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_issuances_student_id ON student_book_issuances(student_id);
CREATE INDEX IF NOT EXISTS idx_issuances_status ON student_book_issuances(status);
CREATE INDEX IF NOT EXISTS idx_issuances_applicant_id ON student_book_issuances(applicant_id);
