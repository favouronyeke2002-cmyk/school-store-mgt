-- Add student_status to students table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'student_status'
  ) THEN
    ALTER TABLE students ADD COLUMN student_status TEXT NOT NULL DEFAULT 'Day';
  END IF;
END $$;

-- Add applicable_to to fee_types table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fee_types' AND column_name = 'applicable_to'
  ) THEN
    ALTER TABLE fee_types ADD COLUMN applicable_to TEXT NOT NULL DEFAULT 'All Students';
  END IF;
END $$;

-- Add student_status to applicants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'student_status'
  ) THEN
    ALTER TABLE applicants ADD COLUMN student_status TEXT NOT NULL DEFAULT 'Day';
  END IF;
END $$;
