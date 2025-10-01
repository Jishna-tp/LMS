/*
  # Leave Management Workflow Updates

  1. Schema Changes
    - Simplify leave status to: Pending, Approved, Rejected
    - Add workflow history tracking
    - Update constraints and policies

  2. New Tables
    - `leave_workflow_history` for tracking approval workflow

  3. Security
    - Update RLS policies for new workflow
    - Add policies for workflow history
*/

-- Update leave_requests status constraint
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check 
  CHECK (status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text]));

-- Create workflow history table
CREATE TABLE IF NOT EXISTS leave_workflow_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  action_by uuid NOT NULL REFERENCES employees(id),
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['submitted'::text, 'manager_approved'::text, 'hr_approved'::text, 'rejected'::text, 'auto_approved'::text])),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on workflow history
ALTER TABLE leave_workflow_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for workflow history
CREATE POLICY "Users can read workflow history for accessible leaves"
  ON leave_workflow_history
  FOR SELECT
  TO public
  USING (
    leave_request_id IN (
      SELECT lr.id FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.employee_id
      WHERE 
        -- Employee can see their own leave history
        e.employee_id = (jwt() ->> 'employee_id'::text)
        OR
        -- Manager can see their team's leave history
        e.manager_id = (SELECT id FROM employees WHERE employee_id = (jwt() ->> 'employee_id'::text))
        OR
        -- HR and Admin can see all
        (SELECT role FROM employees WHERE employee_id = (jwt() ->> 'employee_id'::text)) IN ('HR', 'Admin')
    )
  );

CREATE POLICY "System can insert workflow history"
  ON leave_workflow_history
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Add new columns to leave_requests for workflow tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'is_visible_to_hr'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN is_visible_to_hr boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'manager_approved_at'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN manager_approved_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'hr_approved_at'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN hr_approved_at timestamptz;
  END IF;
END $$;

-- Update existing leave requests to new status format
UPDATE leave_requests 
SET status = 'Approved', is_visible_to_hr = true
WHERE status IN ('Manager_Approved', 'HR_Approved');

-- Function to handle leave workflow
CREATE OR REPLACE FUNCTION handle_leave_workflow()
RETURNS TRIGGER AS $$
BEGIN
  -- When a leave is first created
  IF TG_OP = 'INSERT' THEN
    -- Insert workflow history for submission
    INSERT INTO leave_workflow_history (leave_request_id, action_by, action_type, notes)
    SELECT NEW.id, e.id, 'submitted', 'Leave request submitted'
    FROM employees e WHERE e.employee_id = NEW.employee_id;
    
    -- For HR and Admin created leaves, auto-approve and make visible to HR
    IF EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.employee_id = NEW.employee_id 
      AND e.role IN ('HR', 'Admin')
    ) THEN
      NEW.status = 'Approved';
      NEW.is_visible_to_hr = true;
      NEW.hr_approved_at = now();
      
      -- Insert auto-approval history
      INSERT INTO leave_workflow_history (leave_request_id, action_by, action_type, notes)
      SELECT NEW.id, e.id, 'auto_approved', 'Auto-approved (HR/Admin user)'
      FROM employees e WHERE e.employee_id = NEW.employee_id;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for leave workflow
DROP TRIGGER IF EXISTS trigger_leave_workflow ON leave_requests;
CREATE TRIGGER trigger_leave_workflow
  BEFORE INSERT ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_leave_workflow();