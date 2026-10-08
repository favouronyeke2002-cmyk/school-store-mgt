ALTER TABLE students
  ADD COLUMN IF NOT EXISTS first_name_normalized TEXT GENERATED ALWAYS AS (
    lower(btrim(coalesce(first_name, '')))
  ) STORED,
  ADD COLUMN IF NOT EXISTS last_name_normalized TEXT GENERATED ALWAYS AS (
    lower(btrim(coalesce(last_name, '')))
  ) STORED,
  ADD COLUMN IF NOT EXISTS parent_phone_normalized TEXT GENERATED ALWAYS AS (
    nullif(lower(btrim(parent_phone)), '')
  ) STORED;

ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS first_name_normalized TEXT GENERATED ALWAYS AS (
    lower(btrim(coalesce(first_name, '')))
  ) STORED,
  ADD COLUMN IF NOT EXISTS last_name_normalized TEXT GENERATED ALWAYS AS (
    lower(btrim(coalesce(last_name, '')))
  ) STORED,
  ADD COLUMN IF NOT EXISTS parent_phone_normalized TEXT GENERATED ALWAYS AS (
    nullif(lower(btrim(parent_phone)), '')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_students_normalized_duplicate_identity
  ON students (first_name_normalized, last_name_normalized, parent_phone_normalized);

CREATE INDEX IF NOT EXISTS idx_applicants_normalized_duplicate_identity
  ON applicants (first_name_normalized, last_name_normalized, parent_phone_normalized);

CREATE OR REPLACE FUNCTION link_applicant_records_to_enrolled_student()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.enrolled_student_id IS NOT NULL
     AND NEW.enrolled_student_id IS DISTINCT FROM OLD.enrolled_student_id THEN
    UPDATE transactions
    SET student_id = NEW.enrolled_student_id
    WHERE applicant_id = NEW.id
      AND student_id IS NULL;

    UPDATE student_book_issuances
    SET student_id = NEW.enrolled_student_id
    WHERE applicant_id = NEW.id
      AND student_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applicants_link_enrolled_student_records ON applicants;
CREATE TRIGGER applicants_link_enrolled_student_records
  AFTER UPDATE OF enrolled_student_id ON applicants
  FOR EACH ROW
  EXECUTE FUNCTION link_applicant_records_to_enrolled_student();

UPDATE transactions AS transaction_row
SET student_id = applicant.enrolled_student_id
FROM applicants AS applicant
WHERE transaction_row.applicant_id = applicant.id
  AND transaction_row.student_id IS NULL
  AND applicant.enrolled_student_id IS NOT NULL;

UPDATE student_book_issuances AS issuance
SET student_id = applicant.enrolled_student_id
FROM applicants AS applicant
WHERE issuance.applicant_id = applicant.id
  AND issuance.student_id IS NULL
  AND applicant.enrolled_student_id IS NOT NULL;