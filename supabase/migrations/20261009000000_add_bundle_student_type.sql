ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS student_type TEXT NOT NULL DEFAULT 'All Student Types'
  CHECK (student_type IN ('Day Only', 'Boarding Only', 'All Student Types'));