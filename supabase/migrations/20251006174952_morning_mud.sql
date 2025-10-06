/*
  # Create departments table and update schema

  1. New Tables
    - `departments`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `head_id` (uuid, foreign key to employees.id, nullable)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `departments` table
    - Add policies for different user roles:
      - Admin/HR: Full access (CRUD)
      - Manager: Read access to their own department
      - Employee: Read access to their own department

  3. Functions
    - Add trigger to update `updated_at` timestamp
    - Add function to get department statistics

  4. Sample Data
    - Insert sample departments for testing
*/

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  head_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Create policies for departments table
CREATE POLICY "Admin and HR can manage all departments"
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

CREATE POLICY "Managers can view their own department"
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

CREATE POLICY "Employees can view their own department"
  ON departments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.department = departments.name
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_departments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_departments_timestamp
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_departments_timestamp();

-- Insert sample departments
INSERT INTO departments (name, head_id) VALUES
  ('Engineering', NULL),
  ('Human Resources', NULL),
  ('Finance', NULL),
  ('Marketing', NULL),
  ('Sales', NULL),
  ('Operations', NULL)
ON CONFLICT (name) DO NOTHING;

-- Update employees table to ensure department consistency
-- This will help maintain referential integrity between employees and departments
DO $$
DECLARE
  dept_record RECORD;
  emp_record RECORD;
BEGIN
  -- Update existing employees to use department names that exist in departments table
  FOR dept_record IN SELECT name FROM departments LOOP
    -- Update employees who have similar department names
    UPDATE employees 
    SET department = dept_record.name 
    WHERE department ILIKE '%' || dept_record.name || '%' 
    AND department != dept_record.name;
  END LOOP;
  
  -- Set department heads where possible
  FOR dept_record IN SELECT id, name FROM departments WHERE head_id IS NULL LOOP
    -- Find a manager in this department to set as head
    SELECT id INTO emp_record
    FROM employees 
    WHERE department = dept_record.name 
    AND role IN ('Manager', 'Admin')
    LIMIT 1;
    
    IF emp_record.id IS NOT NULL THEN
      UPDATE departments 
      SET head_id = emp_record.id 
      WHERE id = dept_record.id;
    END IF;
  END LOOP;
END $$;

-- Create function to get department statistics
CREATE OR REPLACE FUNCTION get_department_stats()
RETURNS TABLE (
  department_name text,
  total_employees bigint,
  employees_on_leave bigint,
  available_employees bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.name as department_name,
    COALESCE(emp_count.total, 0) as total_employees,
    COALESCE(leave_count.on_leave, 0) as employees_on_leave,
    COALESCE(emp_count.total, 0) - COALESCE(leave_count.on_leave, 0) as available_employees
  FROM departments d
  LEFT JOIN (
    SELECT 
      department,
      COUNT(*) as total
    FROM employees
    GROUP BY department
  ) emp_count ON d.name = emp_count.department
  LEFT JOIN (
    SELECT 
      e.department,
      COUNT(DISTINCT lr.employee_id) as on_leave
    FROM employees e
    JOIN leave_requests lr ON e.employee_id = lr.employee_id
    WHERE lr.status = 'Approved'
    AND lr.start_date <= CURRENT_DATE
    AND lr.end_date >= CURRENT_DATE
    GROUP BY e.department
  ) leave_count ON d.name = leave_count.department
  ORDER BY d.name;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_head_id ON departments(head_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);