-- Add current_term and class_list to school_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'school_settings' AND column_name = 'current_term'
  ) THEN
    ALTER TABLE school_settings ADD COLUMN current_term TEXT NOT NULL DEFAULT '1st Term';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'school_settings' AND column_name = 'class_list'
  ) THEN
    ALTER TABLE school_settings ADD COLUMN class_list TEXT NOT NULL DEFAULT '["JSS1A","JSS1B","JSS2A","JSS2B","JSS3A","JSS3B","SS1A","SS1B","SS2A","SS2B","SS3A","SS3B"]';
  END IF;
END $$;
