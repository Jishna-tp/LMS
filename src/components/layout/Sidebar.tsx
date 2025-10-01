import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  Clock,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

interface DashboardStats {
  totalEmployees: number
  pendingLeaves: number
  approvedLeaves: number
  myPendingLeaves: number
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    myPendingLeaves: 0
  })
  const [recentLeaves, setRecentLeaves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  const fetchDashboardData = async () => {
    try {
      // Get total employees (Admin only)
      let totalEmployees = 0
      if (user?.employee.role === 'Admin') {
        const { count: employeeCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact' })
        totalEmployees = employeeCount || 0
      }

      // Get leave statistics based on role
      let pendingLeaves = 0
      let approvedLeaves = 0
      let myPendingLeaves = 0

      if (user?.employee.role === 'HR' || user?.employee.role === 'Admin') {
        // HR and Admin can see all leaves
        const { count: pendingCount } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact' })
          .in('status', ['Pending', 'Manager_Approved'])
        
        const { count: approvedCount } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact' })
          .eq('status', 'Approved')
          .not('approved_by_hr', 'is', null)

        pendingLeaves = pendingCount || 0
        approvedLeaves = approvedCount || 0
      }

      // Get user's pending leaves
      const { count: myPendingCount } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact' })
        .eq('employee_id', user?.employee.employee_id)
        .eq('status', 'Pending')
      
      myPendingLeaves = myPendingCount || 0

      // Get recent leaves based on role
      let recentLeavesQuery = supabase
        .from('leave_requests')
        .select(`
          *,
          employees:employee_id (name, department)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (user?.employee.role === 'Employee') {
        recentLeavesQuery = recentLeavesQuery.eq('employee_id', user.employee.employee_id)
      } else if (user?.employee.role === 'Manager') {
        // Manager sees their team's leaves (simplified - in real app would join with team members)
        recentLeavesQuery = recentLeavesQuery.neq('employee_id', 'none') // Placeholder
      }

      const { data: recentLeavesData } = await recentLeavesQuery

      setStats({
        totalEmployees,
        pendingLeaves,
        approvedLeaves,
        myPendingLeaves
      })
      
      setRecentLeaves(recentLeavesData || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'text-yellow-600 bg-yellow-50'
      case 'Manager_Approved': return 'text-blue-600 bg-blue-50'
      case 'HR_Approved': return 'text-green-600 bg-green-50'
      case 'Approved': return 'text-green-600 bg-green-50'
      case 'Rejected': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'Manager_Approved': return 'Manager Approved'
      case 'HR_Approved': return 'HR Approved'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
          <div className="bg-gray-200 h-64 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.employee.name}!
        </h2>
        <p className="text-sm sm:text-base text-gray-600">Here's what's happening in your workspace today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {user?.employee.role === 'Admin' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Total Employees</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">{stats.totalEmployees}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-500">My Pending Leaves</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-900">{stats.myPendingLeaves}</p>
            </div>
          </div>
        </div>

        {(user?.employee.role === 'HR' || user?.employee.role === 'Admin') && (
          <>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-orange-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Pending Approvals</p>
                  <p className="text-xl sm:text-2xl font-semibold text-gray-900">{stats.pendingLeaves}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Approved Leaves</p>
                  <p className="text-xl sm:text-2xl font-semibold text-gray-900">{stats.approvedLeaves}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Leave Requests</h3>
        </div>
        <div className="p-6">
          {recentLeaves.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent leave requests</p>
          ) : (
            <div className="space-y-4">
              {recentLeaves.map((leave) => (
                <div key={leave.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg space-y-2 sm:space-y-0">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-medium text-gray-900">
                        {leave.employees?.name || 'Unknown Employee'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {leave.type} leave • {leave.days_requested} days
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(leave.status)}`}>
                    {formatStatus(leave.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}