/*
  # Add is_visible_to_hr column to leave_requests table

  1. Changes
    - Add `is_visible_to_hr` column to `leave_requests` table
    - Set default value to false
    - Update existing records to set appropriate visibility based on current status

  2. Security
    - No RLS changes needed as this is just adding a column
*/

-- Add the missing column
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS is_visible_to_hr boolean DEFAULT false;

-- Update existing records: make approved/rejected leaves visible to HR
UPDATE leave_requests 
SET is_visible_to_hr = true 
WHERE status IN ('Approved', 'Rejected');