/*
  # Employee Management System Schema

  1. New Tables
    - `employees`
      - `id` (uuid, primary key)
      - `employee_id` (text, unique, auto-generated EMP0001, EMP0002...)
      - `name` (text)
      - `email` (text, unique)
      - `role` (text, enum: Employee, Manager, HR, Admin)
      - `department` (text)
      - `manager_id` (uuid, references employees)
      - `hire_date` (date)
      - `created_at` (timestamp)

    - `users`
      - `id` (uuid, primary key)
      - `employee_id` (text, references employees.employee_id)
      - `username` (text, unique)
      - `password_hash` (text)
      - `created_at` (timestamp)

    - `leave_requests`
      - `id` (uuid, primary key)
      - `employee_id` (text, references employees.employee_id)
      - `type` (text, Leave Type: Annual, Sick, Personal, etc.)
      - `start_date` (date)
      - `end_date` (date)
      - `days_requested` (integer)
      - `reason` (text)
      - `status` (text, enum: Pending, Manager_Approved, HR_Approved, Rejected)
      - `manager_notes` (text)
      - `hr_notes` (text)
      - `approved_by_manager` (uuid, references employees)
      - `approved_by_hr` (uuid, references employees)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
*/

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('Employee', 'Manager', 'HR', 'Admin')),
  department text NOT NULL,
  manager_id uuid REFERENCES employees(id),
  hire_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table for custom authentication
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('Annual', 'Sick', 'Personal', 'Maternity', 'Paternity', 'Emergency')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Manager_Approved', 'HR_Approved', 'Rejected')),
  manager_notes text,
  hr_notes text,
  approved_by_manager uuid REFERENCES employees(id),
  approved_by_hr uuid REFERENCES employees(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Function to generate next employee ID
CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS text AS $$
DECLARE
  next_num integer;
  formatted_id text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM employees
  WHERE employee_id ~ '^EMP\d+$';
  
  formatted_id := 'EMP' || LPAD(next_num::text, 4, '0');
  RETURN formatted_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate employee_id
CREATE OR REPLACE FUNCTION set_employee_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    NEW.employee_id := generate_employee_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_employee_id
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION set_employee_id();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_employees_timestamp
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_leave_requests_timestamp
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Note: These are basic policies - in practice you'd implement more complex role-based logic)
CREATE POLICY "Public read access to employees" ON employees FOR SELECT USING (true);
CREATE POLICY "Public insert access to employees" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access to employees" ON employees FOR UPDATE USING (true);
CREATE POLICY "Public delete access to employees" ON employees FOR DELETE USING (true);

CREATE POLICY "Public read access to users" ON users FOR SELECT USING (true);
CREATE POLICY "Public insert access to users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access to users" ON users FOR UPDATE USING (true);

CREATE POLICY "Public read access to leave_requests" ON leave_requests FOR SELECT USING (true);
CREATE POLICY "Public insert access to leave_requests" ON leave_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access to leave_requests" ON leave_requests FOR UPDATE USING (true);
CREATE POLICY "Public delete access to leave_requests" ON leave_requests FOR DELETE USING (true);

-- Insert sample data
INSERT INTO employees (employee_id, name, email, role, department) VALUES
('EMP0001', 'John Admin', 'admin@company.com', 'Admin', 'IT'),
('EMP0002', 'Jane Manager', 'manager@company.com', 'Manager', 'Sales'),
('EMP0003', 'Bob HR', 'hr@company.com', 'HR', 'Human Resources'),
('EMP0004', 'Alice Employee', 'alice@company.com', 'Employee', 'Sales');

-- Update manager relationships
UPDATE employees SET manager_id = (SELECT id FROM employees WHERE employee_id = 'EMP0002') 
WHERE employee_id = 'EMP0004';