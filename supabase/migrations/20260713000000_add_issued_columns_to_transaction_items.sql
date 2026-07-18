-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: Distribution tracking columns on transaction_items
-- issued_at  — timestamp when a physical item was handed to the student/applicant
-- issued_by  — username of the staff member who handed it over
-- NULL on both columns means the item is in "Pending Collection" state.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS issued_at  TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS issued_by  TEXT        DEFAULT NULL;

COMMENT ON COLUMN transaction_items.issued_at IS
  'Timestamp when the physical item was issued/handed to the student. NULL = Pending Collection.';

COMMENT ON COLUMN transaction_items.issued_by IS
  'Username of the staff member who issued the item. NULL = not yet issued.';

-- Index to allow fast "find all pending items for a transaction" look-ups
CREATE INDEX IF NOT EXISTS idx_transaction_items_pending
  ON transaction_items (transaction_id)
  WHERE issued_at IS NULL;
