/*
  # Add notifications table

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to employees)
      - `title` (text)
      - `message` (text)
      - `type` (text, enum: leave_approved, leave_rejected, leave_submitted, leave_manager_approved)
      - `is_read` (boolean, default false)
      - `related_leave_id` (uuid, foreign key to leave_requests, nullable)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `notifications` table
    - Add policy for users to read their own notifications
    - Add policy for users to update their own notifications (mark as read)
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('leave_approved', 'leave_rejected', 'leave_submitted', 'leave_manager_approved')),
  is_read boolean DEFAULT false,
  related_leave_id uuid REFERENCES leave_requests(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO public
  USING (user_id = (SELECT id FROM employees WHERE employee_id = auth.jwt() ->> 'employee_id'));

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO public
  USING (user_id = (SELECT id FROM employees WHERE employee_id = auth.jwt() ->> 'employee_id'));

CREATE POLICY "System can insert notifications"
  ON notifications
  FOR INSERT
  TO public
  WITH CHECK (true);