/*
  # Fix leave_requests status constraint

  1. Changes
    - Drop existing restrictive status check constraint
    - Add new constraint that allows all status values used by the application
    - This fixes the violation error when creating leave requests

  2. Status Values Allowed
    - 'Pending' - Initial status for new requests
    - 'Manager_Approved' - After manager approval, pending HR
    - 'Approved' - Final approval status
    - 'Rejected' - Rejected at any stage
*/

-- Drop the existing restrictive constraint
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;

-- Add new constraint that allows all status values used by the application
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_status_check 
CHECK (status IN ('Pending', 'Manager_Approved', 'Approved', 'Rejected'));