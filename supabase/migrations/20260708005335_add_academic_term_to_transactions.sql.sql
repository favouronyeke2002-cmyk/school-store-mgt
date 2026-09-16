-- Add term column to transactions for academic term scoping
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS academic_term TEXT;

COMMENT ON COLUMN transactions.academic_term IS 'Academic term (e.g., First Term, Second Term) for fee/bundle scoping';