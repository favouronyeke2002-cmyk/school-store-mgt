ALTER TABLE applicants
  DROP CONSTRAINT IF EXISTS applicants_status_check;

ALTER TABLE applicants
  ADD CONSTRAINT applicants_status_check
  CHECK (status IN ('pending', 'eligible', 'enrolled', 'withdrawn'));