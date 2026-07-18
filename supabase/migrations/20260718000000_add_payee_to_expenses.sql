-- Add payee/vendor field to the expenses table
-- Run this in the Supabase dashboard → SQL Editor

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payee TEXT;

COMMENT ON COLUMN expenses.payee IS 'Payee / Vendor Name (e.g. "Mandy Catering Services", "Power Company")';
