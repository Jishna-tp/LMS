/*
  # Simplify Leave Workflow and Add History Tracking

  1. New Tables
    - `leave_workflow_history`
      - `id` (uuid, primary key)
      - `leave_request_id` (uuid, foreign key)
      - `action_by` (uuid, foreign key to employees)
      - `action_type` (text, enum: submitted, approved, rejected)
      - `notes` (text, optional)
      - `created_at` (timestamp)

  2. Schema Changes
    - Simplify leave_requests status to: Pending, Approved, Rejected
    - Remove complex approval tracking columns
    - Update constraints and policies

  3. Security
    - Enable RLS on leave_workflow_history
    - Add policies for workflow history access
    - Update existing leave_requests policies
*/

-- Create leave_workflow_history table
CREATE TABLE IF NOT EXISTS leave_workflow_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  action_by uuid NOT NULL REFERENCES employees(id),
  action_type text NOT NULL CHECK (action_type IN ('submitted', 'approved', 'rejected')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on leave_workflow_history
ALTER TABLE leave_workflow_history ENABLE ROW LEVEL SECURITY;

-- Create policies for leave_workflow_history
CREATE POLICY "Users can read workflow history for their leaves"
  ON leave_workflow_history
  FOR SELECT
  TO public
  USING (
    leave_request_id IN (
      SELECT id FROM leave_requests 
      WHERE employee_id = (
        SELECT employee_id FROM employees 
        WHERE id = (
          SELECT employees.id FROM employees 
          WHERE employees.employee_id = (jwt() ->> 'employee_id'::text)
        )
      )
    )
  );

CREATE POLICY "Managers can read workflow history for team leaves"
  ON leave_workflow_history
  FOR SELECT
  TO public
  USING (
    leave_request_id IN (
      SELECT lr.id FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.employee_id
      WHERE e.manager_id = (
        SELECT employees.id FROM employees 
        WHERE employees.employee_id = (jwt() ->> 'employee_id'::text)
      )
    )
  );

CREATE POLICY "HR and Admin can read all workflow history"
  ON leave_workflow_history
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employee_id = (jwt() ->> 'employee_id'::text)
      AND role IN ('HR', 'Admin')
    )
  );

CREATE POLICY "System can insert workflow history"
  ON leave_workflow_history
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Migrate existing leave_requests data to create workflow history
DO $$
DECLARE
  leave_record RECORD;
BEGIN
  -- Create initial "submitted" entries for all existing leaves
  FOR leave_record IN 
    SELECT lr.id, lr.employee_id, lr.created_at, e.id as employee_uuid_id
    FROM leave_requests lr
    JOIN employees e ON lr.employee_id = e.employee_id
  LOOP
    INSERT INTO leave_workflow_history (leave_request_id, action_by, action_type, created_at)
    VALUES (leave_record.id, leave_record.employee_uuid_id, 'submitted', leave_record.created_at);
  END LOOP;

  -- Create approval/rejection entries for processed leaves
  FOR leave_record IN 
    SELECT lr.id, lr.status, lr.approved_by_manager, lr.approved_by_hr, 
           lr.manager_notes, lr.hr_notes, lr.manager_approved_at, lr.hr_approved_at
    FROM leave_requests lr
    WHERE lr.status IN ('Manager_Approved', 'HR_Approved', 'Rejected')
  LOOP
    -- Add manager approval if exists
    IF leave_record.approved_by_manager IS NOT NULL THEN
      INSERT INTO leave_workflow_history (leave_request_id, action_by, action_type, notes, created_at)
      VALUES (
        leave_record.id, 
        leave_record.approved_by_manager, 
        CASE WHEN leave_record.status = 'Rejected' THEN 'rejected' ELSE 'approved' END,
        leave_record.manager_notes,
        COALESCE(leave_record.manager_approved_at, now())
      );
    END IF;

    -- Add HR approval if exists and status is HR_Approved
    IF leave_record.approved_by_hr IS NOT NULL AND leave_record.status = 'HR_Approved' THEN
      INSERT INTO leave_workflow_history (leave_request_id, action_by, action_type, notes, created_at)
      VALUES (
        leave_record.id, 
        leave_record.approved_by_hr, 
        'approved',
        leave_record.hr_notes,
        COALESCE(leave_record.hr_approved_at, now())
      );
    END IF;
  END LOOP;
END $$;

-- Update leave_requests status values to simplified format
UPDATE leave_requests 
SET status = 'Approved' 
WHERE status IN ('Manager_Approved', 'HR_Approved');

-- Drop old constraint and add new simplified constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leave_requests_status_check' 
    AND table_name = 'leave_requests'
  ) THEN
    ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_status_check;
  END IF;
END $$;

ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_status_check 
CHECK (status IN ('Pending', 'Approved', 'Rejected'));

-- Remove old approval tracking columns
DO $$
BEGIN
  -- Drop columns if they exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'approved_by_manager') THEN
    ALTER TABLE leave_requests DROP COLUMN approved_by_manager;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'approved_by_hr') THEN
    ALTER TABLE leave_requests DROP COLUMN approved_by_hr;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'manager_approved_at') THEN
    ALTER TABLE leave_requests DROP COLUMN manager_approved_at;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'hr_approved_at') THEN
    ALTER TABLE leave_requests DROP COLUMN hr_approved_at;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'is_visible_to_hr') THEN
    ALTER TABLE leave_requests DROP COLUMN is_visible_to_hr;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_leave_workflow_history_leave_id ON leave_workflow_history(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_workflow_history_action_by ON leave_workflow_history(action_by);

-- Create function to automatically create workflow history on leave submission
CREATE OR REPLACE FUNCTION create_leave_submission_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create history for new submissions
  IF TG_OP = 'INSERT' THEN
    INSERT INTO leave_workflow_history (leave_request_id, action_by, action_type)
    SELECT NEW.id, e.id, 'submitted'
    FROM employees e
    WHERE e.employee_id = NEW.employee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic workflow history creation
DROP TRIGGER IF EXISTS trigger_create_leave_submission_history ON leave_requests;
CREATE TRIGGER trigger_create_leave_submission_history
  AFTER INSERT ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_leave_submission_history();