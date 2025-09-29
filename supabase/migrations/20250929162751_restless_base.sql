/*
  # Fix notification types

  1. Changes
    - Update notification type check constraint to include leave_manager_approved
    - Ensure all required notification types are supported

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing notification type check constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

-- Add new notification type check constraint with all required values
ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY['leave_approved'::text, 'leave_rejected'::text, 'leave_submitted'::text, 'leave_manager_approved'::text]));