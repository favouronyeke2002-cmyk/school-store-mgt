/*
# Complete Billing & Fulfillment Schema Upgrade

## 1. student_book_issuances — add bundle_name, item_name, stock_deducted
The existing table tracks out-of-stock items for later fulfillment. We now
also track ALL bundle items (in-stock and out-of-stock) so staff have a
complete record of what each student is owed. A `stock_deducted` boolean
records whether inventory was already decremented at payment time (in-stock
items) or still needs decrementing at fulfillment time (out-of-stock items).

New columns:
- bundle_name (text, nullable) — name of the bundle/fee package this item came from
- item_name (text, nullable) — renamed from book_name; keeps book_name for back-compat
- stock_deducted (boolean, default false) — true if inventory was decremented at payment

## 2. ledger_entries — new double-entry accounting table
Each fee payment writes TWO rows: a DEBIT (the charge/bill) and a CREDIT (the
payment). This gives every student a proper statement of account.

Columns:
- id (serial PK)
- student_id (text, not null)
- transaction_id (integer, nullable) — links to transactions table
- entry_type (text, not null) — 'debit' | 'credit'
- fee_type_name (text, not null) — e.g. "Tuition", "Acceptance Fee"
- amount (numeric, not null)
- payment_mode (text, nullable) — Cash, POS_Transfer, Bank_Transfer (credit rows only)
- cashier_name (text, nullable) — username of staff who processed (credit rows only)
- academic_term (text, nullable)
- created_at (timestamptz, default now())

## 3. transactions.status — ensure column exists with default 'completed'
The status column already exists from a prior migration. We ensure it has
the correct default so all new and existing rows are 'completed' unless voided.

## Security
- RLS enabled on ledger_entries, scoped to authenticated (app has sign-in).
- student_book_issuances already has RLS; we add policies for the new columns
  (existing policies already cover all columns, so no policy changes needed).
*/

-- ─── 1. student_book_issuances additions ─────────────────────────────────────
ALTER TABLE student_book_issuances
  ADD COLUMN IF NOT EXISTS bundle_name text;
ALTER TABLE student_book_issuances
  ADD COLUMN IF NOT EXISTS item_name text;
ALTER TABLE student_book_issuances
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

-- Backfill item_name from book_name for existing rows
UPDATE student_book_issuances
  SET item_name = book_name
  WHERE item_name IS NULL AND book_name IS NOT NULL;

-- ─── 2. ledger_entries table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  id serial PRIMARY KEY,
  student_id text NOT NULL,
  transaction_id integer,
  entry_type text NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  fee_type_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_mode text,
  cashier_name text,
  academic_term text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ledger" ON ledger_entries;
CREATE POLICY "select_ledger" ON ledger_entries FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ledger" ON ledger_entries;
CREATE POLICY "insert_ledger" ON ledger_entries FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ledger" ON ledger_entries;
CREATE POLICY "update_ledger" ON ledger_entries FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_ledger" ON ledger_entries;
CREATE POLICY "delete_ledger" ON ledger_entries FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ledger_student_id ON ledger_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entry_type ON ledger_entries(entry_type);

-- ─── 3. transactions.status default ──────────────────────────────────────────
-- Ensure the status column exists (prior migration may have added it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'status'
  ) THEN
    ALTER TABLE transactions ADD COLUMN status text DEFAULT 'completed';
  END IF;
END $$;

-- Set default for future inserts and backfill any NULLs
ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'completed';
UPDATE transactions SET status = 'completed' WHERE status IS NULL;
