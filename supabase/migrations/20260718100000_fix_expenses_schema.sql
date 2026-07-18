-- ============================================================
-- Migration: Fix expenses table schema
-- Adds: payee, target_department
-- Drops: overly-restrictive category CHECK constraint
-- Refreshes: PostgREST schema cache
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

BEGIN;

-- 1. Drop the old hard-coded category CHECK constraint so custom categories work
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 2. Add payee column (nullable in DB for backward compat; required in UI)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payee TEXT;

-- 3. Add target_department column with a sensible default
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS target_department TEXT NOT NULL DEFAULT 'General / Fees';

-- 4. Also drop the old payment_mode CHECK so future modes can be added freely
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_payment_mode_check;

-- 5. Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
