CREATE TABLE IF NOT EXISTS inventory_logs (
  id BIGSERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  previous_stock INTEGER NOT NULL,
  quantity_changed INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('RESTOCK', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE')),
  notes TEXT,
  performed_by TEXT NOT NULL DEFAULT 'Unknown',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_item_timestamp
  ON inventory_logs (item_id, timestamp DESC);

ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_logs_select" ON inventory_logs;
CREATE POLICY "inventory_logs_select" ON inventory_logs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "inventory_logs_insert" ON inventory_logs;
CREATE POLICY "inventory_logs_insert" ON inventory_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION change_inventory_stock(
  p_item_id INTEGER,
  p_quantity_changed INTEGER,
  p_change_type TEXT,
  p_notes TEXT DEFAULT NULL,
  p_performed_by TEXT DEFAULT 'Unknown'
)
RETURNS inventory_logs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_item inventory%ROWTYPE;
  resulting_stock INTEGER;
  movement inventory_logs%ROWTYPE;
BEGIN
  IF p_change_type NOT IN ('RESTOCK', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE') THEN
    RAISE EXCEPTION 'Invalid inventory change type: %', p_change_type;
  END IF;
  IF p_quantity_changed = 0 THEN
    RAISE EXCEPTION 'Stock movement must be non-zero';
  END IF;
  IF p_change_type IN ('RESTOCK', 'RETURN') AND p_quantity_changed < 0 THEN
    RAISE EXCEPTION '% movements must increase stock', p_change_type;
  END IF;
  IF p_change_type IN ('SALE', 'DAMAGE') AND p_quantity_changed > 0 THEN
    RAISE EXCEPTION '% movements must decrease stock', p_change_type;
  END IF;

  SELECT * INTO current_item
  FROM inventory
  WHERE item_id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item % was not found', p_item_id;
  END IF;

  resulting_stock := current_item.stock_quantity + p_quantity_changed;
  IF resulting_stock < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for item %', p_item_id;
  END IF;

  UPDATE inventory
  SET stock_quantity = resulting_stock
  WHERE item_id = p_item_id;

  INSERT INTO inventory_logs (
    item_id, item_name, previous_stock, quantity_changed, new_stock,
    change_type, notes, performed_by
  ) VALUES (
    p_item_id, current_item.item_name, current_item.stock_quantity,
    p_quantity_changed, resulting_stock, p_change_type, p_notes,
    COALESCE(NULLIF(p_performed_by, ''), 'Unknown')
  )
  RETURNING * INTO movement;

  RETURN movement;
END;
$$;

GRANT EXECUTE ON FUNCTION change_inventory_stock(INTEGER, INTEGER, TEXT, TEXT, TEXT)
  TO anon, authenticated;