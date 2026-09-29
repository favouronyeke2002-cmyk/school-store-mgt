-- Add is_active column to inventory table for soft delete support
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Set all existing items to active
UPDATE inventory SET is_active = TRUE WHERE is_active IS NULL;

-- Add index for active items queries
CREATE INDEX IF NOT EXISTS idx_inventory_is_active ON inventory(is_active);

-- Add is_active column to school_settings class_list handling (it's a jsonb structure, skip)
-- Check school_settings structure
