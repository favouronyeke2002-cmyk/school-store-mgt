ALTER TABLE bundles
  DROP CONSTRAINT IF EXISTS bundles_bundle_type_check;

ALTER TABLE bundles
  ADD CONSTRAINT bundles_bundle_type_check
  CHECK (
    bundle_type IN (
      'acceptance',
      'registration',
      'returning_registration',
      'custom'
    )
  );
