-- Create expenses table for tracking operational expenses per shift
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('Water Tanker', 'Generator Fuel', 'Kitchen Supplies', 'Repairs', 'Salaries', 'Other')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash Drawer', 'Bank Transfer')),
  description TEXT,
  created_by INTEGER REFERENCES pos_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for quick shift-based queries
CREATE INDEX IF NOT EXISTS idx_expenses_shift_id ON expenses(shift_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expenses
CREATE POLICY "expenses_select_all" ON expenses FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "expenses_insert_authenticated" ON expenses FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "expenses_update_authenticated" ON expenses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "expenses_delete_authenticated" ON expenses FOR DELETE
  TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON expenses TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add comment
COMMENT ON TABLE expenses IS 'Tracks operational expenses deducted from shifts or paid via bank transfer';
COMMENT ON COLUMN expenses.shift_id IS 'References the shift this expense was deducted from. NULL for bank transfers not tied to a specific shift';
COMMENT ON COLUMN expenses.payment_mode IS 'Cash Drawer = deducted from shift cash, Bank Transfer = paid directly from school account';
