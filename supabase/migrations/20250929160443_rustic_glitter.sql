/*
  # Simplify Leave Workflow and Add History Tracking

  1. New Tables
    - `leave_workflow_history`
      - `id` (uuid, primary key)
      - `leave_request_id` (uuid, foreign key to leave_requests)
      - `action_by` (uuid, foreign key to employees)
      - `action_type` (text, enum: submitted, manager_approved, hr_approved, rejected, auto_approved)
      - `notes` (text, optional notes from approver)
      - `created_at` (timestamp)

  2. Schema Changes
    - Simplify leave_requests.status to: Pending, Approved, Rejected
    - Remove complex approval tracking columns
    - Keep essential approval metadata

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
  action_type text NOT NULL CHECK (action_type IN ('submitted', 'manager_approved', 'hr_approved', 'rejected', 'auto_approved')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on leave_workflow_history
ALTER TABLE leave_workflow_history ENABLE ROW LEVEL SECURITY;

-- Update leave_requests status constraint to simplified values
DO $$
BEGIN
  -- Drop existing constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leave_requests_status_check' 
    AND table_name = 'leave_requests'
  ) THEN
    ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_status_check;
  END IF;
  
  -- Add new simplified constraint
  ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check 
    CHECK (status IN ('Pending', 'Approved', 'Rejected'));
END $$;

-- Remove complex approval tracking columns (keep essential ones for backward compatibility)
DO $$
BEGIN
  -- Remove manager_approved_at if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'manager_approved_at'
  ) THEN
    ALTER TABLE leave_requests DROP COLUMN manager_approved_at;
  END IF;

  -- Remove hr_approved_at if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'hr_approved_at'
  ) THEN
    ALTER TABLE leave_requests DROP COLUMN hr_approved_at;
  END IF;

  -- Remove is_visible_to_hr if it exists (no longer needed with simplified workflow)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'is_visible_to_hr'
  ) THEN
    ALTER TABLE leave_requests DROP COLUMN is_visible_to_hr;
  END IF;
END $$;

-- Update existing leave statuses to simplified format
UPDATE leave_requests 
SET status = 'Approved' 
WHERE status IN ('Manager_Approved', 'HR_Approved');

-- Create policies for leave_workflow_history
CREATE POLICY "Users can read workflow history for their own leaves"
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

CREATE POLICY "Managers can read workflow history for their team's leaves"
  ON leave_workflow_history
  FOR SELECT
  TO public
  USING (
    leave_request_id IN (
      SELECT lr.id FROM leave_requests lr
      JOIN employees e ON e.employee_id = lr.employee_id
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leave_workflow_history_leave_id 
  ON leave_workflow_history(leave_request_id);

CREATE INDEX IF NOT EXISTS idx_leave_workflow_history_action_by 
  ON leave_workflow_history(action_by);

CREATE INDEX IF NOT EXISTS idx_leave_workflow_history_created_at 
  ON leave_workflow_history(created_at DESC);

-- Create function to automatically create workflow history when leave status changes
CREATE OR REPLACE FUNCTION create_leave_workflow_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create history for status changes (not initial creation)
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO leave_workflow_history (
      leave_request_id,
      action_by,
      action_type,
      notes,
      created_at
    ) VALUES (
      NEW.id,
      COALESCE(NEW.approved_by_manager, NEW.approved_by_hr, (
        SELECT id FROM employees WHERE employee_id = NEW.employee_id
      )),
      CASE 
        WHEN NEW.status = 'Approved' THEN 'hr_approved'
        WHEN NEW.status = 'Rejected' THEN 'rejected'
        ELSE 'submitted'
      END,
      COALESCE(NEW.hr_notes, NEW.manager_notes),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic workflow history
DROP TRIGGER IF EXISTS trigger_leave_workflow_history ON leave_requests;
CREATE TRIGGER trigger_leave_workflow_history
  AFTER UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_leave_workflow_history();

-- Migrate existing leave requests to have initial workflow history
INSERT INTO leave_workflow_history (leave_request_id, action_by, action_type, created_at)
SELECT 
  lr.id,
  e.id,
  'submitted',
  lr.created_at
FROM leave_requests lr
JOIN employees e ON e.employee_id = lr.employee_id
WHERE NOT EXISTS (
  SELECT 1 FROM leave_workflow_history lwh 
  WHERE lwh.leave_request_id = lr.id
);