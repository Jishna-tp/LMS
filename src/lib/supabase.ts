import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string
          employee_id: string
          name: string
          email: string
          role: 'Employee' | 'Manager' | 'HR' | 'Admin'
          department: string
          manager_id: string | null
          hire_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id?: string
          name: string
          email: string
          role: 'Employee' | 'Manager' | 'HR' | 'Admin'
          department: string
          manager_id?: string | null
          hire_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          name?: string
          email?: string
          role?: 'Employee' | 'Manager' | 'HR' | 'Admin'
          department?: string
          manager_id?: string | null
          hire_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          employee_id: string
          username: string
          password_hash: string
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          username: string
          password_hash: string
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          username?: string
          password_hash?: string
          created_at?: string
        }
      }
      leave_requests: {
        Row: {
          id: string
          employee_id: string
          type: 'Annual' | 'Sick' | 'Personal' | 'Maternity' | 'Paternity' | 'Emergency'
          start_date: string
          end_date: string
          days_requested: number
          reason: string | null
          status: 'Pending' | 'Approved' | 'Rejected'
          manager_notes: string | null
          hr_notes: string | null
          approved_by_manager: string | null
          approved_by_hr: string | null
          is_visible_to_hr: boolean
          manager_approved_at: string | null
          hr_approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          type: 'Annual' | 'Sick' | 'Personal' | 'Maternity' | 'Paternity' | 'Emergency'
          start_date: string
          end_date: string
          days_requested: number
          reason?: string | null
          status?: 'Pending' | 'Approved' | 'Rejected'
          manager_notes?: string | null
          hr_notes?: string | null
          approved_by_manager?: string | null
          approved_by_hr?: string | null
          is_visible_to_hr?: boolean
          manager_approved_at?: string | null
          hr_approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          type?: 'Annual' | 'Sick' | 'Personal' | 'Maternity' | 'Paternity' | 'Emergency'
          start_date?: string
          end_date?: string
          days_requested?: number
          reason?: string | null
          status?: 'Pending' | 'Approved' | 'Rejected'
          manager_notes?: string | null
          hr_notes?: string | null
          approved_by_manager?: string | null
          approved_by_hr?: string | null
          is_visible_to_hr?: boolean
          manager_approved_at?: string | null
          hr_approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leave_workflow_history: {
        Row: {
          id: string
          leave_request_id: string
          action_by: string
          action_type: 'submitted' | 'manager_approved' | 'hr_approved' | 'rejected' | 'auto_approved'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          leave_request_id: string
          action_by: string
          action_type: 'submitted' | 'manager_approved' | 'hr_approved' | 'rejected' | 'auto_approved'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          leave_request_id?: string
          action_by?: string
          action_type?: 'submitted' | 'manager_approved' | 'hr_approved' | 'rejected' | 'auto_approved'
          notes?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: 'leave_approved' | 'leave_rejected' | 'leave_submitted' | 'leave_manager_approved'
          is_read: boolean
          related_leave_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: 'leave_approved' | 'leave_rejected' | 'leave_submitted' | 'leave_manager_approved'
          is_read?: boolean
          related_leave_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: 'leave_approved' | 'leave_rejected' | 'leave_submitted' | 'leave_manager_approved'
          is_read?: boolean
          related_leave_id?: string | null
          created_at?: string
        }
      }
    }
  }
}