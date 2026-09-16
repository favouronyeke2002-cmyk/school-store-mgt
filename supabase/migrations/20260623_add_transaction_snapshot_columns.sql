-- Add snapshot columns to transactions table for receipt reprint reliability.
-- These columns store the customer name and class at the time of payment so
-- reprints don't depend on relational joins to students/applicants tables.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS target_class  text;

COMMENT ON COLUMN transactions.customer_name IS 'Snapshot of buyer/student/applicant name at time of payment';
COMMENT ON COLUMN transactions.target_class  IS 'Snapshot of student class or applicant prospective class at time of payment';
