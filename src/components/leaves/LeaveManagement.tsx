import React, { useState, useEffect } from 'react'
import { Plus, Calendar, Clock, CheckCircle, XCircle, FileText, Filter, Search, CreditCard as Edit, Trash2, AlertCircle, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { createNotification } from '../../lib/notifications'

interface LeaveManagementProps {
  onLeaveSubmitted?: () => void
}

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
  is_visible_to_hr: boolean
  manager_approved_at: string | null
  hr_approved_at: string | null
  approved_by_manager: string | null
  approved_by_hr: string | null
  created_at: string
  employees?: { name: string; department: string }
  workflow_history?: Array<{
    id: string
    action_by: string
    action_type: string
    notes: string | null
    created_at: string
    actor: { name: string; role: string }
  }>
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({ onLeaveSubmitted }) => {
  const { user } = useAuth()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null)
  const [showWorkflowHistory, setShowWorkflowHistory] = useState(false)
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
          employees:employee_id (name, department),
          workflow_history:leave_workflow_history (
            id,
            action_by,
            action_type,
            notes,
            created_at,
            actor:action_by (name, role)
          )
        `)
        .order('created_at', { ascending: false })

      // Role-based filtering
      if (user?.employee.role === 'Employee') {
        query = query.eq('employee_id', user.employee.employee_id)
      } else if (user?.employee.role === 'Manager') {
        // Manager sees their team's pending leaves and approved leaves they approved
        const { data: teamMembers } = await supabase
          .from('employees')
          .select('employee_id')
          .eq('manager_id', user.employee.id)
        
        const teamEmployeeIds = teamMembers?.map(member => member.employee_id) || []
        if (teamEmployeeIds.length > 0) {
          query = query.in('employee_id', teamEmployeeIds)
        } else {
          // Manager has no team members, show empty result
          query = query.eq('employee_id', 'no-team-members')
        }
      } else if (user?.employee.role === 'HR') {
        // HR sees only leaves that are visible to HR (manager approved or HR/Admin created)
        query = query.eq('is_visible_to_hr', true)
      }
      // HR and Admin see all leaves

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
        const { data: newLeave, error } = await supabase
          .from('leave_requests')
          .insert([{
            employee_id: user!.employee.employee_id,
            type: formData.type,
            start_date: formData.start_date,
            end_date: formData.end_date,
            days_requested: days,
            reason: formData.reason
          }])
          .select()
          .single()

        if (error) throw error
        setMessage({ type: 'success', text: 'Leave request submitted successfully' })

        // Call the callback to navigate to leaves tab
        if (onLeaveSubmitted) {
          onLeaveSubmitted()
        }

        // Notify manager about new leave request
        if (user?.employee.manager_id && user?.employee.role === 'Employee') {
          await createNotification(
            user.employee.manager_id,
            'New Leave Request',
            `${user.employee.name} has submitted a ${formData.type} leave request for ${days} days.`,
            'leave_submitted',
            newLeave.id
          )
        }
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

  const handleApproveReject = async (leave: LeaveRequest, action: 'approve' | 'reject', notes: string = '') => {
    try {
      let updateData: any = {}
      let notificationTitle = ''
      let notificationMessage = ''
      let notificationType: 'leave_approved' | 'leave_rejected' | 'leave_manager_approved' = 'leave_approved'
      let workflowActionType = ''

      if (action === 'approve') {
        if (user?.employee.role === 'Manager') {
          updateData = { 
            status: 'Pending', 
            manager_notes: notes, 
            approved_by_manager: user.employee.id,
            is_visible_to_hr: true,
            manager_approved_at: new Date().toISOString()
          }
          workflowActionType = 'manager_approved'
          notificationTitle = 'Leave Request Approved by Manager'
          notificationMessage = `Your ${leave.type} leave request has been approved by your manager.`
          notificationType = 'leave_manager_approved'
        } else if (user?.employee.role === 'HR') {
          updateData = { 
            status: 'Approved', 
            hr_notes: notes, 
            approved_by_hr: user.employee.id,
            hr_approved_at: new Date().toISOString()
          }
          workflowActionType = 'hr_approved'
          notificationTitle = 'Leave Request Approved'
          notificationMessage = `Your ${leave.type} leave request has been fully approved by HR.`
          notificationType = 'leave_approved'
        }
      } else {
        updateData.status = 'Rejected'
        workflowActionType = 'rejected'
        if (user?.employee.role === 'Manager') {
          updateData.manager_notes = notes
        } else if (user?.employee.role === 'HR') {
          updateData.hr_notes = notes
        }
        notificationTitle = 'Leave Request Rejected'
        notificationMessage = `Your ${leave.type} leave request has been rejected. ${notes ? `Reason: ${notes}` : ''}`
        notificationType = 'leave_rejected'
      }

      const { error } = await supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', leave.id)

      if (error) throw error

      // Insert workflow history
      await supabase
        .from('leave_workflow_history')
        .insert([{
          leave_request_id: leave.id,
          action_by: user!.employee.id,
          action_type: workflowActionType,
          notes: notes || null
        }])

      // Get employee info to send notification
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('employee_id', leave.employee_id)
        .single()

      if (employee) {
        await createNotification(
          employee.id,
          notificationTitle,
          notificationMessage,
          notificationType,
          leave.id
        )
      }

      // If manager approved, notify HR
      if (user?.employee.role === 'Manager' && action === 'approve') {
        const { data: hrUsers } = await supabase
          .from('employees')
          .select('id')
          .eq('role', 'HR')

        if (hrUsers && hrUsers.length > 0) {
          for (const hrUser of hrUsers) {
            await createNotification(
              hrUser.id,
              'Leave Request Needs HR Approval',
              `A ${leave.type} leave request from ${leave.employees?.name} has been approved by manager and needs final HR approval.`,
              'leave_manager_approved',
              leave.id
            )
          }
        }
      }
      setMessage({ type: 'success', text: `Leave request ${action}d successfully` })
      fetchLeaves()
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to ${action} leave request` })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'Approved': return 'text-green-600 bg-green-50 border-green-200'
      case 'Rejected': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatStatus = (status: string) => {
    return status
  }

  const canApprove = (leave: LeaveRequest) => {
    if (user?.employee.role === 'Manager' && leave.status === 'Pending' && !leave.approved_by_manager) {
      return true
    }
    if (user?.employee.role === 'HR' && leave.status === 'Pending' && leave.is_visible_to_hr) {
      return true
    }
    return false
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
        
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 sm:mt-0 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Leave Request
        </button>
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
            <option value="Approved">Approved</option>
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
                          <button
                            onClick={() => {
                              setSelectedLeave(leave)
                              setShowWorkflowHistory(true)
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs underline"
                          >
                            View History
                          </button>
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
                    {user?.employee.employee_id === leave.employee_id && leave.status === 'Pending' && !leave.approved_by_manager && (
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
                    {canApprove(leave) && (
                      <>
                        <button
                          onClick={() => handleApproveReject(leave, 'approve')}
                          className="flex items-center px-3 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproveReject(leave, 'reject')}
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

      {/* Workflow History Modal */}
      {showWorkflowHistory && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Workflow History - {selectedLeave.type} Leave
                </h3>
                <button
                  onClick={() => {
                    setShowWorkflowHistory(false)
                    setSelectedLeave(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedLeave.employees?.name} • {selectedLeave.days_requested} days • {new Date(selectedLeave.start_date).toLocaleDateString()} - {new Date(selectedLeave.end_date).toLocaleDateString()}
              </p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {selectedLeave.workflow_history?.map((history, index) => (
                  <div key={history.id} className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        history.action_type === 'submitted' ? 'bg-blue-100' :
                        history.action_type === 'manager_approved' ? 'bg-green-100' :
                        history.action_type === 'hr_approved' ? 'bg-green-100' :
                        history.action_type === 'auto_approved' ? 'bg-purple-100' :
                        'bg-red-100'
                      }`}>
                        {history.action_type === 'submitted' && <FileText className="h-4 w-4 text-blue-600" />}
                        {(history.action_type === 'manager_approved' || history.action_type === 'hr_approved' || history.action_type === 'auto_approved') && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {history.action_type === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">{history.actor.name}</p>
                        <span className="text-xs text-gray-500">({history.actor.role})</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {history.action_type === 'submitted' && 'Submitted leave request'}
                        {history.action_type === 'manager_approved' && 'Approved by Manager'}
                        {history.action_type === 'hr_approved' && 'Approved by HR'}
                        {history.action_type === 'auto_approved' && 'Auto-approved'}
                        {history.action_type === 'rejected' && 'Rejected'}
                      </p>
                      {history.notes && (
                        <p className="text-sm text-gray-500 mt-1 italic">"{history.notes}"</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(history.created_at).toLocaleDateString()} at {new Date(history.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {index < (selectedLeave.workflow_history?.length || 0) - 1 && (
                      <div className="absolute left-4 mt-8 w-px h-6 bg-gray-200"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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