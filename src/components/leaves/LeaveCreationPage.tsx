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
    type: 'Annual',
    start_date: '',
    end_date: '',
    reason: ''
  })
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [holidayOverlap, setHolidayOverlap] = useState<Holiday[]>([])

  useEffect(() => {
    fetchHolidays()
  }, [])

  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      checkHolidayOverlap()
    } else {
      setHolidayOverlap([])
    }
  }, [formData.start_date, formData.end_date, holidays])

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
    const startDate = new Date(formData.start_date)
    const endDate = new Date(formData.end_date)
    
    const overlappingHolidays = holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date)
      return holidayDate >= startDate && holidayDate <= endDate
    })
    
    setHolidayOverlap(overlappingHolidays)
  }

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const calculateWorkingDays = (startDate: string, endDate: string) => {
    const totalDays = calculateDays(startDate, endDate)
    const holidayDays = holidayOverlap.length
    
    // Calculate weekends (simplified - doesn't account for holidays on weekends)
    let weekendDays = 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    
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

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setMessage({ type: 'error', text: 'End date cannot be before start date' })
      setLoading(false)
      return
    }

    const days = calculateDays(formData.start_date, formData.end_date)

    try {
      let initialStatus = 'Pending'
      
      // HR requests are auto-approved
      if (user?.employee.role === 'HR') {
        initialStatus = 'Approved'
      }

      const { data: newLeave, error } = await supabase
        .from('leave_requests')
        .insert([{
          employee_id: user!.employee.employee_id,
          type: formData.type,
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

  return (
    <div className="min-h-screen bg-gray-50 overflow-auto">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2" />
            )}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Leave Request Form */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Leave Request Details</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="Annual">Annual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Personal">Personal Leave</option>
                  <option value="Maternity">Maternity Leave</option>
                  <option value="Paternity">Paternity Leave</option>
                  <option value="Emergency">Emergency Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Duration Summary */}
              {formData.start_date && formData.end_date && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">Duration Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">Total Days:</span>
                      <span className="font-medium ml-2">{calculateDays(formData.start_date, formData.end_date)}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Working Days:</span>
                      <span className="font-medium ml-2">{calculateWorkingDays(formData.start_date, formData.end_date)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Holiday Overlap Warning */}
              {holidayOverlap.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="h-4 w-4 text-yellow-600 mr-2 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-yellow-900 mb-2">
                        Holiday Overlap Detected
                      </h3>
                      <p className="text-sm text-yellow-800 mb-2">
                        Your leave dates overlap with {holidayOverlap.length} company holiday(s):
                      </p>
                      <ul className="text-sm text-yellow-800 space-y-1">
                        {holidayOverlap.map(holiday => (
                          <li key={holiday.id} className="flex items-center">
                            <Calendar className="h-3 w-3 mr-2" />
                            {holiday.name} - {new Date(holiday.date).toLocaleDateString()}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={4}
                  placeholder="Reason for leave request..."
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </div>
                  ) : (
                    'Submit Leave Request'
                  )}
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* Right Side - Calendar */}
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Click on dates to select your leave period. Holidays and existing leaves are shown for reference.
            </p>
            <IntegratedCalendar 
              onDateSelect={handleDateSelect}
              selectedDates={selectedDates}
              compact={true}
            />
            
            {/* Quick Tips */}
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Quick Tips</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Click a date to set start date, click another to set end date</li>
                <li>• Red events are holidays, green/yellow are existing leaves</li>
                <li>• Weekends and holidays don't count as working days</li>
                <li>• Your selected dates are highlighted in blue</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}