ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS streams JSONB NOT NULL DEFAULT '["Science", "Arts", "Commercial"]'::jsonb,
  ADD COLUMN IF NOT EXISTS stream_required_classes JSONB NOT NULL DEFAULT '["SS1", "SS2", "SS3"]'::jsonb;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS department_stream TEXT;

ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS department_stream TEXT;

ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS target_class TEXT,
  ADD COLUMN IF NOT EXISTS department_stream TEXT;

CREATE INDEX IF NOT EXISTS idx_bundles_target_class_stream
  ON bundles (target_class, department_stream);