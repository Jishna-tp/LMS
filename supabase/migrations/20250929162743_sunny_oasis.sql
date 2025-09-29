/*
  # Fix leave request status values

  1. Changes
    - Update status check constraint to include Manager_Approved and HR_Approved
    - Add approved_by_manager and approved_by_hr columns if missing
    - Add manager_approved_at and hr_approved_at columns if missing

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing status check constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leave_requests_status_check'
  ) THEN
    ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_status_check;
  END IF;
END $$;

-- Add new status check constraint with correct values
ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_status_check 
CHECK (status = ANY (ARRAY['Pending'::text, 'Manager_Approved'::text, 'HR_Approved'::text, 'Approved'::text, 'Rejected'::text]));

-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'approved_by_manager'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN approved_by_manager uuid;
    ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_approved_by_manager_fkey 
    FOREIGN KEY (approved_by_manager) REFERENCES employees(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'approved_by_hr'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN approved_by_hr uuid;
    ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_approved_by_hr_fkey 
    FOREIGN KEY (approved_by_hr) REFERENCES employees(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'is_visible_to_hr'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN is_visible_to_hr boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'manager_approved_at'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN manager_approved_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'hr_approved_at'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN hr_approved_at timestamptz;
  END IF;
END $$;