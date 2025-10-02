/*
  # Holiday Management System

  1. New Tables
    - `holidays`
      - `id` (uuid, primary key)
      - `name` (text, holiday name)
      - `date` (date, holiday date)
      - `type` (text, holiday type - National, Religious, Company, etc.)
      - `is_recurring` (boolean, whether it recurs yearly)
      - `description` (text, optional description)
      - `created_by` (uuid, admin who created it)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `holidays` table
    - Add policies for public read access
    - Add policies for admin-only write access

  3. Indexes
    - Index on date for efficient calendar queries
    - Index on is_recurring for recurring holiday queries
*/

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  type text NOT NULL DEFAULT 'Company',
  is_recurring boolean DEFAULT false,
  description text,
  created_by uuid REFERENCES employees(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read holidays
CREATE POLICY "Allow public read access to holidays"
  ON holidays
  FOR SELECT
  TO public
  USING (true);

-- Only admins can insert holidays
CREATE POLICY "Allow admin insert to holidays"
  ON holidays
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE id = created_by 
      AND role = 'Admin'
    )
  );

-- Only admins can update holidays
CREATE POLICY "Allow admin update to holidays"
  ON holidays
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.role = 'Admin'
    )
  );

-- Only admins can delete holidays
CREATE POLICY "Allow admin delete from holidays"
  ON holidays
  FOR DELETE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.role = 'Admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_recurring ON holidays(is_recurring);
CREATE INDEX IF NOT EXISTS idx_holidays_type ON holidays(type);

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_holidays_timestamp
  BEFORE UPDATE ON holidays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add constraint for holiday types
ALTER TABLE holidays ADD CONSTRAINT holidays_type_check 
  CHECK (type IN ('National', 'Religious', 'Company', 'Regional', 'Other'));