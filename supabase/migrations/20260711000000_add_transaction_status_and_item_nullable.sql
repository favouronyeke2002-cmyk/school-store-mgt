-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: transaction status (void/audit) + nullable item_id for service lines
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Add status column to transactions for admin void/audit workflow.
--    DEFAULT 'ACTIVE' so all existing rows are implicitly active.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

-- Only enforce the check if the column was just created; if it already exists
-- with a different check, ALTER CONSTRAINT is safer, but ADD COLUMN IF NOT EXISTS
-- means the constraint below only runs on first migration.
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('ACTIVE', 'VOIDED'));

COMMENT ON COLUMN transactions.status IS
  'ACTIVE = normal record; VOIDED = admin-reversed for error correction. Rows are NEVER deleted.';

-- 2. Make transaction_items.item_id nullable so non-inventory service line items
--    (e.g., "Acceptance Admin Processing Fee" overhead balancing lines) can be
--    stored without a matching inventory row.
ALTER TABLE transaction_items
  ALTER COLUMN item_id DROP NOT NULL;

COMMENT ON COLUMN transaction_items.item_id IS
  'NULL for non-inventory service lines such as bundle package overhead fees';
