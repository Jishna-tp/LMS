import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Info
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { IntegratedCalendar } from '../calendar/IntegratedCalendar'
import { createNotification } from '../../lib/notifications'
import { 
  getLeavePolicies, 
  validateLeaveRequest, 
  getEmployeeLeaveBalances,
  formatLeaveTypeForDb,
  type LeavePolicy,
  type EmployeeLeaveBalance 
} from '../../lib/leavePolicy'

interface LeaveCreationPageProps {
  onBack: () => void
  onLeaveCreated: () => void
}

interface Holiday {
  id: string
  name: string
  date: string
  type: string
}

export const LeaveCreationPage: React.FC<LeaveCreationPageProps> = ({ onBack, onLeaveCreated }) => {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    type: 'ANNUAL',
    start_date: '',
    end_date: '',
    reason: ''
  })
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([])
  const [leaveBalances, setLeaveBalances] = useState<EmployeeLeaveBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [holidayOverlap, setHolidayOverlap] = useState<Holiday[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [availableBalance, setAvailableBalance] = useState<number>(0)

  useEffect(() => {
    fetchHolidays()
    fetchLeavePolicies()
    fetchLeaveBalances()
  }, [])

  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      checkHolidayOverlap()
      validateLeaveRequestForm()
    } else {
      setHolidayOverlap([])
      setValidationErrors([])
      setAvailableBalance(0)
    }
  }, [formData.start_date, formData.end_date, formData.type, holidays, user])

  const fetchLeavePolicies = async () => {
    try {
      const result = await getLeavePolicies(true)
      if (result.success) {
        setLeavePolicies(result.data)
        // Set first policy as default if available
        if (result.data.length > 0) {
          setFormData(prev => ({ ...prev, type: result.data[0].code }))
        }
      }
    } catch (error) {
      console.error('Error fetching leave policies:', error)
    }
  }

  const fetchLeaveBalances = async () => {
    if (!user) return
    
    try {
      const result = await getEmployeeLeaveBalances(user.employee.employee_id)
      if (result.success) {
        setLeaveBalances(result.data)
      }
    } catch (error) {
      console.error('Error fetching leave balances:', error)
    }
  }

  const validateLeaveRequestForm = async () => {
    if (!user || !formData.type || !formData.start_date || !formData.end_date) {
      setValidationErrors([])
      setAvailableBalance(0)
      return
    }

    const days = calculateDays(formData.start_date, formData.end_date)
    
    try {
      const result = await validateLeaveRequest(
        user.employee.employee_id,
        formData.type,
        formData.start_date,
        formData.end_date,
        days
      )
      
      setValidationErrors(result.errors)
      setAvailableBalance(result.available_balance || 0)
    } catch (error) {
      console.error('Error validating leave request:', error)
      setValidationErrors(['Validation failed'])
    }
  }
  const fetchHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear()
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', `${currentYear}-01-01`)
        .lte('date', `${currentYear + 1}-12-31`)

      if (error) throw error
      setHolidays(data || [])
    } catch (error) {
      console.error('Error fetching holidays:', error)
    }
  }

  const checkHolidayOverlap = () => {
    // Parse dates as local dates to avoid timezone issues
    const [startYear, startMonth, startDay] = formData.start_date.split('-').map(Number)
    const [endYear, endMonth, endDay] = formData.end_date.split('-').map(Number)
    const startDate = new Date(startYear, startMonth - 1, startDay)
    const endDate = new Date(endYear, endMonth - 1, endDay)
    
    const overlappingHolidays = holidays.filter(holiday => {
      // Parse holiday date as local date
      const [hYear, hMonth, hDay] = holiday.date.split('-').map(Number)
      const holidayDate = new Date(hYear, hMonth - 1, hDay)
      return holidayDate >= startDate && holidayDate <= endDate
    })
    
    setHolidayOverlap(overlappingHolidays)
  }

  const calculateDays = (startDate: string, endDate: string) => {
    // Parse dates as local dates to avoid timezone issues
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
    const start = new Date(startYear, startMonth - 1, startDay)
    const end = new Date(endYear, endMonth - 1, endDay)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const calculateWorkingDays = (startDate: string, endDate: string) => {
    const totalDays = calculateDays(startDate, endDate)
    const holidayDays = holidayOverlap.length
    
    // Calculate weekends (simplified - doesn't account for holidays on weekends)
    let weekendDays = 0
    // Parse dates as local dates
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
    const start = new Date(startYear, startMonth - 1, startDay)
    const end = new Date(endYear, endMonth - 1, endDay)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay()
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        weekendDays++
      }
    }
    
    return Math.max(0, totalDays - weekendDays - holidayDays)
  }

  const handleDateSelect = (date: string) => {
    if (!formData.start_date || (formData.start_date && formData.end_date)) {
      // Set start date if none selected, or reset both if both are selected
      setFormData({ ...formData, start_date: date, end_date: '' })
    } else if (formData.start_date && !formData.end_date) {
      // Set end date
      if (date >= formData.start_date) {
        setFormData({ ...formData, end_date: date })
      } else {
        // If selected date is before start date, make it the new start date
        setFormData({ ...formData, start_date: date, end_date: formData.start_date })
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    // Validate the request first
    if (validationErrors.length > 0) {
      setMessage({ type: 'error', text: 'Please fix validation errors before submitting' })
      setLoading(false)
      return
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setMessage({ type: 'error', text: 'End date cannot be before start date' })
      setLoading(false)
      return
    }

    const days = calculateDays(formData.start_date, formData.end_date)

    try {
      let initialStatus = 'Submitted'
      
      // HR requests are auto-approved
      if (user?.employee.role === 'HR') {
        initialStatus = 'Approved'
      } else if (user?.employee.role === 'Manager' || user?.employee.role === 'Admin') {
        // All other roles (Employee, Manager, Admin) start as Submitted
        initialStatus = 'Pending'
      } else {
        // All other roles (Employee, Manager, Admin) start as Submitted
        initialStatus = 'Submitted'
      }

      const { data: newLeave, error } = await supabase
        .from('leave_requests')
        .insert([{
          employee_id: user!.employee.employee_id,
          type: formatLeaveTypeForDb(formData.type),
          start_date: formData.start_date,
          end_date: formData.end_date,
          days_requested: days,
          reason: formData.reason,
          status: initialStatus
        }])
        .select()
        .single()

      if (error) throw error
      
      // Create initial workflow history entry
      await supabase
        .from('leave_workflow_history')
        .insert([{
          leave_request_id: newLeave.id,
          action_by: user!.employee.id,
          action_type: initialStatus === 'Approved' ? 'approved' : 'submitted',
          notes: formData.reason || null
        }])
      
      setMessage({ type: 'success', text: 'Leave request submitted successfully' })

      // Send notifications based on user role
      if (user?.employee.role === 'Employee' && user?.employee.manager_id) {
        // Notify line manager
        await createNotification(
          user.employee.manager_id,
          'New Leave Request',
          `${user.employee.name} has submitted a ${formData.type} leave request for ${days} days.`,
          'leave_submitted',
          newLeave.id
        )
      } else if (user?.employee.role === 'Manager' || user?.employee.role === 'Admin') {
        // Notify HR directly
        const { data: hrUsers } = await supabase
          .from('employees')
          .select('id')
          .eq('role', 'HR')
        
        if (hrUsers) {
          for (const hrUser of hrUsers) {
            await createNotification(
              hrUser.id,
              'New Leave Request',
              `${user.employee.name} (${user.employee.role}) has submitted a ${formData.type} leave request for ${days} days.`,
              'leave_submitted',
              newLeave.id
            )
          }
        }
      }

      // Navigate back after a short delay
      setTimeout(() => {
        onLeaveCreated()
        onBack()
      }, 2000)
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Could not submit leave request. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const selectedDates = formData.start_date && formData.end_date ? {
    start: formData.start_date,
    end: formData.end_date
  } : undefined

  const selectedPolicy = leavePolicies.find(p => p.code === formData.type)
  const selectedBalance = leaveBalances.find(b => b.policy?.code === formData.type)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        {message.text && (
          <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg flex items-start sm:items-center ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span className="text-sm sm:text-base">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Side - Leave Request Form */}
          <div className="xl:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Leave Request Details</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <AlertTriangle className="h-4 w-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800">Validation Errors:</h4>
                      <ul className="text-sm text-red-700 mt-1 space-y-1">
                        {validationErrors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                >
                  {leavePolicies.map(policy => (
                    <option key={policy.code} value={policy.code}>
                      {policy.name}
                    </option>
                  ))}
                </select>
                
                {/* Policy Info */}
                {selectedPolicy && (
                  <div className="mt-2 text-xs text-gray-500">
                    {selectedPolicy.description && (
                      <p>{selectedPolicy.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span>Annual Entitlement: {selectedPolicy.annual_entitlement} days</span>
                      {selectedPolicy.max_consecutive_days && (
                        <span>Max Consecutive: {selectedPolicy.max_consecutive_days} days</span>
                      )}
                    </div>
                    {selectedPolicy.advance_notice_days > 0 && (
                      <p className="mt-1">Advance Notice Required: {selectedPolicy.advance_notice_days} days</p>
                    )}
                  </div>
                )}
              </div>

              {/* Leave Balance Display */}
              {selectedBalance && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-2 sm:p-3">
                  <h3 className="text-sm sm:text-base font-medium text-blue-900 mb-2 sm:mb-3">Your Leave Balance</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">Available:</span>
                      <span className="font-medium ml-2">{selectedBalance.available_balance}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Used:</span>
                      <span className="font-medium ml-2">{selectedBalance.used_balance}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Entitlement:</span>
                      <span className="font-medium ml-2">{selectedBalance.annual_entitlement}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Pending:</span>
                      <span className="font-medium ml-2">{selectedBalance.pending_balance}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                    required
                  />
                </div>
              </div>

              {/* Duration Summary */}
              {formData.start_date && formData.end_date && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-2 sm:p-3">
                  <h3 className="text-sm sm:text-base font-medium text-blue-900 mb-2 sm:mb-3">Duration Summary</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">Total Days:</span>
                      <span className="font-medium ml-2">{calculateDays(formData.start_date, formData.end_date)}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Working Days:</span>
                      <span className="font-medium ml-2">{calculateWorkingDays(formData.start_date, formData.end_date)}</span>
                    </div>
                    {availableBalance > 0 && (
                      <div className="sm:col-span-2">
                        <span className="text-blue-700">Balance After Request:</span>
                        <span className={`font-medium ml-2 ${
                          availableBalance - calculateDays(formData.start_date, formData.end_date) < 0 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}>
                          {availableBalance - calculateDays(formData.start_date, formData.end_date)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Holiday Overlap Warning */}
              {holidayOverlap.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 sm:p-3">
                  <div className="flex items-start">
                    <Info className="h-4 w-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm sm:text-base font-medium text-yellow-900 mb-2">
                        Holiday Overlap Detected
                      </h3>
                      <p className="text-sm text-yellow-800 mb-2">
                        Your leave dates overlap with {holidayOverlap.length} company holiday(s):
                      </p>
                      <ul className="text-sm text-yellow-800 space-y-1 ml-2">
                        {holidayOverlap.map(holiday => (
                          <li key={holiday.id} className="flex items-center">
                            <Calendar className="h-3 w-3 mr-2 flex-shrink-0" />
                            {holiday.name} - {(() => {
                              // Parse holiday date as local date for display
                              const [year, month, day] = holiday.date.split('-').map(Number)
                              const localDate = new Date(year, month - 1, day)
                              return localDate.toLocaleDateString()
                            })()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base resize-none"
                  rows={4}
                  placeholder="Reason for leave request..."
                />
              </div>

              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={loading || validationErrors.length > 0}
                  className="flex-1 bg-blue-600 text-white py-3 sm:py-3.5 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <Clock className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                      Submitting...
                    </div>
                  ) : (
                    'Submit Leave Request'
                  )}
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="sm:flex-shrink-0 px-6 py-3 sm:py-3.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* Right Side - Calendar */}
          <div className="xl:col-span-1">
            <div className="sticky top-4">
              <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 px-1">
                Click on dates to select your leave period. Holidays and existing leaves are shown for reference.
              </p>
              <IntegratedCalendar 
                onDateSelect={handleDateSelect}
                selectedDates={selectedDates}
                compact={true}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}