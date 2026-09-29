-- Add item_name column to transaction_items for reliable receipt printing
-- This ensures item names are preserved even if inventory is deleted
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS item_name TEXT;

COMMENT ON COLUMN transaction_items.item_name IS 'Snapshot of item name at time of purchase for receipt printing';