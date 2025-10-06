import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Filter, 
  Building, 
  Users, 
  UserCheck, 
  UserX,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  ArrowLeft
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { 
  getDepartments,
  getAccessibleDepartments,
  getDepartmentEmployees,
  getDepartmentStats,
  saveDepartment,
  deleteDepartment,
  type Department,
  type DepartmentEmployee
} from '../../lib/departments'
import { supabase } from '../../lib/supabase'

export const DepartmentManagement: React.FC = () => {
  const { user } = useAuth()
  const [activeView, setActiveView] = useState<'departments' | 'employees'>('departments')
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<DepartmentEmployee[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [availableHeads, setAvailableHeads] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: '',
    head_id: ''
  })
  const [message, setMessage] = useState({ type: '', text: '' })

  // Check if user has access
  const hasFullAccess = user?.employee.role === 'Admin' || user?.employee.role === 'HR'
  const hasLimitedAccess = user?.employee.role === 'Manager'

  if (!hasFullAccess && !hasLimitedAccess) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
          <p className="text-yellow-800">You don't have permission to access department management.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchData()
    fetchAvailableHeads()
  }, [user])

  const fetchData = async () => {
    try {
      if (!user) return

      // Fetch departments based on user role
      const departmentsResult = await getAccessibleDepartments(
        user.employee.role,
        user.employee.department,
        user.employee.id
      )

      if (departmentsResult.success) {
        setDepartments(departmentsResult.data)
      }

      // Fetch stats if user has full access
      if (hasFullAccess) {
        const statsResult = await getDepartmentStats()
        if (statsResult.success) {
          setStats(statsResult.data)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableHeads = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, employee_id, department')
        .in('role', ['Manager', 'Admin'])
        .order('name')

      if (error) throw error
      setAvailableHeads(data || [])
    } catch (error) {
      console.error('Error fetching available heads:', error)
    }
  }

  const fetchDepartmentEmployees = async (department: Department) => {
    setLoading(true)
    try {
      const result = await getDepartmentEmployees(department.name)
      if (result.success) {
        setEmployees(result.data)
        setSelectedDepartment(department)
        setActiveView('employees')
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to fetch employees' })
      }
    } catch (error) {
      console.error('Error fetching department employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const result = await saveDepartment(
        {
          ...formData,
          head_id: formData.head_id || null,
          id: editingDepartment?.id
        },
        !!editingDepartment
      )

      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `Department ${editingDepartment ? 'updated' : 'created'} successfully` 
        })
        setShowForm(false)
        setEditingDepartment(null)
        resetForm()
        fetchData()
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save department' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred' })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (department: Department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      head_id: department.head_id || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) return

    try {
      const result = await deleteDepartment(departmentId)
      if (result.success) {
        setMessage({ type: 'success', text: 'Department deleted successfully' })
        fetchData()
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete department' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred' })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      head_id: ''
    })
  }

  const getLeaveStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'text-green-600 bg-green-50 border-green-200'
      case 'Pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'Rejected': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = searchTerm === '' || 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'available' && !employee.current_leave) ||
      (statusFilter === 'on-leave' && employee.current_leave)
    
    return matchesSearch && matchesStatus
  })

  if (loading && departments.length === 0) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="bg-gray-200 h-8 w-48 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-200 h-48 rounded-lg"></div>
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <div className="flex items-center space-x-4">
          {activeView === 'employees' && (
            <button
              onClick={() => {
                setActiveView('departments')
                setSelectedDepartment(null)
                setEmployees([])
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {activeView === 'departments' ? 'Department Management' : `${selectedDepartment?.name} Employees`}
            </h2>
            <p className="text-gray-600">
              {activeView === 'departments' 
                ? 'Manage departments and view employee information'
                : `View employees and their current leave status`
              }
            </p>
          </div>
        </div>
        
        {activeView === 'departments' && hasFullAccess && (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 lg:mt-0 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </button>
        )}
      </div>

      {/* Stats Cards - Only for departments view and full access users */}
      {activeView === 'departments' && hasFullAccess && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Departments</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalDepartments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Employees</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.departmentStats?.reduce((sum: number, dept: any) => sum + dept.employeeCount, 0) || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <UserX className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">On Leave</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.departmentStats?.reduce((sum: number, dept: any) => sum + dept.onLeaveCount, 0) || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Available</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.departmentStats?.reduce((sum: number, dept: any) => sum + dept.availableCount, 0) || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'departments' ? (
        /* Department Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((department) => (
            <div key={department.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{department.name}</h3>
                  {department.head && (
                    <p className="text-sm text-gray-600 mb-2">
                      Head: {department.head.name} ({department.head.employee_id})
                    </p>
                  )}
                  <div className="flex items-center text-sm text-gray-500">
                    <Users className="h-4 w-4 mr-1" />
                    {department.employee_count} employees
                  </div>
                </div>
                
                {hasFullAccess && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(department)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit Department"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(department.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete Department"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => fetchDepartmentEmployees(department)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Employees
                </button>
              </div>

              <div className="mt-3 text-xs text-gray-400">
                Updated {new Date(department.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Employee List View */
        <div>
          {/* Filters for Employee View */}
          <div className="mb-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employees..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none"
              >
                <option value="all">All Employees</option>
                <option value="available">Available</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Employee Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leave Information
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {employee.name.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                            <div className="text-sm text-gray-500">{employee.employee_id}</div>
                            <div className="text-sm text-gray-500">{employee.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          employee.role === 'Admin' ? 'bg-purple-100 text-purple-800' :
                          employee.role === 'HR' ? 'bg-green-100 text-green-800' :
                          employee.role === 'Manager' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {employee.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {employee.current_leave ? (
                            <>
                              <UserX className="h-4 w-4 text-red-500 mr-2" />
                              <span className="text-sm text-red-600">On Leave</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm text-green-600">Available</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {employee.current_leave ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-900">{employee.current_leave.type}</span>
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getLeaveStatusColor(employee.current_leave.status)}`}>
                                {employee.current_leave.status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(employee.current_leave.start_date).toLocaleDateString()} - {new Date(employee.current_leave.end_date).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {employee.current_leave.days_requested} days
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Available</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredEmployees.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No employees found matching your criteria</p>
              </div>
            )}
          </div>
        </div>
      )}

      {departments.length === 0 && activeView === 'departments' && (
        <div className="text-center py-12">
          <Building className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No departments found</p>
        </div>
      )}

      {/* Department Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingDepartment ? 'Edit Department' : 'Add New Department'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department Head (Optional)
                </label>
                <select
                  value={formData.head_id}
                  onChange={(e) => setFormData({ ...formData, head_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">Select Department Head</option>
                  {availableHeads.map(head => (
                    <option key={head.id} value={head.id}>
                      {head.name} ({head.employee_id}) - {head.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Saving...' : (editingDepartment ? 'Update Department' : 'Create Department')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingDepartment(null)
                    resetForm()
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