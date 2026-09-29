ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS voided_at timestamptz;
