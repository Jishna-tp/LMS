# Absentra API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Employee Management](#employee-management)
4. [Leave Management](#leave-management)
5. [Leave Policies](#leave-policies)
6. [Holiday Management](#holiday-management)
7. [Notifications](#notifications)
8. [Reporting](#reporting)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)

## Overview

The Absentra API is built on Supabase and provides RESTful endpoints for managing employee leave requests, policies, and related data. All API interactions are handled through the Supabase client with custom business logic implemented in TypeScript.

### Base Configuration
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
```

### Response Format
All API responses follow a consistent format:
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
```

## Authentication

### Custom Authentication System

The application uses a custom authentication system with bcrypt for password hashing.

#### Sign Up
```typescript
// Function: signUp
// File: src/lib/auth.ts

interface SignUpRequest {
  employeeId: string
  username: string
  password: string
}

interface SignUpResponse {
  success: boolean
  user?: User
  error?: string
}

// Usage
const result = await signUp('EMP001', 'john.doe', 'securePassword123')
```

**Implementation**:
```typescript
export const signUp = async (employeeId: string, username: string, password: string) => {
  try {
    // Verify employee exists
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('employee_id', employeeId)
      .single()

    if (employeeError || !employee) {
      throw new Error('Employee ID not found')
    }

    // Check for existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('employee_id', employeeId)
      .single()

    if (existingUser) {
      throw new Error('User already exists for this Employee ID')
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

    if (createError) throw createError

    return { success: true, user: newUser }
  } catch (error: any) {
    throw new Error(error.message || 'Sign up failed')
  }
}
```

#### Sign In
```typescript
// Function: signIn
// File: src/lib/auth.ts

interface SignInRequest {
  username: string
  password: string
}

interface User {
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

// Usage
const result = await signIn('john.doe', 'securePassword123')
```

#### Change Password
```typescript
// Function: changePassword
// File: src/lib/auth.ts

const result = await changePassword(userId, currentPassword, newPassword)
```

## Employee Management

### Get Employees
```typescript
// Supabase Query
const { data, error } = await supabase
  .from('employees')
  .select(`
    *,
    manager:manager_id (name)
  `)
  .order('created_at', { ascending: false })
```

### Create Employee
```typescript
// Insert new employee
const { data, error } = await supabase
  .from('employees')
  .insert([{
    name: 'John Doe',
    email: 'john.doe@company.com',
    role: 'Employee',
    department: 'Engineering',
    manager_id: 'manager-uuid',
    hire_date: '2024-01-15'
  }])
  .select()
  .single()
```

### Update Employee
```typescript
// Update employee information
const { error } = await supabase
  .from('employees')
  .update({
    name: 'John Smith',
    department: 'Product',
    role: 'Manager'
  })
  .eq('id', employeeId)
```

### Delete Employee
```typescript
// Delete employee (cascades to users table)
const { error } = await supabase
  .from('employees')
  .delete()
  .eq('id', employeeId)
```

## Leave Management

### Submit Leave Request
```typescript
// Function: submitLeaveRequest
// File: src/components/leaves/LeaveManagement.tsx

interface LeaveRequest {
  employee_id: string
  type: 'Annual' | 'Sick' | 'Personal' | 'Maternity' | 'Paternity' | 'Emergency'
  start_date: string // YYYY-MM-DD
  end_date: string   // YYYY-MM-DD
  days_requested: number
  reason?: string
  status: 'Submitted' | 'Pending' | 'Approved' | 'Rejected'
}

// Implementation
const { data: newLeave, error } = await supabase
  .from('leave_requests')
  .insert([{
    employee_id: user.employee.employee_id,
    type: formatLeaveTypeForDb(formData.type),
    start_date: formData.start_date,
    end_date: formData.end_date,
    days_requested: calculateDays(formData.start_date, formData.end_date),
    reason: formData.reason,
    status: initialStatus
  }])
  .select()
  .single()
```

### Get Leave Requests
```typescript
// Get user's leave requests
const { data, error } = await supabase
  .from('leave_requests')
  .select(`
    *,
    employees:employee_id (id, name, department, role),
    workflow_history:leave_workflow_history (
      id,
      action_by,
      action_type,
      notes,
      created_at,
      actor:employees!leave_workflow_history_action_by_fkey (name, role)
    )
  `)
  .eq('employee_id', employeeId)
  .order('created_at', { ascending: false })
```

### Approve/Reject Leave Request
```typescript
// Manager/HR approval
const { error } = await supabase
  .from('leave_requests')
  .update({
    status: newStatus,
    manager_notes: notes,
    approved_by_manager: user.employee.id,
    manager_approved_at: new Date().toISOString()
  })
  .eq('id', leaveId)

// Add to workflow history
await supabase
  .from('leave_workflow_history')
  .insert([{
    leave_request_id: leaveId,
    action_by: user.employee.id,
    action_type: action === 'approve' ? 'approved' : 'rejected',
    notes: notes || null
  }])
```

### Leave Validation
```typescript
// Function: validateLeaveRequest
// File: src/lib/leavePolicy.ts

interface LeaveValidationResult {
  valid: boolean
  errors: string[]
  available_balance?: number
}

const result = await validateLeaveRequest(
  employeeId,
  policyCode,
  startDate,
  endDate,
  daysRequested
)
```

## Leave Policies

### Get Leave Policies
```typescript
// Function: getLeavePolicies
// File: src/lib/leavePolicy.ts

const result = await getLeavePolicies(activeOnly = true)

// Implementation
let query = supabase
  .from('leave_policies')
  .select('*')
  .order('name')

if (activeOnly) {
  query = query.eq('is_active', true)
}

const { data, error } = await query
```

### Create/Update Leave Policy
```typescript
// Function: saveLeavePolicy
// File: src/lib/leavePolicy.ts

interface LeavePolicy {
  id?: string
  name: string
  code: string
  description?: string
  annual_entitlement: number
  carry_forward_allowed: boolean
  max_carry_forward_days?: number
  encashment_allowed: boolean
  max_encashment_days?: number
  min_service_months: number
  gender_restriction?: 'Male' | 'Female'
  department_restriction?: string[]
  approval_workflow: 'single' | 'multi'
  max_consecutive_days?: number
  advance_notice_days: number
  is_active: boolean
}

const result = await saveLeavePolicy(policyData, isEdit)
```

### Get Employee Leave Balances
```typescript
// Function: getEmployeeLeaveBalances
// File: src/lib/leavePolicy.ts

const result = await getEmployeeLeaveBalances(employeeId, year)

// Implementation
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
```

### Update Leave Balance
```typescript
// Function: updateLeaveBalance
// File: src/lib/leavePolicy.ts

const result = await updateLeaveBalance(balanceId, {
  opening_balance: 5.0,
  annual_entitlement: 21.0,
  used_balance: 3.5
})
```

## Holiday Management

### Get Holidays
```typescript
// Get holidays for date range
const { data, error } = await supabase
  .from('holidays')
  .select(`
    *,
    creator:created_by (name)
  `)
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date', { ascending: true })
```

### Create Holiday
```typescript
// Create new holiday
const { error } = await supabase
  .from('holidays')
  .insert([{
    name: 'Independence Day',
    date: '2024-07-04',
    type: 'National',
    is_recurring: true,
    description: 'National holiday',
    created_by: user.employee.id
  }])
```

### Bulk Holiday Import
```typescript
// Import multiple holidays
const holidays = [
  {
    name: 'New Year\'s Day',
    date: '2024-01-01',
    type: 'National',
    is_recurring: true,
    created_by: user.employee.id
  },
  // ... more holidays
]

const { error } = await supabase
  .from('holidays')
  .insert(holidays)
```

## Notifications

### Create Notification
```typescript
// Function: createNotification
// File: src/lib/notifications.ts

const result = await createNotification(
  userId,
  'Leave Request Approved',
  'Your annual leave request has been approved.',
  'leave_approved',
  leaveRequestId
)

// Implementation
const { error } = await supabase
  .from('notifications')
  .insert([{
    user_id: userId,
    title,
    message,
    type,
    related_leave_id: relatedLeaveId || null
  }])
```

### Get User Notifications
```typescript
// Function: getUserNotifications
// File: src/lib/notifications.ts

const result = await getUserNotifications(userId)

// Implementation
const { data, error } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
```

### Mark Notifications as Read
```typescript
// Mark single notification as read
const result = await markNotificationAsRead(notificationId)

// Mark all notifications as read
const result = await markAllNotificationsAsRead(userId)
```

### Get Unread Count
```typescript
// Function: getUnreadNotificationCount
// File: src/lib/notifications.ts

const result = await getUnreadNotificationCount(userId)

// Implementation
const { data, error } = await supabase
  .from('notifications')
  .select('id', { count: 'exact' })
  .eq('user_id', userId)
  .eq('is_read', false)
```

## Reporting

### Leave Reports Query
```typescript
// Comprehensive leave report
const { data, error } = await supabase
  .from('leave_requests')
  .select(`
    *,
    employees:employee_id (name, department, role)
  `)
  .gte('start_date', startDate)
  .lte('end_date', endDate)
  .order('created_at', { ascending: false })
```

### Department Analytics
```typescript
// Department-wise leave statistics
const { data, error } = await supabase
  .from('leave_requests')
  .select(`
    type,
    days_requested,
    status,
    employees:employee_id (department)
  `)
  .eq('status', 'Approved')
  .gte('start_date', yearStart)
  .lte('end_date', yearEnd)
```

### Employee Utilization Report
```typescript
// Employee leave utilization
const { data, error } = await supabase
  .from('employee_leave_balances')
  .select(`
    *,
    employee:employees!employee_leave_balances_employee_id_fkey(name, department),
    policy:leave_policies(name, code)
  `)
  .eq('year', currentYear)
  .order('employee(name)')
```

## Error Handling

### Standard Error Response
```typescript
interface ErrorResponse {
  success: false
  error: string
  code?: string
  details?: any
}
```

### Common Error Codes
```typescript
// Authentication Errors
'AUTH_INVALID_CREDENTIALS' // Invalid username/password
'AUTH_USER_NOT_FOUND'      // User doesn't exist
'AUTH_EMPLOYEE_NOT_FOUND'  // Employee record missing

// Leave Request Errors
'LEAVE_INSUFFICIENT_BALANCE' // Not enough leave days
'LEAVE_INVALID_DATES'       // Invalid date range
'LEAVE_POLICY_VIOLATION'    // Violates leave policy
'LEAVE_ALREADY_EXISTS'      // Overlapping leave request

// Permission Errors
'PERMISSION_DENIED'         // Insufficient permissions
'ROLE_REQUIRED'            // Specific role required

// Validation Errors
'VALIDATION_FAILED'        // Data validation failed
'REQUIRED_FIELD_MISSING'   // Required field not provided
```

### Error Handling Pattern
```typescript
try {
  const result = await apiFunction()
  if (result.success) {
    // Handle success
    return result.data
  } else {
    // Handle API error
    throw new Error(result.error)
  }
} catch (error) {
  // Handle network/system error
  console.error('API Error:', error)
  throw error
}
```

## Rate Limiting

### Supabase Rate Limits
- **Free Tier**: 500 requests per second
- **Pro Tier**: 1000 requests per second
- **Enterprise**: Custom limits

### Best Practices
```typescript
// Implement request debouncing
const debouncedSearch = debounce(searchFunction, 300)

// Use pagination for large datasets
const { data, error } = await supabase
  .from('leave_requests')
  .select('*')
  .range(start, end)
  .limit(pageSize)

// Cache frequently accessed data
const cachedPolicies = useMemo(() => {
  return getLeavePolicies()
}, [])
```

### Error Handling for Rate Limits
```typescript
const handleRateLimit = async (apiCall: () => Promise<any>) => {
  try {
    return await apiCall()
  } catch (error: any) {
    if (error.message.includes('rate limit')) {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000))
      return await apiCall()
    }
    throw error
  }
}
```

## Database Functions

### Custom Database Functions

#### Employee ID Generation
```sql
CREATE OR REPLACE FUNCTION set_employee_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN
    NEW.employee_id := 'EMP' || LPAD(nextval('employee_id_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Leave Balance Calculation
```sql
CREATE OR REPLACE FUNCTION calculate_available_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.available_balance := (
    NEW.opening_balance + 
    NEW.annual_entitlement - 
    NEW.used_balance - 
    NEW.pending_balance
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Leave Validation Function
```sql
CREATE OR REPLACE FUNCTION validate_leave_request(
  emp_id TEXT,
  policy_code TEXT,
  start_date DATE,
  end_date DATE,
  days_requested INTEGER
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  policy_record RECORD;
  balance_record RECORD;
  errors TEXT[] := '{}';
BEGIN
  -- Get policy
  SELECT * INTO policy_record 
  FROM leave_policies 
  WHERE code = policy_code AND is_active = true;
  
  IF NOT FOUND THEN
    errors := array_append(errors, 'Leave policy not found');
  END IF;
  
  -- Get balance
  SELECT * INTO balance_record 
  FROM employee_leave_balances 
  WHERE employee_id = emp_id 
    AND policy_id = policy_record.id 
    AND year = EXTRACT(YEAR FROM start_date);
  
  IF NOT FOUND THEN
    errors := array_append(errors, 'Leave balance not found');
  ELSE
    -- Check sufficient balance
    IF balance_record.available_balance < days_requested THEN
      errors := array_append(errors, 'Insufficient leave balance');
    END IF;
  END IF;
  
  -- Build result
  result := json_build_object(
    'valid', array_length(errors, 1) IS NULL,
    'errors', errors,
    'available_balance', COALESCE(balance_record.available_balance, 0)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

## Security Considerations

### Row Level Security (RLS)
All tables have RLS enabled with appropriate policies:

```sql
-- Example: Leave requests policy
CREATE POLICY "Users can read own leave requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (
    employee_id = (
      SELECT employee_id 
      FROM employees 
      WHERE id = auth.uid()
    )
  );

-- Managers can read team leave requests
CREATE POLICY "Managers can read team leave requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM employees e1, employees e2
      WHERE e1.id = auth.uid()
        AND e2.employee_id = leave_requests.employee_id
        AND e2.manager_id = e1.id
    )
  );
```

### API Security Best Practices
1. **Input Validation**: Validate all input data
2. **SQL Injection Prevention**: Use parameterized queries
3. **Authentication**: Verify user identity
4. **Authorization**: Check user permissions
5. **Rate Limiting**: Prevent abuse
6. **Audit Logging**: Track all operations

---

This API documentation provides comprehensive coverage of all Absentra system endpoints and functions. For additional technical details, refer to the source code and database schema documentation.