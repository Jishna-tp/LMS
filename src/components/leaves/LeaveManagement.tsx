import React, { useState, useEffect } from 'react'
import { Plus, Calendar, Clock, CheckCircle, XCircle, FileText, Filter, Search, CreditCard as Edit, Trash2, AlertCircle, X, User, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { createNotification } from '../../lib/notifications'

interface LeaveManagementProps {
  onLeaveSubmitted?: () => void
  onCreateLeave?: () => void
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
  created_at: string
  employees?: { 
    id: string
    name: string
    department: string
    manager_id: string | null
    role: string
  }
  workflow_history?: Array<{
    id: string
    leave_request_id: string
    action_by: string
    action_type: string
    notes: string | null
    created_at: string
    actor: { name: string; role: string }
  }>
}

interface WorkflowStep {
  role: string
  name: string
  status: 'pending' | 'approved' | 'rejected'
  timestamp?: string
  notes?: string
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({ onLeaveSubmitted, onCreateLeave }) => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'requests' | 'approve'>('requests')
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null)
  const [showWorkflowHistory, setShowWorkflowHistory] = useState(false)
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null)
  const [filter, setFilter] = useState('Pending')
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
  }, [user, activeTab])

  const fetchLeaves = async () => {
    try {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          employees:employee_id (id, name, department, manager_id, role),
          workflow_history:leave_workflow_history (
            id,
            action_by,
            action_type,
            notes,
            created_at,
            actor:employees!leave_workflow_history_action_by_fkey (name, role)
          )
        `)
        .order('created_at', { ascending: false })

      if (activeTab === 'requests') {
        // Show only user's own requests
        query = query.eq('employee_id', user!.employee.employee_id)
      } else if (activeTab === 'approve') {
        // Show requests that need approval from current user
        if (user?.employee.role === 'Manager') {
          // Manager sees pending requests from their team members
          const { data: teamMembers } = await supabase
            .from('employees')
            .select('employee_id')
            .eq('manager_id', user.employee.id)
          
          const teamEmployeeIds = teamMembers?.map(member => member.employee_id) || []
          if (teamEmployeeIds.length > 0) {
            query = query
              .in('employee_id', teamEmployeeIds)
              .eq('status', 'Pending')
          } else {
            query = query.eq('employee_id', 'no-team-members')
          }
        } else if (user?.employee.role === 'HR') {
          // HR sees requests that need HR approval:
          // 1. Requests from Employees that are approved by manager but not yet by HR
          // 2. Direct requests from Admin/Manager roles (status = Pending)
          // 3. Requests already approved by this HR user for tracking
          query = query.or(`and(status.eq.Approved,approved_by_hr.is.null),and(status.eq.Pending,employees.role.in.(Manager,Admin)),approved_by_hr.eq.${user.employee.id}`)
        } else {
          // Other roles don't have approve tab
          query = query.eq('employee_id', 'no-approval-access')
        }
      }

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

  const getWorkflowSteps = (leave: LeaveRequest): WorkflowStep[] => {
    const steps: WorkflowStep[] = []
    const employee = leave.employees
    
    if (!employee) return steps

    // Determine workflow based on employee role and actual workflow history
    const workflowHistory = leave.workflow_history || []
    const isRejected = leave.status === 'Rejected'
    
    if (employee.role === 'HR') {
      // HR requests are auto-approved
      steps.push({
        role: 'HR',
        name: 'Auto-approved',
        status: 'approved',
        timestamp: leave.created_at
      })
    } else if (employee.role === 'Admin' || employee.role === 'Manager') {
      // Admin/Manager requests go directly to HR
      const hrApproval = workflowHistory.find(h => h.actor.role === 'HR' && h.action_type !== 'submitted')
      
      steps.push({
        role: 'HR',
        name: hrApproval ? hrApproval.actor.name : 'HR Team',
        status: hrApproval ? 
          (hrApproval.action_type === 'approved' ? 'approved' : 'rejected') :
          'pending',
        timestamp: hrApproval?.created_at,
        notes: hrApproval?.notes || undefined
      })
    } else {
      // Employee requests: Manager → HR
      if (employee.manager_id) {
        const managerApproval = workflowHistory.find(h => h.actor.role === 'Manager' && h.action_type !== 'submitted')
        
        steps.push({
          role: 'Manager',
          name: managerApproval ? managerApproval.actor.name : 'Line Manager',
          status: managerApproval ? 
            (managerApproval.action_type === 'approved' ? 'approved' : 'rejected') :
            'pending',
          timestamp: managerApproval?.created_at,
          notes: managerApproval?.notes || undefined
        })
        
        // HR step - only if manager approved or if rejected by manager (show as skipped)
        const hrApproval = workflowHistory.find(h => h.actor.role === 'HR' && h.action_type !== 'submitted')
        const managerRejected = managerApproval?.action_type === 'rejected'
        
        steps.push({
          role: 'HR',
          name: hrApproval ? hrApproval.actor.name : 'HR Team',
          status: managerRejected ? 'skipped' :
            hrApproval ? 
              (hrApproval.action_type === 'approved' ? 'approved' : 'rejected') :
              (managerApproval?.action_type === 'approved' ? 'pending' : 'pending'),
          timestamp: hrApproval?.created_at,
          notes: hrApproval?.notes || undefined
        })
      }
    }


    return steps
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

        // Call the callback to navigate to leaves tab
        if (onLeaveSubmitted) {
          onLeaveSubmitted()
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
      let newStatus = ''
      let notificationTitle = ''
      let notificationMessage = ''
      let notificationType: 'leave_approved' | 'leave_rejected' | 'leave_manager_approved' = 'leave_approved'

      // Determine new status based on current user role and leave status
      if (user?.employee.role === 'Manager') {
        if (action === 'approve') {
          newStatus = 'Approved'
          notificationTitle = 'Leave Request Approved'
          notificationMessage = `Your ${leave.type} leave request has been approved by your manager and is now pending HR approval.`
          notificationType = 'leave_approved'
        } else {
          newStatus = 'Rejected'
          notificationTitle = 'Leave Request Rejected'
          notificationMessage = `Your ${leave.type} leave request has been rejected by your manager. ${notes ? `Reason: ${notes}` : ''}`
          notificationType = 'leave_rejected'
        }
      } else if (user?.employee.role === 'HR') {
        if (action === 'approve') {
          newStatus = 'Approved'
          notificationTitle = 'Leave Request Approved'
          notificationMessage = `Your ${leave.type} leave request has been fully approved.`
          notificationType = 'leave_approved'
        } else {
          newStatus = 'Rejected'
          notificationTitle = 'Leave Request Rejected'
          notificationMessage = `Your ${leave.type} leave request has been rejected by HR. ${notes ? `Reason: ${notes}` : ''}`
          notificationType = 'leave_rejected'
        }
      }

      // Update leave request
      let updateData: any = { status: newStatus }
      if (user?.employee.role === 'Manager') {
        updateData.manager_notes = notes
        updateData.approved_by_manager = user.employee.id
        updateData.manager_approved_at = new Date().toISOString()
      } else if (user?.employee.role === 'HR') {
        updateData.hr_notes = notes
        updateData.approved_by_hr = user.employee.id
        updateData.hr_approved_at = new Date().toISOString()
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
          action_type: action === 'approve' ? 'approved' : 'rejected',
          notes: notes || null
        }])

      // Send notifications
      if (leave.employees) {
        // Notify the employee who submitted the request
        await createNotification(
          leave.employees.id,
          notificationTitle,
          notificationMessage,
          notificationType,
          leave.id
        )

        // If manager approved, also notify HR
        if (user?.employee.role === 'Manager' && action === 'approve') {
          const { data: hrUsers } = await supabase
            .from('employees')
            .select('id')
            .eq('role', 'HR')
          
          if (hrUsers) {
            for (const hrUser of hrUsers) {
              await createNotification(
                hrUser.id,
                'Leave Request - Manager Approved',
                `${leave.employees.name}'s ${leave.type} leave request has been approved by their manager and requires HR approval.`,
                'leave_manager_approved',
                leave.id
              )
            }
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
      case 'Manager_Approved': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'Approved': return 'text-green-600 bg-green-50 border-green-200'
      case 'Rejected': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'Manager_Approved': return 'Manager Approved'
      default: return status
    }
  }

  const canApprove = (leave: LeaveRequest) => {
    if (user?.employee.role === 'Manager' && leave.status === 'Pending' && !leave.approved_by_manager) {
      return true
    }
    if (user?.employee.role === 'HR' && leave.status === 'Approved' && leave.approved_by_manager && !leave.approved_by_hr) {
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

  const showApproveTab = user?.employee.role === 'Manager' || user?.employee.role === 'HR'

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
    <div className="p-4 sm:p-6">
      {message.text && (
        <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg flex items-start sm:items-center ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4 mr-2" />
          ) : (
            <AlertCircle className="h-4 w-4 mr-2" />
          )}
          <span className="text-sm sm:text-base">{message.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Leave Management</h2>
          <p className="text-sm sm:text-base text-gray-600">Manage your leave requests and approvals</p>
        </div>
        
        <button
          onClick={() => onCreateLeave ? onCreateLeave() : setShowForm(true)}
          className="mt-3 sm:mt-0 flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm sm:text-base"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Leave Request
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4 sm:mb-6">
        <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex items-center whitespace-nowrap ${
              activeTab === 'requests'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="h-4 w-4 mr-2" />
            My Requests
          </button>
          {showApproveTab && (
            <button
              onClick={() => setActiveTab('approve')}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex items-center whitespace-nowrap ${
                activeTab === 'approve'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="h-4 w-4 mr-2" />
              Approve Requests
            </button>
          )}
        </nav>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leaves..."
            className="w-full sm:w-auto pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
          />
        </div>
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-auto pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none text-sm sm:text-base"
          >
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Manager_Approved">Manager Approved</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Leave List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {filteredLeaves.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm sm:text-base">No leave requests found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLeaves.map((leave) => (
              <div key={leave.id} className="p-3 sm:p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-2 lg:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-start sm:items-center space-x-2 sm:space-x-3">
                      <div className="p-1.5 bg-blue-100 rounded-full">
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                          {leave.type} Leave
                          {activeTab === 'approve' && leave.employees && (
                            <span className="block sm:inline text-xs font-normal text-gray-500 sm:ml-2">
                              by {leave.employees.name}
                            </span>
                          )}
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 text-xs text-gray-500 mt-0.5 space-y-0.5 sm:space-y-0">
                          <span className="block sm:inline">
                            <span className="sm:hidden">From: </span>
                            {new Date(leave.start_date).toLocaleDateString()}
                            <span className="hidden sm:inline"> - </span>
                            <span className="sm:hidden block">To: </span>
                            {new Date(leave.end_date).toLocaleDateString()}
                          </span>
                          <span className="text-xs">{leave.days_requested} days</span>
                          <button
                            onClick={() => {
                              setSelectedLeave(leave)
                              setShowWorkflowHistory(true)
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs underline self-start hover:no-underline"
                          >
                            View Workflow
                          </button>
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium border self-start ${getStatusColor(leave.status)}`}>
                            {formatStatus(leave.status)}
                          </span>
                        </div>
                        {leave.reason && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{leave.reason}</p>
                        )}
                        {(leave.manager_notes || leave.hr_notes) && (
                          <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                            {leave.manager_notes && <p><span className="font-medium">Manager:</span> {leave.manager_notes}</p>}
                            {leave.hr_notes && <p><span className="font-medium">HR:</span> {leave.hr_notes}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 lg:ml-4">
                    {/* Employee actions (only on requests tab) */}
                    {activeTab === 'requests' && leave.status === 'Pending' && (
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
                    
                    {/* Manager/HR actions (only on approve tab) */}
                    {activeTab === 'approve' && canApprove(leave) && (
                      <>
                        <button
                          onClick={() => handleApproveReject(leave, 'approve')}
                          className="flex items-center px-1.5 sm:px-2 py-0.5 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors text-xs"
                        >
                          <CheckCircle className="h-3 w-3 mr-0.5" />
                          <span className="hidden sm:inline">Approve</span>
                          <span className="sm:hidden">✓</span>
                        </button>
                        <button
                          onClick={() => handleApproveReject(leave, 'reject')}
                          className="flex items-center px-1.5 sm:px-2 py-0.5 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors text-xs"
                        >
                          <XCircle className="h-3 w-3 mr-0.5" />
                          <span className="hidden sm:inline">Reject</span>
                          <span className="sm:hidden">✗</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Workflow Steps */}
                <div className="mt-2 pt-2 border-t border-gray-100 overflow-x-auto">
                  <div className="flex items-center space-x-1 sm:space-x-2 min-w-max">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Workflow:</span>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      {getWorkflowSteps(leave).filter(step => step.status !== 'skipped').map((step, index) => (
                        <React.Fragment key={index}>
                          <div className={`flex items-center space-x-0.5 px-1 sm:px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap ${
                            step.status === 'approved' ? 'bg-green-100 text-green-800' :
                            step.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            <span className="text-xs leading-none">
                              {step.name.length > (window.innerWidth < 640 ? 8 : 15) ? 
                                step.name.substring(0, window.innerWidth < 640 ? 8 : 15) + '...' : 
                                step.name}
                            </span>
                            {step.status === 'approved' && <CheckCircle className="h-2.5 w-2.5" />}
                            {step.status === 'rejected' && <XCircle className="h-2.5 w-2.5" />}
                            {step.status === 'pending' && <Clock className="h-2.5 w-2.5" />}
                          </div>
                          {index < getWorkflowSteps(leave).filter(step => step.status !== 'skipped').length - 1 && (
                            <div className="w-1 sm:w-2 h-px bg-gray-300"></div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workflow History Modal */}
      {showWorkflowHistory && selectedLeave && (
        <WorkflowHistoryModal 
          leave={selectedLeave}
          workflowSteps={getWorkflowSteps(selectedLeave)}
          onClose={() => {
            setShowWorkflowHistory(false)
            setSelectedLeave(null)
          }}
        />
      )}

      {/* Leave Form Modal */}
      {showForm && (
        <LeaveFormModal
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false)
            setEditingLeave(null)
            setFormData({ type: 'Annual', start_date: '', end_date: '', reason: '' })
          }}
          loading={loading}
          editingLeave={editingLeave}
          calculateDays={calculateDays}
        />
      )}
    </div>
  )
}

// Separate component for Workflow History Modal
const WorkflowHistoryModal: React.FC<{
  leave: LeaveRequest
  workflowSteps: WorkflowStep[]
  onClose: () => void
}> = ({ leave, workflowSteps, onClose }) => {
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkflowHistory()
  }, [leave.id])

  const fetchWorkflowHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_workflow_history')
        .select(`
          *,
          actor:action_by (name, role)
        `)
        .eq('leave_request_id', leave.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setWorkflowHistory(data || [])
    } catch (error) {
      console.error('Error fetching workflow history:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Workflow History - {leave.type} Leave
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {leave.employees?.name} • {leave.days_requested} days • {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
          </p>
        </div>
        
        <div className="p-6">
          {/* Workflow Steps Overview */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Approval Workflow</h4>
            <div className="flex items-center space-x-2">
              {workflowSteps.filter(step => step.status !== 'skipped').map((step, index) => (
                <React.Fragment key={index}>
                  <div className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg ${
                    step.status === 'approved' ? 'bg-green-50 border border-green-200' :
                    step.status === 'rejected' ? 'bg-red-50 border border-red-200' :
                    'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.status === 'approved' ? 'bg-green-100' :
                      step.status === 'rejected' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {step.status === 'approved' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {step.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                      {step.status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-900">{step.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{step.status}</p>
                      {step.timestamp && (
                        <p className="text-xs text-gray-400">
                          {new Date(step.timestamp).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {index < workflowSteps.filter(step => step.status !== 'skipped').length - 1 && (
                    <div className="w-8 h-px bg-gray-300"></div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Detailed History */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Detailed History</h4>
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {workflowHistory.map((history, index) => (
                  <div key={history.id} className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        history.action_type === 'submitted' ? 'bg-blue-100' :
                        history.action_type === 'approved' ? 'bg-green-100' :
                        'bg-red-100'
                      }`}>
                        {history.action_type === 'submitted' && <FileText className="h-4 w-4 text-blue-600" />}
                        {history.action_type === 'approved' && <CheckCircle className="h-4 w-4 text-green-600" />}
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
                        {history.action_type === 'approved' && 'Approved'}
                        {history.action_type === 'rejected' && 'Rejected'}
                      </p>
                      {history.notes && (
                        <p className="text-sm text-gray-500 mt-1 italic">"{history.notes}"</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(history.created_at).toLocaleDateString()} at {new Date(history.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Separate component for Leave Form Modal
const LeaveFormModal: React.FC<{
  formData: any
  setFormData: (data: any) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  loading: boolean
  editingLeave: LeaveRequest | null
  calculateDays: (start: string, end: string) => number
}> = ({ formData, setFormData, onSubmit, onClose, loading, editingLeave, calculateDays }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingLeave ? 'Edit Leave Request' : 'New Leave Request'}
          </h3>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-4">
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
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}