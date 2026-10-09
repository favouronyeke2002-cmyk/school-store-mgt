ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS applicable_to TEXT;

ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS applicable_student_status TEXT;

UPDATE bundles
SET applicable_student_status = CASE
  WHEN applicable_student_status IN (
    'All Students',
    'New Applicants Only',
    'Returning Students Only'
  ) THEN applicable_student_status
  WHEN applicable_to IN ('New Applicants Only', 'Returning Students Only')
    THEN applicable_to
  WHEN bundle_type = 'acceptance' THEN 'New Applicants Only'
  WHEN bundle_type = 'returning_registration' THEN 'Returning Students Only'
  ELSE 'All Students'
END;

UPDATE bundles
SET applicable_to = CASE
  WHEN student_type IN ('Day Only', 'Boarding Only') THEN student_type
  WHEN student_type = 'All Student Types' THEN 'All Students'
  WHEN applicable_to IN ('Day Only', 'Boarding Only', 'All Students')
    THEN applicable_to
  ELSE 'All Students'
END;

UPDATE bundles
SET bundle_type = 'registration'
WHERE bundle_type = 'returning_registration';

ALTER TABLE bundles
  DROP CONSTRAINT IF EXISTS bundles_bundle_type_check;

ALTER TABLE bundles
  ADD CONSTRAINT bundles_bundle_type_check
  CHECK (bundle_type IN ('acceptance', 'registration', 'custom'));

ALTER TABLE bundles
  ALTER COLUMN applicable_student_status SET DEFAULT 'All Students',
  ALTER COLUMN applicable_student_status SET NOT NULL,
  ALTER COLUMN applicable_to SET DEFAULT 'All Students',
  ALTER COLUMN applicable_to SET NOT NULL;

ALTER TABLE bundles
  DROP CONSTRAINT IF EXISTS bundles_applicable_student_status_check;

ALTER TABLE bundles
  ADD CONSTRAINT bundles_applicable_student_status_check
  CHECK (
    applicable_student_status IN (
      'All Students',
      'New Applicants Only',
      'Returning Students Only'
    )
  );

ALTER TABLE bundles
  DROP CONSTRAINT IF EXISTS bundles_applicable_to_check;

ALTER TABLE bundles
  ADD CONSTRAINT bundles_applicable_to_check
  CHECK (applicable_to IN ('All Students', 'Day Only', 'Boarding Only'));