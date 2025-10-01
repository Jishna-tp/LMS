/*
  # Update Leave Workflow System

  1. Schema Updates
    - Simplify leave status to: Pending, Approved, Rejected
    - Remove Manager_Approved and HR_Approved statuses
    - Update status check constraints

  2. Workflow Logic
    - HR requests are auto-approved
    - Admin/Manager requests go directly to HR
    - Employee requests: Manager → HR workflow
    - Maintain workflow history for audit trail

  3. Notification System
    - Enhanced notification types
    - Proper workflow notifications
*/

-- Update leave_requests status constraint
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check 
  CHECK (status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text]));

-- Update existing Manager_Approved and HR_Approved statuses to new simplified statuses
UPDATE leave_requests 
SET status = 'Approved' 
WHERE status IN ('Manager_Approved', 'HR_Approved');

-- Add index for better query performance on leave requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status 
  ON leave_requests(employee_id, status);

CREATE INDEX IF NOT EXISTS idx_leave_requests_status_created 
  ON leave_requests(status, created_at);

-- Add index for workflow history
CREATE INDEX IF NOT EXISTS idx_workflow_history_leave_created 
  ON leave_workflow_history(leave_request_id, created_at);

-- Update notification types constraint to include new types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY (ARRAY[
    'leave_approved'::text, 
    'leave_rejected'::text, 
    'leave_submitted'::text, 
    'leave_manager_approved'::text
  ]));

-- Add indexes for better notification performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON notifications(user_id, created_at DESC);