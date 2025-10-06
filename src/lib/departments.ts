import { supabase, isSupabaseConfigured } from './supabase'

export interface Department {
  id: string
  name: string
  head_id: string | null
  created_at: string
  updated_at: string
  head?: {
    id: string
    name: string
    employee_id: string
  }
  employee_count?: number
}

export interface DepartmentEmployee {
  id: string
  employee_id: string
  name: string
  email: string
  role: 'Employee' | 'Manager' | 'HR' | 'Admin'
  department: string
  manager_id: string | null
  hire_date: string
  is_active: boolean
  current_leave?: {
    id: string
    type: string
    start_date: string
    end_date: string
    status: string
    days_requested: number
  }
}

// Get all departments
export const getDepartments = async () => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: [] }
  }

  try {
    const { data, error } = await supabase
      .from('departments')
      .select(`
        *,
        head:employees!departments_head_id_fkey (id, name, employee_id)
      `)
      .order('name')

    if (error) throw error

    // Get employee counts for each department
    const departmentsWithCounts = await Promise.all(
      (data || []).map(async (dept) => {
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact' })
          .eq('department', dept.name)

        return {
          ...dept,
          employee_count: count || 0
        }
      })
    )

    return { success: true, data: departmentsWithCounts }
  } catch (error: any) {
    console.error('Error fetching departments:', error)
    return { success: false, error: error.message, data: [] }
  }
}

// Get department by ID
export const getDepartmentById = async (departmentId: string) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: null }
  }

  try {
    const { data, error } = await supabase
      .from('departments')
      .select(`
        *,
        head:employees!departments_head_id_fkey (id, name, employee_id)
      `)
      .eq('id', departmentId)
      .single()

    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching department:', error)
    return { success: false, error: error.message, data: null }
  }
}

// Create or update department
export const saveDepartment = async (department: Partial<Department>, isEdit: boolean = false) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    if (isEdit && department.id) {
      const { error } = await supabase
        .from('departments')
        .update({
          name: department.name,
          head_id: department.head_id
        })
        .eq('id', department.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('departments')
        .insert([{
          name: department.name,
          head_id: department.head_id
        }])

      if (error) throw error
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error saving department:', error)
    return { success: false, error: error.message }
  }
}

// Delete department
export const deleteDepartment = async (departmentId: string) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    // Check if department has employees
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact' })
      .eq('department', departmentId)

    if (count && count > 0) {
      return { success: false, error: 'Cannot delete department with existing employees' }
    }

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', departmentId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting department:', error)
    return { success: false, error: error.message }
  }
}

// Get employees in a department with their current leave status
export const getDepartmentEmployees = async (departmentName: string) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: [] }
  }

  try {
    // Get all employees in the department
    const { data: employees, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('department', departmentName)
      .order('name')

    if (employeeError) throw employeeError

    // Get current leave requests for these employees
    const employeeIds = employees?.map(emp => emp.employee_id) || []
    
    let currentLeaves: any[] = []
    if (employeeIds.length > 0) {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: leaves, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*')
        .in('employee_id', employeeIds)
        .lte('start_date', today)
        .gte('end_date', today)
        .in('status', ['Approved', 'Pending'])

      if (leaveError) throw leaveError
      currentLeaves = leaves || []
    }

    // Combine employee data with leave information
    const employeesWithLeaves: DepartmentEmployee[] = (employees || []).map(employee => {
      const currentLeave = currentLeaves.find(leave => leave.employee_id === employee.employee_id)
      
      return {
        id: employee.id,
        employee_id: employee.employee_id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        manager_id: employee.manager_id,
        hire_date: employee.hire_date,
        is_active: true, // Assuming all employees are active by default
        current_leave: currentLeave ? {
          id: currentLeave.id,
          type: currentLeave.type,
          start_date: currentLeave.start_date,
          end_date: currentLeave.end_date,
          status: currentLeave.status,
          days_requested: currentLeave.days_requested
        } : undefined
      }
    })

    return { success: true, data: employeesWithLeaves }
  } catch (error: any) {
    console.error('Error fetching department employees:', error)
    return { success: false, error: error.message, data: [] }
  }
}

// Get department statistics
export const getDepartmentStats = async () => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: null }
  }

  try {
    // Get total departments
    const { count: totalDepartments } = await supabase
      .from('departments')
      .select('*', { count: 'exact' })

    // Get departments with employee counts
    const { data: departments } = await supabase
      .from('departments')
      .select('name')

    let departmentStats = []
    if (departments) {
      for (const dept of departments) {
        const { count: employeeCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact' })
          .eq('department', dept.name)

        // Get current leave count for this department
        const today = new Date().toISOString().split('T')[0]
        const { count: onLeaveCount } = await supabase
          .from('leave_requests')
          .select('employee_id', { count: 'exact' })
          .eq('status', 'Approved')
          .lte('start_date', today)
          .gte('end_date', today)
          .in('employee_id', 
            await supabase
              .from('employees')
              .select('employee_id')
              .eq('department', dept.name)
              .then(res => res.data?.map(e => e.employee_id) || [])
          )

        departmentStats.push({
          name: dept.name,
          employeeCount: employeeCount || 0,
          onLeaveCount: onLeaveCount || 0,
          availableCount: (employeeCount || 0) - (onLeaveCount || 0)
        })
      }
    }

    return {
      success: true,
      data: {
        totalDepartments: totalDepartments || 0,
        departmentStats
      }
    }
  } catch (error: any) {
    console.error('Error fetching department stats:', error)
    return { success: false, error: error.message, data: null }
  }
}

// Get departments accessible to user based on role
export const getAccessibleDepartments = async (userRole: string, userDepartment: string, userId: string) => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', data: [] }
  }

  try {
    let query = supabase
      .from('departments')
      .select(`
        *,
        head:employees!departments_head_id_fkey (id, name, employee_id)
      `)

    // Apply access control based on role
    if (userRole === 'Admin' || userRole === 'HR') {
      // Admin and HR can see all departments
      query = query.order('name')
    } else if (userRole === 'Manager') {
      // Managers can see only their department
      query = query.eq('name', userDepartment).order('name')
    } else {
      // Employees can see only their department (optional feature)
      query = query.eq('name', userDepartment).order('name')
    }

    const { data, error } = await query

    if (error) throw error

    // Get employee counts for each department
    const departmentsWithCounts = await Promise.all(
      (data || []).map(async (dept) => {
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact' })
          .eq('department', dept.name)

        return {
          ...dept,
          employee_count: count || 0
        }
      })
    )

    return { success: true, data: departmentsWithCounts }
  } catch (error: any) {
    console.error('Error fetching accessible departments:', error)
    return { success: false, error: error.message, data: [] }
  }
}