-- Add balance_due column to transactions for installment tracking
-- This enables proper receipt printing of outstanding balances
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC DEFAULT 0;

COMMENT ON COLUMN transactions.balance_due IS 'Outstanding balance for partial/installment payments';