/*
  # Leave Policy Management System

  1. New Tables
    - `leave_policies`
      - `id` (uuid, primary key)
      - `name` (text, leave type name)
      - `code` (text, unique code for leave type)
      - `description` (text, optional description)
      - `annual_entitlement` (integer, days per year)
      - `carry_forward_allowed` (boolean)
      - `max_carry_forward_days` (integer, nullable)
      - `encashment_allowed` (boolean)
      - `max_encashment_days` (integer, nullable)
      - `min_service_months` (integer, minimum service required)
      - `gender_restriction` (text, nullable - 'Male', 'Female', or null for all)
      - `department_restriction` (text[], nullable - array of departments)
      - `approval_workflow` (text, 'single' or 'multi')
      - `max_consecutive_days` (integer, nullable)
      - `advance_notice_days` (integer, default 0)
      - `is_active` (boolean, default true)
      - `created_by` (uuid, foreign key to employees)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `employee_leave_balances`
      - `id` (uuid, primary key)
      - `employee_id` (text, foreign key to employees.employee_id)
      - `policy_id` (uuid, foreign key to leave_policies)
      - `year` (integer, calendar year)
      - `opening_balance` (decimal, carried forward from previous year)
      - `annual_entitlement` (decimal, allocated for the year)
      - `used_balance` (decimal, leaves taken)
      - `pending_balance` (decimal, leaves in pending requests)
      - `available_balance` (decimal, computed field)
      - `carry_forward_balance` (decimal, balance to carry forward)
      - `encashed_balance` (decimal, leaves encashed)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for admin/HR access to policies
    - Add policies for employee access to their own balances

  3. Functions
    - Function to calculate leave balances
    - Function to validate leave requests against policies
    - Triggers to update balances on leave request changes
*/

