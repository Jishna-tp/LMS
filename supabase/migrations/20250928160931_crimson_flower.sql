/*
  # Add approval timestamp columns to leave_requests table

  1. New Columns
    - `manager_approved_at` (timestamp with time zone, nullable)
    - `hr_approved_at` (timestamp with time zone, nullable)
  
  2. Purpose
    - Track when manager and HR approvals occurred
    - Support workflow history and audit trail
*/

-- Add manager_approved_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'manager_approved_at'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN manager_approved_at timestamptz;
  END IF;
END $$;

-- Add hr_approved_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'hr_approved_at'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN hr_approved_at timestamptz;
  END IF;
END $$;