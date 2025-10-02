import { supabase, isSupabaseConfigured } from './supabase'

export interface LeavePolicy {
  id: string
  name: string
  code: string
  description: string | null
  annual_entitlement: number
  carry_forward_allowed: boolean
  max_carry_forward_days: number | null
  encashment_allowed: boolean
  max_encashment_days: number | null
  min_service_months: number
  gender_restriction: 'Male' | 'Female' | null
  department_restriction: string[] | null
  approval_workflow: 'single' | 'multi'
  max_consecutive_days: number | null
  advance_notice_days: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface EmployeeLeaveBalance {
  id: string
  employee_id: string
  policy_id: string
  year: number
  opening_balance: number
  annual_entitlement: number
  used_balance: number
  pending_balance: number
  available_balance: number
  carry_forward_balance: number
  encashed_balance: number
  created_at: string
  updated_at: string
  policy?: LeavePolicy
  employee?: {
    name: string
    department: string
  }
}

export interface LeaveValidationResult {
  valid: boolean
  errors: string[]
  available_balance?: number
}

// Get all leave policies
export const getLeavePolicies = async (activeOnly: boolean = true) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: [] }
  }

  try {
    let query = supabase
      .from('leave_policies')
      .select('*')
      .order('name')

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('Error fetching leave policies:', error)
    return { success: false, error: error.message, data: [] }
  }
}

// Get leave policy by code
export const getLeavePolicyByCode = async (code: string) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: null }
  }

  try {
    const { data, error } = await supabase
      .from('leave_policies')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching leave policy:', error)
    return { success: false, error: error.message, data: null }
  }
}

// Create or update leave policy
export const saveLeavePolicy = async (policy: Partial<LeavePolicy>, isEdit: boolean = false) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    if (isEdit && policy.id) {
      const { error } = await supabase
        .from('leave_policies')
        .update(policy)
        .eq('id', policy.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('leave_policies')
        .insert([policy])

      if (error) throw error
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error saving leave policy:', error)
    return { success: false, error: error.message }
  }
}

// Delete leave policy
export const deleteLeavePolicy = async (policyId: string) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    const { error } = await supabase
      .from('leave_policies')
      .delete()
      .eq('id', policyId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting leave policy:', error)
    return { success: false, error: error.message }
  }
}

// Get employee leave balances
export const getEmployeeLeaveBalances = async (employeeId: string, year?: number) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: [] }
  }

  try {
    let query = supabase
      .from('employee_leave_balances')
      .select(`
        *,
        policy:leave_policies(*),
        employee:employees!employee_leave_balances_employee_id_fkey(name, department)
      `)
      .eq('employee_id', employeeId)
      .order('policy(name)')

    if (year) {
      query = query.eq('year', year)
    } else {
      query = query.eq('year', new Date().getFullYear())
    }

    const { data, error } = await query

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('Error fetching employee leave balances:', error)
    return { success: false, error: error.message, data: [] }
  }
}

// Get all employee balances (for HR/Admin)
export const getAllEmployeeBalances = async (year?: number) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: [] }
  }

  try {
    let query = supabase
      .from('employee_leave_balances')
      .select(`
        *,
        policy:leave_policies(*),
        employee:employees!employee_leave_balances_employee_id_fkey(name, department, role)
      `)
      .order('employee(name)')

    if (year) {
      query = query.eq('year', year)
    } else {
      query = query.eq('year', new Date().getFullYear())
    }

    const { data, error } = await query

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('Error fetching all employee balances:', error)
    return { success: false, error: error.message, data: [] }
  }
}

// Validate leave request against policy
export const validateLeaveRequest = async (
  employeeId: string,
  policyCode: string,
  startDate: string,
  endDate: string,
  daysRequested: number
): Promise<LeaveValidationResult> => {
  if (!isSupabaseConfigured()) {
    return { valid: false, errors: ['System not configured'] }
  }

  try {
    const { data, error } = await supabase.rpc('validate_leave_request', {
      emp_id: employeeId,
      policy_code: policyCode,
      start_date: startDate,
      end_date: endDate,
      days_requested: daysRequested
    })

    if (error) throw error
    return data as LeaveValidationResult
  } catch (error: any) {
    console.error('Error validating leave request:', error)
    return { valid: false, errors: [error.message] }
  }
}

// Initialize leave balances for employee
export const initializeEmployeeLeaveBalances = async (employeeId: string, hireDate?: string) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    const { error } = await supabase.rpc('initialize_employee_leave_balances', {
      emp_id: employeeId,
      hire_date: hireDate || new Date().toISOString().split('T')[0]
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error initializing leave balances:', error)
    return { success: false, error: error.message }
  }
}

// Update leave balance (for manual adjustments)
export const updateLeaveBalance = async (
  balanceId: string,
  updates: Partial<EmployeeLeaveBalance>
) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    const { error } = await supabase
      .from('employee_leave_balances')
      .update(updates)
      .eq('id', balanceId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error updating leave balance:', error)
    return { success: false, error: error.message }
  }
}

// Get leave policy statistics
export const getLeavePolicyStats = async () => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: null }
  }

  try {
    const { data: policies, error: policiesError } = await supabase
      .from('leave_policies')
      .select('id, name, code')
      .eq('is_active', true)

    if (policiesError) throw policiesError

    const { data: balances, error: balancesError } = await supabase
      .from('employee_leave_balances')
      .select('policy_id, used_balance, available_balance')
      .eq('year', new Date().getFullYear())

    if (balancesError) throw balancesError

    const stats = policies?.map(policy => {
      const policyBalances = balances?.filter(b => b.policy_id === policy.id) || []
      const totalUsed = policyBalances.reduce((sum, b) => sum + (b.used_balance || 0), 0)
      const totalAvailable = policyBalances.reduce((sum, b) => sum + (b.available_balance || 0), 0)
      
      return {
        policy: policy.name,
        code: policy.code,
        totalUsed,
        totalAvailable,
        employeeCount: policyBalances.length
      }
    })

    return { success: true, data: stats }
  } catch (error: any) {
    console.error('Error fetching leave policy stats:', error)
    return { success: false, error: error.message, data: null }
  }
}