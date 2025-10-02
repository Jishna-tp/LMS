import React, { useState, useEffect } from 'react'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Filter,
  Users,
  Building,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'holiday' | 'leave'
  status?: string
  employee?: string
  department?: string
  leaveType?: string
  description?: string
  color: string
}

interface CalendarProps {
  onDateSelect?: (date: string) => void
  selectedDates?: { start: string; end: string }
  compact?: boolean
}

export const IntegratedCalendar: React.FC<CalendarProps> = ({ 
  onDateSelect, 
  selectedDates,
  compact = false 
}) => {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    department: 'all',
    employee: 'all',
    leaveType: 'all',
    showHolidays: true,
    showLeaves: true
  })
  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null)
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    fetchCalendarData()
    fetchEmployeesAndDepartments()
  }, [currentDate, view, filters])

  const fetchEmployeesAndDepartments = async () => {
    try {
      const { data: employeeData, error } = await supabase
        .from('employees')
        .select('id, name, department')
        .order('name')

      if (error) throw error

      setEmployees(employeeData || [])
      const uniqueDepartments = [...new Set(employeeData?.map(emp => emp.department) || [])]
      setDepartments(uniqueDepartments)
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchCalendarData = async () => {
    try {
      const startDate = getViewStartDate()
      const endDate = getViewEndDate()
      const events: CalendarEvent[] = []

      // Fetch holidays if enabled
      if (filters.showHolidays) {
        const { data: holidays, error: holidayError } = await supabase
          .from('holidays')
          .select('*')
          .gte('date', formatDateToYYYYMMDD(startDate))
          .lte('date', formatDateToYYYYMMDD(endDate))

        if (holidayError) throw holidayError

        holidays?.forEach(holiday => {
          events.push({
            id: `holiday-${holiday.id}`,
            title: holiday.name,
            date: holiday.date,
            type: 'holiday',
            description: holiday.description,
            color: getHolidayColor(holiday.type)
          })
        })
      }

      // Fetch leaves if enabled
      if (filters.showLeaves) {
        let leaveQuery = supabase
          .from('leave_requests')
          .select(`
            *,
            employees:employee_id (id, name, department)
          `)
          .or(`start_date.lte.${formatDateToYYYYMMDD(endDate)},end_date.gte.${formatDateToYYYYMMDD(startDate)}`)
          .eq('employee_id', user?.employee.employee_id) // Only show current user's leaves

        // Apply filters
        if (filters.department !== 'all') {
          // This would need a join or separate query in a real implementation
        }

        if (filters.leaveType !== 'all') {
          leaveQuery = leaveQuery.eq('type', filters.leaveType)
        }

        const { data: leaves, error: leaveError } = await leaveQuery

        if (leaveError) throw leaveError

        leaves?.forEach(leave => {
          // Skip rejected leaves
          if (leave.status === 'Rejected') {
            return
          }
          
          // Parse dates as local dates to avoid timezone issues
          const leaveStartDate = new Date(leave.start_date + 'T00:00:00')
          const leaveEndDate = new Date(leave.end_date + 'T00:00:00')
          
          // Create events for each day of the leave
         const currentDate = new Date(leaveStartDate)
         while (currentDate <= leaveEndDate) {
            const eventDateStr = formatDateToYYYYMMDD(currentDate)
            
            // Only show events within the current view date range
            if (eventDateStr >= formatDateToYYYYMMDD(startDate) && 
                eventDateStr <= formatDateToYYYYMMDD(endDate)) {
              events.push({
                id: `leave-${leave.id}-${eventDateStr}`,
                title: `${leave.type} Leave`,
                date: eventDateStr,
                type: 'leave',
                status: leave.status,
                employee: user?.employee.name,
                department: leave.employees?.department,
                leaveType: leave.type,
                color: getLeaveColor(leave.status)
              })
            }
            currentDate.setDate(currentDate.getDate() + 1)
          }
        })
      }

      setEvents(events)
    } catch (error) {
      console.error('Error fetching calendar data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDateToYYYYMMDD = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDateToDDMMYYYY = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  const parseDateString = (dateStr: string) => {
    // Handle both YYYY-MM-DD and DD-MM-YYYY formats
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-')
      if (parts[0].length === 4) {
        // YYYY-MM-DD format
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      } else {
        // DD-MM-YYYY format
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
    }
    return new Date(dateStr)
  }
  const getViewStartDate = () => {
    const date = new Date(currentDate)
    if (view === 'month') {
      return new Date(date.getFullYear(), date.getMonth(), 1)
    } else if (view === 'week') {
      const day = date.getDay()
      const diff = date.getDate() - day
      return new Date(date.setDate(diff))
    } else {
      return new Date(date.setHours(0, 0, 0, 0))
    }
  }

  const getViewEndDate = () => {
    const date = new Date(currentDate)
    if (view === 'month') {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    } else if (view === 'week') {
      const day = date.getDay()
      const diff = date.getDate() - day + 6
      return new Date(date.setDate(diff))
    } else {
      return new Date(date.setHours(23, 59, 59, 999))
    }
  }

  const getHolidayColor = (type: string) => {
    switch (type) {
      case 'National': return 'bg-red-500'
      case 'Religious': return 'bg-purple-500'
      case 'Company': return 'bg-blue-500'
      case 'Regional': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getLeaveColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-400'
      case 'Pending': return 'bg-yellow-400'
      case 'Rejected': return 'bg-red-400'
      default: return 'bg-gray-400'
    }
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const handleDateClick = (date: string) => {
    if (onDateSelect) {
      onDateSelect(date)
    }
  }

  const handleEventHover = (event: CalendarEvent, mouseEvent: React.MouseEvent) => {
    setHoveredEvent(event)
    setHoverPosition({ x: mouseEvent.clientX, y: mouseEvent.clientY })
  }

  const isDateSelected = (date: string) => {
    if (!selectedDates) return false
    return date >= selectedDates.start && date <= selectedDates.end
  }

  const isDateInRange = (date: string) => {
    if (!selectedDates) return false
    return date >= selectedDates.start && date <= selectedDates.end
  }

  const renderMonthView = () => {
    const startDate = getViewStartDate()
    const endDate = getViewEndDate()
    const days = []
    const current = new Date(startDate)

    // Add days from previous month to fill the first week
    const firstDayOfWeek = startDate.getDay()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(startDate)
      date.setDate(date.getDate() - i - 1)
      days.push(date)
    }

    // Add days of current month
    while (current <= endDate) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    // Add days from next month to fill the last week
    const remainingDays = 42 - days.length // 6 weeks * 7 days
    for (let i = 0; i < remainingDays; i++) {
      const date = new Date(endDate)
      date.setDate(date.getDate() + i + 1)
      days.push(date)
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((day, index) => {
          const dateStr = formatDateToYYYYMMDD(day)
          const dayEvents = events.filter(event => event.date === dateStr)
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          const isToday = dateStr === formatDateToYYYYMMDD(new Date())
          const isSelected = isDateSelected(dateStr)
          
          return (
            <div
              key={index}
              className={`min-h-[80px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50 ${
                !isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''
              } ${isToday ? 'bg-blue-50 border-blue-200' : ''} ${
                isSelected ? 'bg-blue-100 border-blue-300' : ''
              }`}
              onClick={() => handleDateClick(dateStr)}
            >
              <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : ''}`}>
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, compact ? 2 : 3).map(event => (
                  <div
                    key={event.id}
                    className={`text-xs px-1 py-0.5 rounded text-white truncate ${event.color}`}
                    onMouseEnter={(e) => handleEventHover(event, e)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > (compact ? 2 : 3) && (
                  <div className="text-xs text-gray-500">
                    +{dayEvents.length - (compact ? 2 : 3)} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const formatDateHeader = () => {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    } else if (view === 'week') {
      const start = getViewStartDate()
      const end = getViewEndDate()
      return `${formatDateToDDMMYYYY(start)} - ${formatDateToDDMMYYYY(end)}`
    } else {
      return currentDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${compact ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-base' : 'text-lg'}`}>
            {formatDateHeader()}
          </h3>
          
          <button
            onClick={() => navigateDate('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {!compact && (
          <div className="flex items-center space-x-2">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {(['month', 'week', 'day'] as const).map(viewType => (
                <button
                  key={viewType}
                  onClick={() => setView(viewType)}
                  className={`px-3 py-1 text-sm capitalize ${
                    view === viewType
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {viewType}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      {!compact && false && (
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={filters.leaveType}
            onChange={(e) => setFilters({ ...filters, leaveType: e.target.value })}
            className="text-sm px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Leave Types</option>
            <option value="Annual">Annual</option>
            <option value="Sick">Sick</option>
            <option value="Personal">Personal</option>
            <option value="Maternity">Maternity</option>
            <option value="Paternity">Paternity</option>
            <option value="Emergency">Emergency</option>
          </select>

          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={filters.showHolidays}
              onChange={(e) => setFilters({ ...filters, showHolidays: e.target.checked })}
              className="mr-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Holidays
          </label>

          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={filters.showLeaves}
              onChange={(e) => setFilters({ ...filters, showLeaves: e.target.checked })}
              className="mr-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Leaves
          </label>
        </div>
      )}

      {/* Legend */}
      {!compact && false && (
        <div className="mb-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>National Holiday</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Company Holiday</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <span>Approved Leave</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <span>Pending Leave</span>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        renderMonthView()
      )}

      {/* Event Tooltip */}
      {hoveredEvent && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-sm rounded-lg p-3 shadow-lg max-w-xs"
          style={{
            left: hoverPosition.x + 10,
            top: hoverPosition.y - 10,
            pointerEvents: 'none'
          }}
        >
          <div className="font-medium">{hoveredEvent.title}</div>
          <div className="text-gray-300">{formatDateToDDMMYYYY(parseDateString(hoveredEvent.date))}</div>
          {hoveredEvent.type === 'leave' && (
            <>
              {hoveredEvent.status && <div>Status: {hoveredEvent.status}</div>}
              {hoveredEvent.leaveType && <div>Type: {hoveredEvent.leaveType}</div>}
            </>
          )}
          {hoveredEvent.description && (
            <div className="text-gray-300 mt-1">{hoveredEvent.description}</div>
          )}
        </div>
      )}
    </div>
  )
}