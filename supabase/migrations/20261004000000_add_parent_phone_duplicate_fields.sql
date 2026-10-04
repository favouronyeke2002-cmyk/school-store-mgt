ALTER TABLE students
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_phone TEXT;

ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS parent_phone TEXT;

UPDATE students
SET
  first_name = split_part(trim(name), ' ', 1),
  last_name = CASE
    WHEN position(' ' IN trim(name)) > 0
      THEN substring(trim(name) FROM position(' ' IN trim(name)) + 1)
    ELSE ''
  END
WHERE first_name IS NULL OR last_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_students_duplicate_identity
  ON students (first_name, last_name, student_class, parent_phone);

CREATE INDEX IF NOT EXISTS idx_applicants_duplicate_identity
  ON applicants (first_name, last_name, proposed_class, parent_phone);