-- Create leave_policies table
CREATE TABLE IF NOT EXISTS leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  annual_entitlement integer NOT NULL DEFAULT 0,
  carry_forward_allowed boolean DEFAULT false,
  max_carry_forward_days integer,
  encashment_allowed boolean DEFAULT false,
  max_encashment_days integer,
  min_service_months integer DEFAULT 0,
  gender_restriction text CHECK (gender_restriction IN ('Male', 'Female')),
  department_restriction text[],
  approval_workflow text DEFAULT 'multi' CHECK (approval_workflow IN ('single', 'multi')),
  max_consecutive_days integer,
  advance_notice_days integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES employees(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employee_leave_balances table
CREATE TABLE IF NOT EXISTS employee_leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES leave_policies(id) ON DELETE CASCADE,
  year integer NOT NULL,
  opening_balance decimal(5,2) DEFAULT 0,
  annual_entitlement decimal(5,2) DEFAULT 0,
  used_balance decimal(5,2) DEFAULT 0,
  pending_balance decimal(5,2) DEFAULT 0,
  available_balance decimal(5,2) GENERATED ALWAYS AS (
    opening_balance + annual_entitlement - used_balance - pending_balance
  ) STORED,
  carry_forward_balance decimal(5,2) DEFAULT 0,
  encashed_balance decimal(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, policy_id, year)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leave_policies_active ON leave_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_leave_policies_code ON leave_policies(code);
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_employee_year ON employee_leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_policy ON employee_leave_balances(policy_id);

-- Enable RLS
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_leave_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_policies
CREATE POLICY "Allow admin/HR full access to leave policies"
  ON leave_policies
  FOR ALL
  TO public
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

CREATE POLICY "Allow employees to read active leave policies"
  ON leave_policies
  FOR SELECT
  TO public
  USING (is_active = true);

-- RLS Policies for employee_leave_balances
CREATE POLICY "Allow admin/HR full access to leave balances"
  ON employee_leave_balances
  FOR ALL
  TO public
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

CREATE POLICY "Allow employees to read their own leave balances"
  ON employee_leave_balances
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.employee_id = employee_leave_balances.employee_id
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leave_policy_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_update_leave_policies_timestamp
  BEFORE UPDATE ON leave_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_policy_timestamp();

CREATE TRIGGER trigger_update_employee_leave_balances_timestamp
  BEFORE UPDATE ON employee_leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to initialize leave balances for new employees
CREATE OR REPLACE FUNCTION initialize_employee_leave_balances(
  emp_id text,
  hire_date date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
  policy_record RECORD;
  current_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
  service_months integer;
  pro_rated_entitlement decimal(5,2);
BEGIN
  -- Calculate service months from hire date
  service_months := EXTRACT(YEAR FROM age(CURRENT_DATE, hire_date)) * 12 + 
                   EXTRACT(MONTH FROM age(CURRENT_DATE, hire_date));
  
  -- Loop through all active leave policies
  FOR policy_record IN 
    SELECT * FROM leave_policies WHERE is_active = true
  LOOP
    -- Check if employee meets minimum service requirement
    IF service_months >= policy_record.min_service_months THEN
      -- Calculate pro-rated entitlement if joined mid-year
      IF EXTRACT(YEAR FROM hire_date) = current_year THEN
        pro_rated_entitlement := policy_record.annual_entitlement * 
          (12 - EXTRACT(MONTH FROM hire_date) + 1) / 12.0;
      ELSE
        pro_rated_entitlement := policy_record.annual_entitlement;
      END IF;
      
      -- Insert or update leave balance
      INSERT INTO employee_leave_balances (
        employee_id,
        policy_id,
        year,
        annual_entitlement
      ) VALUES (
        emp_id,
        policy_record.id,
        current_year,
        pro_rated_entitlement
      )
      ON CONFLICT (employee_id, policy_id, year)
      DO UPDATE SET
        annual_entitlement = EXCLUDED.annual_entitlement,
        updated_at = now();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to validate leave request against policy
CREATE OR REPLACE FUNCTION validate_leave_request(
  emp_id text,
  policy_code text,
  start_date date,
  end_date date,
  days_requested integer
)
RETURNS jsonb AS $$
DECLARE
  policy_record RECORD;
  balance_record RECORD;
  employee_record RECORD;
  current_year integer := EXTRACT(YEAR FROM start_date);
  service_months integer;
  validation_result jsonb := '{"valid": true, "errors": []}'::jsonb;
  errors text[] := '{}';
BEGIN
  -- Get employee details
  SELECT * INTO employee_record FROM employees WHERE employee_id = emp_id;
  IF NOT FOUND THEN
    RETURN '{"valid": false, "errors": ["Employee not found"]}'::jsonb;
  END IF;
  
  -- Get policy details
  SELECT * INTO policy_record FROM leave_policies 
  WHERE code = policy_code AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN '{"valid": false, "errors": ["Leave policy not found or inactive"]}'::jsonb;
  END IF;
  
  -- Check service eligibility
  service_months := EXTRACT(YEAR FROM age(CURRENT_DATE, employee_record.hire_date)) * 12 + 
                   EXTRACT(MONTH FROM age(CURRENT_DATE, employee_record.hire_date));
  
  IF service_months < policy_record.min_service_months THEN
    errors := array_append(errors, 'Minimum service requirement not met');
  END IF;
  
  -- Check gender restriction
  IF policy_record.gender_restriction IS NOT NULL THEN
    -- This would need a gender field in employees table
    -- For now, we'll skip this check
  END IF;
  
  -- Check department restriction
  IF policy_record.department_restriction IS NOT NULL THEN
    IF NOT (employee_record.department = ANY(policy_record.department_restriction)) THEN
      errors := array_append(errors, 'Department not eligible for this leave type');
    END IF;
  END IF;
  
  -- Check maximum consecutive days
  IF policy_record.max_consecutive_days IS NOT NULL AND 
     days_requested > policy_record.max_consecutive_days THEN
    errors := array_append(errors, 
      format('Maximum consecutive days allowed: %s', policy_record.max_consecutive_days));
  END IF;
  
  -- Check advance notice
  IF policy_record.advance_notice_days > 0 AND 
     start_date <= CURRENT_DATE + policy_record.advance_notice_days THEN
    errors := array_append(errors, 
      format('Minimum %s days advance notice required', policy_record.advance_notice_days));
  END IF;
  
  -- Get leave balance
  SELECT * INTO balance_record FROM employee_leave_balances 
  WHERE employee_id = emp_id AND policy_id = policy_record.id AND year = current_year;
  
  IF NOT FOUND THEN
    -- Initialize balance if not found
    PERFORM initialize_employee_leave_balances(emp_id, employee_record.hire_date);
    
    -- Try to get balance again
    SELECT * INTO balance_record FROM employee_leave_balances 
    WHERE employee_id = emp_id AND policy_id = policy_record.id AND year = current_year;
  END IF;
  
  -- Check available balance
  IF balance_record IS NOT NULL THEN
    IF balance_record.available_balance < days_requested THEN
      errors := array_append(errors, 
        format('Insufficient balance. Available: %s days', balance_record.available_balance));
    END IF;
  ELSE
    errors := array_append(errors, 'Leave balance not found');
  END IF;
  
  -- Build result
  IF array_length(errors, 1) > 0 THEN
    validation_result := jsonb_build_object(
      'valid', false,
      'errors', to_jsonb(errors),
      'available_balance', COALESCE(balance_record.available_balance, 0)
    );
  ELSE
    validation_result := jsonb_build_object(
      'valid', true,
      'errors', '[]'::jsonb,
      'available_balance', COALESCE(balance_record.available_balance, 0)
    );
  END IF;
  
  RETURN validation_result;
END;
$$ LANGUAGE plpgsql;

-- Insert default leave policies
INSERT INTO leave_policies (name, code, description, annual_entitlement, carry_forward_allowed, max_carry_forward_days, approval_workflow, created_by) VALUES
('Annual Leave', 'ANNUAL', 'Annual vacation leave', 21, true, 5, 'multi', (SELECT id FROM employees WHERE role = 'Admin' LIMIT 1)),
('Sick Leave', 'SICK', 'Medical leave for illness', 12, false, null, 'single', (SELECT id FROM employees WHERE role = 'Admin' LIMIT 1)),
('Personal Leave', 'PERSONAL', 'Personal time off', 5, false, null, 'single', (SELECT id FROM employees WHERE role = 'Admin' LIMIT 1)),
('Maternity Leave', 'MATERNITY', 'Maternity leave for mothers', 90, false, null, 'multi', (SELECT id FROM employees WHERE role = 'Admin' LIMIT 1)),
('Paternity Leave', 'PATERNITY', 'Paternity leave for fathers', 15, false, null, 'multi', (SELECT id FROM employees WHERE role = 'Admin' LIMIT 1)),
('Emergency Leave', 'EMERGENCY', 'Emergency situations', 3, false, null, 'single', (SELECT id FROM employees WHERE role = 'Admin' LIMIT 1));

-- Initialize leave balances for all existing employees
DO $$
DECLARE
  emp_record RECORD;
BEGIN
  FOR emp_record IN SELECT employee_id, hire_date FROM employees
  LOOP
    PERFORM initialize_employee_leave_balances(emp_record.employee_id, emp_record.hire_date);
  END LOOP;
END $$;