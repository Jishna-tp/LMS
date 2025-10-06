/*
  # Fix Department RLS Authentication Policies

  1. Security Updates
    - Drop existing restrictive policies
    - Create proper policies that check authenticated user's role through users->employees relationship
    - Allow Admin/HR to perform all operations on departments
    - Allow all authenticated users to read departments

  2. Policy Structure
    - Uses auth.uid() to get current user
    - Links through users table to employees table to check role
    - Proper INSERT, UPDATE, DELETE, and SELECT policies
*/

-- Drop existing policies that are causing issues
DROP POLICY IF EXISTS "Admin and HR full access to departments" ON departments;
DROP POLICY IF EXISTS "All users can read departments" ON departments;
DROP POLICY IF EXISTS "Employees can read their department" ON departments;
DROP POLICY IF EXISTS "Managers can read their department" ON departments;

-- Create new policies with proper authentication checks

-- Allow all authenticated users to read departments
CREATE POLICY "Allow authenticated users to read departments"
  ON departments
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow Admin and HR to insert departments
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

-- Allow Admin and HR to update departments
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

-- Allow Admin and HR to delete departments
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