-- Add class_list and current_term columns to school_settings
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS class_list TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS current_term TEXT DEFAULT 'First Term';

-- Initialize with default classes if not set
UPDATE school_settings 
SET class_list = '["JSS 1","JSS 2","JSS 3","SS 1","SS 2","SS 3"]'::text
WHERE class_list IS NULL;