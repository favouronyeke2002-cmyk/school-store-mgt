/*
# School POS and Store Management Schema

1. New Tables
- `pos_users`: Cashier and admin accounts with PIN/password login
  - id (serial, primary key)
  - username (text, unique)
  - password (text)
  - pin (text)
  - role (text: 'admin' or 'cashier')
  - is_active (boolean, default true)
  - created_at (timestamptz)

- `students`: Student directory
  - student_id (text, primary key, e.g. 'STU-0001')
  - name (text)
  - student_class (text, e.g. 'JSS1A')
  - current_fees_owed (numeric, default 0)
  - created_at (timestamptz)
  - updated_at (timestamptz)

- `inventory`: Product catalog with pricing and stock
  - item_id (serial, primary key)
  - item_name (text)
  - cost_price (numeric)
  - selling_price (numeric)
  - stock_quantity (integer, default 0)
  - barcode (text, unique)
  - created_at (timestamptz)

- `shifts`: Cashier shift tracking
  - id (serial, primary key)
  - user_id (integer, FK to pos_users)
  - opening_cash (numeric)
  - expected_closing_cash (numeric, nullable)
  - closing_cash (numeric, nullable)
  - cash_difference (numeric, nullable)
  - opened_at (timestamptz)
  - closed_at (timestamptz, nullable)
  - status (text: 'open' or 'closed')

- `transactions`: Immutable transaction log (NO deletions allowed)
  - transaction_id (serial, primary key)
  - student_id (text, FK to students - NOT NULL, no anonymous sales)
  - shift_id (integer, FK to shifts)
  - type (text: 'STORE_PURCHASE' or 'FEES_CASH_COLLECTION')
  - amount_paid (numeric)
  - payment_mode (text: 'Cash' or 'POS_Transfer')
  - timestamp (timestamptz)
  - notes (text, nullable)

- `transaction_items`: Line items for store purchases
  - id (serial, primary key)
  - transaction_id (integer, FK to transactions)
  - item_id (integer, FK to inventory)
  - quantity (integer)
  - unit_price (numeric)
  - total_price (numeric)

- `stock_adjustments`: Log of manual stock changes
  - id (serial, primary key)
  - item_id (integer, FK to inventory)
  - quantity_change (integer)
  - reason (text, nullable)
  - adjusted_at (timestamptz)

2. Security
- RLS enabled on all tables.
- This is a single-tenant offline POS system — all data is shared among authenticated POS users.
- Policies allow anon + authenticated CRUD on all tables since the app manages its own auth via pos_users.

3. Seed Data
- Default admin user (password: admin123, pin: 9999)
- Default cashier user (password: cashier123, pin: 1234)
- 10 sample students across different classes
- 15 sample inventory items with barcodes

4. Important Notes
- student_id on transactions is NOT NULL — no anonymous/guest purchases allowed
- type column on transactions uses CHECK constraint for valid values
- status column on shifts uses CHECK constraint for valid values
- payment_mode uses CHECK constraint for valid values
*/

-- Users table (separate from Supabase auth — this is the POS user system)
CREATE TABLE IF NOT EXISTS pos_users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT,
  pin TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'cashier')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  student_class TEXT NOT NULL,
  current_fees_owed NUMERIC NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  item_id SERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  cost_price NUMERIC NOT NULL DEFAULT 0.00,
  selling_price NUMERIC NOT NULL DEFAULT 0.00,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  barcode TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES pos_users(id) ON DELETE CASCADE,
  opening_cash NUMERIC NOT NULL DEFAULT 0.00,
  expected_closing_cash NUMERIC,
  closing_cash NUMERIC,
  cash_difference NUMERIC,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed'))
);

-- Transactions table — NO anonymous sales (student_id NOT NULL)
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('STORE_PURCHASE', 'FEES_CASH_COLLECTION')),
  amount_paid NUMERIC NOT NULL DEFAULT 0.00,
  payment_mode TEXT NOT NULL CHECK(payment_mode IN ('Cash', 'POS_Transfer')),
  timestamp TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Transaction items
