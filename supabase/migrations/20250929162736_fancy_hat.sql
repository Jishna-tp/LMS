/*
  # Create leave workflow history table

  1. New Tables
    - `leave_workflow_history`
      - `id` (uuid, primary key)
      - `leave_request_id` (uuid, foreign key to leave_requests)
      - `action_by` (uuid, foreign key to employees)
      - `action_type` (text, check constraint)
      - `notes` (text, nullable)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `leave_workflow_history` table
    - Add policy for public access (simplified for demo)
*/

CREATE TABLE IF NOT EXISTS leave_workflow_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL,
  action_by uuid NOT NULL,
  action_type text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leave_workflow_history ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leave_workflow_history_leave_request_id_fkey'
  ) THEN
    ALTER TABLE leave_workflow_history 
    ADD CONSTRAINT leave_workflow_history_leave_request_id_fkey 
    FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leave_workflow_history_action_by_fkey'
  ) THEN
    ALTER TABLE leave_workflow_history 
    ADD CONSTRAINT leave_workflow_history_action_by_fkey 
    FOREIGN KEY (action_by) REFERENCES employees(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add check constraint for action_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leave_workflow_history_action_type_check'
  ) THEN
    ALTER TABLE leave_workflow_history 
    ADD CONSTRAINT leave_workflow_history_action_type_check 
    CHECK (action_type = ANY (ARRAY['submitted'::text, 'approved'::text, 'rejected'::text]));
  END IF;
END $$;

-- Add RLS policies
CREATE POLICY "Public access to leave_workflow_history"
  ON leave_workflow_history
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);