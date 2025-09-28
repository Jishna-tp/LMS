import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

export interface User {
  id: string
  username: string
  employee_id: string
  employee: {
    id: string
    employee_id: string
    name: string
    email: string
    role: 'Employee' | 'Manager' | 'HR' | 'Admin'
    department: string
    manager_id: string | null
  }
}

export interface AuthState {
  user: User | null
  loading: boolean
}

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10)
}

// Verify password
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash)
}

// Sign up
export const signUp = async (employeeId: string, username: string, password: string) => {
  try {
    // Check if employee exists
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('employee_id', employeeId)
      .single()

    if (employeeError || !employee) {
      throw new Error('Employee ID not found')
    }

    // Check if user already exists for this employee
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('*')
      .eq('employee_id', employeeId)
      .single()

    if (existingUser) {
      throw new Error('User already exists for this Employee ID')
    }

    // Check if username is taken
    const { data: usernameCheck, error: usernameError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (usernameCheck) {
      throw new Error('Username already taken')
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)
    
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{
        employee_id: employeeId,
        username,
        password_hash: passwordHash
      }])
      .select()
      .single()

    if (createError) {
      throw createError
    }

    return { success: true, user: newUser }
  } catch (error: any) {
    throw new Error(error.message || 'Sign up failed')
  }
}

// Sign in
export const signIn = async (username: string, password: string) => {
  try {
    // Get user with employee data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        employees:employee_id (
          id,
          employee_id,
          name,
          email,
          role,
          department,
          manager_id
        )
      `)
      .eq('username', username)
      .single()

    if (userError || !user) {
      throw new Error('Invalid credentials')
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)
    
    if (!isValid) {
      throw new Error('Invalid credentials')
    }

    // Format user data
    const formattedUser: User = {
      id: user.id,
      username: user.username,
      employee_id: user.employee_id,
      employee: user.employees as any
    }

    return { success: true, user: formattedUser }
  } catch (error: any) {
    throw new Error(error.message || 'Sign in failed')
  }
}

// Get current user from localStorage
export const getCurrentUser = (): User | null => {
  try {
    const userData = localStorage.getItem('user')
    return userData ? JSON.parse(userData) : null
  } catch {
    return null
  }
}

// Save user to localStorage
export const saveUser = (user: User) => {
  localStorage.setItem('user', JSON.stringify(user))
}

// Clear user from localStorage
export const clearUser = () => {
  localStorage.removeItem('user')
}

// Change password
export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  try {
    // Get current user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      throw new Error('User not found')
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.password_hash)
    
    if (!isValid) {
      throw new Error('Current password is incorrect')
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId)

    if (updateError) {
      throw updateError
    }

    return { success: true }
  } catch (error: any) {
    throw new Error(error.message || 'Password change failed')
  }
}