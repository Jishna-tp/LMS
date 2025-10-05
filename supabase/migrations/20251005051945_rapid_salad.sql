/*
  # Add Submitted status to leave_requests table

  1. Changes
     - Drop existing status check constraint
     - Add new constraint that includes 'Submitted' status
     - Update constraint to allow: Submitted, Pending, Approved, Rejected

  2. Status Flow
     - Submitted: Initial status when employee submits request
     - Pending: Waiting for approval
     - Approved: Request approved
     - Rejected: Request rejected
*/

-- Drop the existing status constraint
ALTER TABLE leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_status_check;

-- Add new constraint with Submitted status included
ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_status_check 
CHECK (status = ANY (ARRAY['Submitted'::text, 'Pending'::text, 'Approved'::text, 'Rejected'::text]));