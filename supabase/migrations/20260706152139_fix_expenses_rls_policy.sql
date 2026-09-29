-- Enable RLS and add policy for expenses table
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy for public/anon access (for POS system without auth)
CREATE POLICY "Allow public full access on expenses" ON expenses
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Also allow authenticated users full access
CREATE POLICY "Allow authenticated full access on expenses" ON expenses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);