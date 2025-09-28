import React, { useState, useEffect } from 'react'
import { Plus, Calendar, Clock, CheckCircle, XCircle, FileText, Filter, Search, CreditCard as Edit, Trash2, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

interface LeaveRequest {
  id: string
  employee_id: string
  type: string
  start_date: string
  end_date: string
  days_requested: number
  reason: string | null
  status: string
  manager_notes: string | null
  hr_notes: string | null
  created_at: string
  employees?: { name: string; department: string }
}

export const LeaveManagement: React.FC = () => {
  const { user } = useAuth()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    type: 'Annual',
    start_date: '',
    end_date: '',
    reason: ''
  })
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchLeaves()
  }, [user])

  const fetchLeaves = async () => {
    try {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          employees:employee_id (name, department)
        `)
        .order('created_at', { ascending: false })

      // Role-based filtering
      if (user?.employee.role === 'Employee') {
        query = query.eq('employee_id', user.employee.employee_id)
      }
      // Manager and HR see all leaves (simplified)

      const { data, error } = await query
      if (error) throw error

      setLeaves(data || [])
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to fetch leave requests' })
    } finally {
      setLoading(false)
    }
  }

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const days = calculateDays(formData.start_date, formData.end_date)

    try {
      if (editingLeave) {
        // Update existing leave
        const { error } = await supabase
          .from('leave_requests')
          .update({
            type: formData.type,
            start_date: formData.start_date,
            end_date: formData.end_date,
            days_requested: days,
            reason: formData.reason
          })
          .eq('id', editingLeave.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Leave request updated successfully' })
      } else {
        // Create new leave
        const { error } = await supabase
          .from('leave_requests')
          .insert([{
            employee_id: user!.employee.employee_id,
            type: formData.type,
            start_date: formData.start_date,
            end_date: formData.end_date,
            days_requested: days,
            reason: formData.reason
          }])

        if (error) throw error
        setMessage({ type: 'success', text: 'Leave request submitted successfully' })
      }

      setShowForm(false)
      setEditingLeave(null)
      setFormData({ type: 'Annual', start_date: '', end_date: '', reason: '' })
      fetchLeaves()
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Could not submit leave request. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (leave: LeaveRequest) => {
    if (leave.status !== 'Pending') {
      setMessage({ type: 'error', text: 'Cannot edit approved or rejected leave requests' })
      return
    }

    setEditingLeave(leave)
    setFormData({
      type: leave.type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      reason: leave.reason || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (leaveId: string) => {
    if (!confirm('Are you sure you want to delete this leave request?')) return

    try {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', leaveId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Leave request deleted successfully' })
      fetchLeaves()
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to delete leave request' })
    }
  }

  const handleApproveReject = async (leaveId: string, action: 'approve' | 'reject', notes: string = '') => {
    try {
      let newStatus = ''
      let updateData: any = {}

      if (action === 'approve') {
        if (user?.employee.role === 'Manager') {
          newStatus = 'Manager_Approved'
          updateData = { status: newStatus, manager_notes: notes, approved_by_manager: user.employee.id }
        } else if (user?.employee.role === 'HR') {
          newStatus = 'HR_Approved'
          updateData = { status: newStatus, hr_notes: notes, approved_by_hr: user.employee.id }
        }
      } else {
        newStatus = 'Rejected'
        updateData = { status: newStatus, manager_notes: notes }
      }

      const { error } = await supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', leaveId)

      if (error) throw error

      setMessage({ type: 'success', text: `Leave request ${action}d successfully` })
      fetchLeaves()
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to ${action} leave request` })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'Manager_Approved': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'HR_Approved': return 'text-green-600 bg-green-50 border-green-200'
      case 'Rejected': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'Manager_Approved': return 'Manager Approved'
      case 'HR_Approved': return 'HR Approved'
      default: return status
    }
  }

  const filteredLeaves = leaves.filter(leave => {
    const matchesFilter = filter === 'all' || leave.status === filter
    const matchesSearch = searchTerm === '' || 
      leave.employees?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.type.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  if (loading && leaves.length === 0) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="bg-gray-200 h-8 w-48 rounded mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 h-20 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg flex items-center ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4 mr-2" />
          ) : (
            <AlertCircle className="h-4 w-4 mr-2" />
          )}
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
          <p className="text-gray-600">Manage your leave requests and approvals</p>
        </div>
        
        {user?.employee.role === 'Employee' && (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 sm:mt-0 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Leave Request
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leaves..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none"
          >
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Manager_Approved">Manager Approved</option>
            <option value="HR_Approved">HR Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Leave List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {filteredLeaves.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No leave requests found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLeaves.map((leave) => (
              <div key={leave.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {leave.type} Leave
                          {user?.employee.role !== 'Employee' && leave.employees && (
                            <span className="text-sm font-normal text-gray-500 ml-2">
                              by {leave.employees.name}
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <span>{new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}</span>
                          <span>{leave.days_requested} days</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(leave.status)}`}>
                            {formatStatus(leave.status)}
                          </span>
                        </div>
                        {leave.reason && (
                          <p className="text-sm text-gray-600 mt-2">{leave.reason}</p>
                        )}
                        {(leave.manager_notes || leave.hr_notes) && (
                          <div className="mt-2 text-xs text-gray-500">
                            {leave.manager_notes && <p><span className="font-medium">Manager:</span> {leave.manager_notes}</p>}
                            {leave.hr_notes && <p><span className="font-medium">HR:</span> {leave.hr_notes}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Employee actions */}
                    {user?.employee.role === 'Employee' && user.employee.employee_id === leave.employee_id && leave.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => handleEdit(leave)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(leave.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    
                    {/* Manager/HR actions */}
                    {(user?.employee.role === 'Manager' || user?.employee.role === 'HR') && leave.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => handleApproveReject(leave.id, 'approve')}
                          className="flex items-center px-3 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproveReject(leave.id, 'reject')}
                          className="flex items-center px-3 py-1 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leave Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingLeave ? 'Edit Leave Request' : 'New Leave Request'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              {formData.start_date && formData.end_date && (
                <div className="text-sm text-gray-600">
                  Duration: {calculateDays(formData.start_date, formData.end_date)} days
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
                  rows={3}
                  placeholder="Reason for leave..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Saving...' : (editingLeave ? 'Update Request' : 'Submit Request')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingLeave(null)
                    setFormData({ type: 'Annual', start_date: '', end_date: '', reason: '' })
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}