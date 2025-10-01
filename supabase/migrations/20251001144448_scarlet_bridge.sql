/*
  # Simplify Leave Status System

  1. Changes
    - Remove Manager_Approved status from constraint
    - Update existing Manager_Approved records to Approved
    - Keep only Pending, Approved, Rejected statuses
    - Use approved_by_manager and approved_by_hr fields to track workflow

  2. Workflow Logic
    - Employee sees "Approved" when manager approves (even if HR hasn't approved yet)
    - HR sees requests that need their approval based on approved_by_manager field
    - Final approval requires both manager and HR approval (where applicable)
*/

-- Update existing Manager_Approved records to Approved
UPDATE leave_requests 
SET status = 'Approved' 
WHERE status = 'Manager_Approved';

-- Update the status constraint to only allow the three main statuses
ALTER TABLE leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_status_check;

ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_status_check 
CHECK (status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text]));

-- Ensure approved_by_manager and approved_by_hr fields are properly set for existing data
UPDATE leave_requests 
SET approved_by_manager = (
  SELECT id FROM employees WHERE employee_id = leave_requests.employee_id LIMIT 1
)
WHERE status = 'Approved' 
AND approved_by_manager IS NULL 
AND EXISTS (
  SELECT 1 FROM employees e1 
  WHERE e1.employee_id = leave_requests.employee_id 
  AND e1.manager_id IS NOT NULL
);