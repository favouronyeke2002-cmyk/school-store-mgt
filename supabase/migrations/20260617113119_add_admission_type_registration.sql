/*
# Add Admission Type, Registration Fee Category, REGISTRATION_PAYMENT

1. Modified Tables
  - `students`: Add `admission_type` column ('Returning' | 'New', default 'Returning')
  - `fee_types`: Add `fee_category` column ('standard' | 'registration', default 'standard')
  - `transactions`: Extend type CHECK to include 'REGISTRATION_PAYMENT'

2. Index
  - Index on students.admission_type for filtered fee assignment queries

3. Notes
  - Standard class fee assignments EXCLUDE students with admission_type = 'New'
  - REGISTRATION_PAYMENT transactions are structurally isolated from STORE_PURCHASE and FEES_CASH_COLLECTION
*/

-- Add admission_type to students
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'admission_type'
  ) THEN
    ALTER TABLE students ADD COLUMN admission_type TEXT NOT NULL DEFAULT 'Returning'
      CHECK (admission_type IN ('Returning', 'New'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_admission_type ON students(admission_type);

-- Add fee_category to fee_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fee_types' AND column_name = 'fee_category'
  ) THEN
    ALTER TABLE fee_types ADD COLUMN fee_category TEXT NOT NULL DEFAULT 'standard'
      CHECK (fee_category IN ('standard', 'registration'));
  END IF;
END $$;

-- Extend transactions type CHECK constraint to include REGISTRATION_PAYMENT
-- Drop existing constraint and recreate with the new value
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('STORE_PURCHASE', 'FEES_CASH_COLLECTION', 'REGISTRATION_PAYMENT'));
