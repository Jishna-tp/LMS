/*
  # Fix Department RLS Policies

  1. Security Updates
    - Drop existing restrictive policies
    - Add proper policies for Admin/HR to manage departments
    - Add policies for employees to read departments
    - Ensure proper access control based on user roles

  2. Policy Changes
    - Allow Admin/HR full access to departments
    - Allow all authenticated users to read departments
    - Restrict write operations to Admin/HR only
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin and HR can manage all departments" ON departments;
DROP POLICY IF EXISTS "Employees can view their own department" ON departments;
DROP POLICY IF EXISTS "Managers can view their own department" ON departments;

-- Create comprehensive RLS policies for departments table

-- Allow Admin and HR full access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admin and HR full access to departments"
  ON departments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.role IN ('Admin', 'HR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.role IN ('Admin', 'HR')
    )
  );

-- Allow all authenticated users to read departments
CREATE POLICY "All users can read departments"
  ON departments
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow managers to read their own department
CREATE POLICY "Managers can read their department"
  ON departments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.role = 'Manager' 
      AND employees.department = departments.name
    )
  );

-- Allow employees to read their own department
CREATE POLICY "Employees can read their department"
  ON departments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.department = departments.name
    )
  );