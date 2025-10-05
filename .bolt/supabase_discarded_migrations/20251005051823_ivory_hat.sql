/*
  # Add Submitted status to leave_requests table

  1. Changes
    - Update the status check constraint to include 'Submitted' as a valid status
    - This allows leave requests to have a 'Submitted' status in addition to existing statuses

  2. Status Flow
    - Submitted: Initial status when employee submits a leave request
    - Pending: When request needs approval (existing)
    - Manager_Approved: When manager has approved (existing)
    - HR_Approved: When HR has approved (existing)
    - Approved: Final approval status (existing)
    - Rejected: When request is rejected (existing)
*/

-- Drop the existing check constraint
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;

-- Add the new check constraint with 'Submitted' included
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check 
  CHECK (status = ANY (ARRAY['Submitted'::text, 'Pending'::text, 'Manager_Approved'::text, 'HR_Approved'::text, 'Approved'::text, 'Rejected'::text]));