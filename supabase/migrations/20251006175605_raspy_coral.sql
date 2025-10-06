/*
  # Fix Department RLS Policies

  1. Security Updates
    - Drop existing public policies that are causing conflicts
    - Create proper authenticated user policies
    - Link authenticated users to their employee records via users table
    - Allow Admin/HR to manage departments
    - Allow all authenticated users to read departments

  2. Policy Structure
    - Uses auth.uid() to get current authenticated user
    - Joins through users table to get employee_id
    - Joins to employees table to check role
    - Proper role-based access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow Admin/HR full access to departments" ON departments;
DROP POLICY IF EXISTS "Allow employees to read departments" ON departments;
DROP POLICY IF EXISTS "Allow Admin/HR to insert departments" ON departments;
DROP POLICY IF EXISTS "Allow Admin/HR to update departments" ON departments;
DROP POLICY IF EXISTS "Allow Admin/HR to delete departments" ON departments;
DROP POLICY IF EXISTS "Allow authenticated users to read departments" ON departments;

-- Create new policies for authenticated users
CREATE POLICY "Allow Admin/HR to insert departments"
  ON departments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN employees e ON u.employee_id = e.employee_id
      WHERE u.id = auth.uid() 
      AND e.role IN ('Admin', 'HR')
    )
  );

CREATE POLICY "Allow Admin/HR to update departments"
  ON departments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN employees e ON u.employee_id = e.employee_id
      WHERE u.id = auth.uid() 
      AND e.role IN ('Admin', 'HR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN employees e ON u.employee_id = e.employee_id
      WHERE u.id = auth.uid() 
      AND e.role IN ('Admin', 'HR')
    )
  );

CREATE POLICY "Allow Admin/HR to delete departments"
  ON departments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN employees e ON u.employee_id = e.employee_id
      WHERE u.id = auth.uid() 
      AND e.role IN ('Admin', 'HR')
    )
  );

CREATE POLICY "Allow authenticated users to read departments"
  ON departments
  FOR SELECT
  TO authenticated
  USING (true);