CREATE TABLE IF NOT EXISTS transaction_items (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES inventory(item_id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0.00,
  total_price NUMERIC NOT NULL DEFAULT 0.00
);

-- Stock adjustments log
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inventory(item_id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL,
  reason TEXT,
  adjusted_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_student ON transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(student_class);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_transaction_items_txn ON transaction_items(transaction_id);

-- Enable RLS on all tables
ALTER TABLE pos_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: single-tenant POS, anon+authenticated CRUD
-- pos_users
DROP POLICY IF EXISTS "pos_users_select" ON pos_users;
CREATE POLICY "pos_users_select" ON pos_users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "pos_users_insert" ON pos_users;
CREATE POLICY "pos_users_insert" ON pos_users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pos_users_update" ON pos_users;
CREATE POLICY "pos_users_update" ON pos_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pos_users_delete" ON pos_users;
CREATE POLICY "pos_users_delete" ON pos_users FOR DELETE TO anon, authenticated USING (true);

-- students
DROP POLICY IF EXISTS "students_select" ON students;
CREATE POLICY "students_select" ON students FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "students_insert" ON students;
CREATE POLICY "students_insert" ON students FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "students_update" ON students;
CREATE POLICY "students_update" ON students FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "students_delete" ON students;
CREATE POLICY "students_delete" ON students FOR DELETE TO anon, authenticated USING (true);

-- inventory
DROP POLICY IF EXISTS "inventory_select" ON inventory;
CREATE POLICY "inventory_select" ON inventory FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "inventory_insert" ON inventory;
CREATE POLICY "inventory_insert" ON inventory FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "inventory_update" ON inventory;
CREATE POLICY "inventory_update" ON inventory FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "inventory_delete" ON inventory;
CREATE POLICY "inventory_delete" ON inventory FOR DELETE TO anon, authenticated USING (true);

-- shifts
DROP POLICY IF EXISTS "shifts_select" ON shifts;
CREATE POLICY "shifts_select" ON shifts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "shifts_insert" ON shifts;
CREATE POLICY "shifts_insert" ON shifts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shifts_update" ON shifts;
CREATE POLICY "shifts_update" ON shifts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- transactions
DROP POLICY IF EXISTS "transactions_select" ON transactions;
CREATE POLICY "transactions_select" ON transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
-- NO update or delete policies — transactions are immutable!

-- transaction_items
DROP POLICY IF EXISTS "transaction_items_select" ON transaction_items;
CREATE POLICY "transaction_items_select" ON transaction_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "transaction_items_insert" ON transaction_items;
CREATE POLICY "transaction_items_insert" ON transaction_items FOR INSERT TO anon, authenticated WITH CHECK (true);

-- stock_adjustments
DROP POLICY IF EXISTS "stock_adjustments_select" ON stock_adjustments;
CREATE POLICY "stock_adjustments_select" ON stock_adjustments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "stock_adjustments_insert" ON stock_adjustments;
CREATE POLICY "stock_adjustments_insert" ON stock_adjustments FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Seed default users
INSERT INTO pos_users (username, password, pin, role, is_active) VALUES
  ('admin', 'admin123', '9999', 'admin', true),
  ('cashier1', 'cashier123', '1234', 'cashier', true)
ON CONFLICT (username) DO NOTHING;

-- Seed sample students
INSERT INTO students (student_id, name, student_class, current_fees_owed) VALUES
  ('STU-0001', 'Adeola Johnson', 'JSS1A', 15000),
  ('STU-0002', 'Chidinma Okonkwo', 'JSS1B', 0),
  ('STU-0003', 'Emeka Nnamdi', 'JSS2A', 25000),
  ('STU-0004', 'Fatima Ibrahim', 'JSS2B', 10000),
  ('STU-0005', 'Oluwaseun Adeyemi', 'JSS3A', 5000),
  ('STU-0006', 'Ngozi Eze', 'SS1A', 35000),
  ('STU-0007', 'Yusuf Muhammad', 'SS1B', 20000),
  ('STU-0008', 'Adaobi Nneka', 'SS2A', 0),
  ('STU-0009', 'Chukwuemeka Okafor', 'SS2B', 18000),
  ('STU-0010', 'Aminat Hassan', 'SS3A', 40000)
ON CONFLICT (student_id) DO NOTHING;

-- Seed sample inventory
INSERT INTO inventory (item_name, barcode, cost_price, selling_price, stock_quantity) VALUES
  ('Exercise Book (80pg)', '1234567890001', 50, 120, 500),
  ('Exercise Book (60pg)', '1234567890002', 40, 100, 400),
  ('Blue Ballpoint Pen', '1234567890003', 20, 50, 300),
  ('Red Ballpoint Pen', '1234567890004', 20, 50, 300),
  ('Pencil HB', '1234567890005', 10, 30, 500),
  ('Eraser', '1234567890006', 15, 40, 200),
  ('Sharpener', '1234567890007', 25, 60, 150),
  ('Mathematical Set', '1234567890008', 350, 700, 80),
  ('Ruler (30cm)', '1234567890009', 30, 80, 200),
  ('Highlighter Pack', '1234567890010', 150, 350, 100),
  ('School Uniform Shirt', '1234567890011', 900, 1800, 50),
  ('School Uniform Trousers', '1234567890012', 1200, 2500, 50),
  ('School Tie', '1234567890013', 200, 500, 100),
  ('School Socks (Pair)', '1234567890014', 100, 250, 150),
  ('Mathematics Textbook', '1234567890015', 900, 1900, 30)
ON CONFLICT (barcode) DO NOTHING;
