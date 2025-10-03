import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, CreditCard as Edit, Trash2, Settings, Users, Calendar, AlertCircle, CheckCircle, BarChart3, Clock, Shield, DollarSign } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { 
  getLeavePolicies, 
  saveLeavePolicy, 
  deleteLeavePolicy,
  getLeavePolicyStats,
  type LeavePolicy 
} from '../../lib/leavePolicy'

export const LeavePolicyManagement: React.FC = () => {
  const { user } = useAuth()
  const [policies, setPolicies] = useState<LeavePolicy[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    annual_entitlement: 0,
    carry_forward_allowed: false,
    max_carry_forward_days: '',
    encashment_allowed: false,
    max_encashment_days: '',
    min_service_months: 0,
    gender_restriction: '',
    department_restriction: [] as string[],
    approval_workflow: 'multi' as 'single' | 'multi',
    max_consecutive_days: '',
    advance_notice_days: 0,
    is_active: true
  })

  // Check if user has admin/HR access
  if (user?.employee.role !== 'Admin' && user?.employee.role !== 'HR') {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
          <p className="text-yellow-800">You don't have permission to access leave policy management.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [policiesResult, statsResult] = await Promise.all([
        getLeavePolicies(false),
        getLeavePolicyStats()
      ])

      if (policiesResult.success) {
        setPolicies(policiesResult.data)
      }

      if (statsResult.success) {
        setStats(statsResult.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const policyData = {
        ...formData,
        max_carry_forward_days: formData.max_carry_forward_days ? parseInt(formData.max_carry_forward_days) : null,
        max_encashment_days: formData.max_encashment_days ? parseInt(formData.max_encashment_days) : null,
        max_consecutive_days: formData.max_consecutive_days ? parseInt(formData.max_consecutive_days) : null,
        gender_restriction: formData.gender_restriction || null,
        department_restriction: formData.department_restriction.length > 0 ? formData.department_restriction : null,
        created_by: user!.employee.id
      }

      const result = await saveLeavePolicy(policyData, !!editingPolicy)

      if (result.success) {
        setMessage({ type: 'success', text: `Leave policy ${editingPolicy ? 'updated' : 'created'} successfully` })
        setShowForm(false)
        setEditingPolicy(null)
        resetForm()
        fetchData()
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save leave policy' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred' })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (policy: LeavePolicy) => {
    setEditingPolicy(policy)
    setFormData({
      name: policy.name,
      code: policy.code,
      description: policy.description || '',
      annual_entitlement: policy.annual_entitlement,
      carry_forward_allowed: policy.carry_forward_allowed,
      max_carry_forward_days: policy.max_carry_forward_days?.toString() || '',
      encashment_allowed: policy.encashment_allowed,
      max_encashment_days: policy.max_encashment_days?.toString() || '',
      min_service_months: policy.min_service_months,
      gender_restriction: policy.gender_restriction || '',
      department_restriction: policy.department_restriction || [],
      approval_workflow: policy.approval_workflow,
      max_consecutive_days: policy.max_consecutive_days?.toString() || '',
      advance_notice_days: policy.advance_notice_days,
      is_active: policy.is_active
    })
    setShowForm(true)
  }

  const handleDelete = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this leave policy? This action cannot be undone.')) return

    try {
      const result = await deleteLeavePolicy(policyId)
      if (result.success) {
        setMessage({ type: 'success', text: 'Leave policy deleted successfully' })
        fetchData()
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete leave policy' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred' })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      annual_entitlement: 0,
      carry_forward_allowed: false,
      max_carry_forward_days: '',
      encashment_allowed: false,
      max_encashment_days: '',
      min_service_months: 0,
      gender_restriction: '',
      department_restriction: [],
      approval_workflow: 'multi',
      max_consecutive_days: '',
      advance_notice_days: 0,
      is_active: true
    })
  }

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = searchTerm === '' || 
      policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.code.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = activeFilter === 'all' || 
      (activeFilter === 'active' && policy.is_active) ||
      (activeFilter === 'inactive' && !policy.is_active)
    
    return matchesSearch && matchesFilter
  })

  if (loading && policies.length === 0) {
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
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leave Policy Management</h2>
          <p className="text-gray-600">Configure leave types, entitlements, and approval workflows</p>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 lg:mt-0 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Leave Policy
        </button>
      </div>

      {/* Stats Cards */}
      {stats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.slice(0, 4).map((stat, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-full">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{stat.policy}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.totalUsed}</p>
                  <p className="text-xs text-gray-500">Used / {stat.totalAvailable} Available</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search policies..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none"
          >
            <option value="all">All Policies</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Policy Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPolicies.map((policy) => (
          <div key={policy.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{policy.name}</h3>
                  <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {policy.code}
                  </span>
                </div>
                {policy.description && (
                  <p className="text-sm text-gray-600 mb-3">{policy.description}</p>
                )}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(policy)}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit Policy"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(policy.id)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete Policy"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  Annual Entitlement
                </div>
                <span className="font-medium text-gray-900">{policy.annual_entitlement} days</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-2 text-gray-400" />
                  Approval Workflow
                </div>
                <span className="capitalize font-medium text-gray-900">{policy.approval_workflow}-level</span>
              </div>

              {policy.carry_forward_allowed && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2 text-gray-400" />
                    Carry Forward
                  </div>
                  <span className="font-medium text-gray-900">
                    {policy.max_carry_forward_days || 'Unlimited'} days
                  </span>
                </div>
              )}

              {policy.encashment_allowed && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-600">
                    <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                    Encashment
                  </div>
                  <span className="font-medium text-gray-900">
                    {policy.max_encashment_days || 'Unlimited'} days
                  </span>
                </div>
              )}

              {policy.min_service_months > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-600">
                    <Shield className="h-4 w-4 mr-2 text-gray-400" />
                    Min. Service
                  </div>
                  <span className="font-medium text-gray-900">{policy.min_service_months} months</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                policy.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {policy.is_active ? 'Active' : 'Inactive'}
              </span>
              
              <div className="text-xs text-gray-500">
                Updated {new Date(policy.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPolicies.length === 0 && (
        <div className="text-center py-12">
          <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No leave policies found matching your criteria</p>
        </div>
      )}

      {/* Policy Form Modal */}
      {showForm && (
        <PolicyFormModal
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false)
            setEditingPolicy(null)
            resetForm()
          }}
          loading={loading}
          editingPolicy={editingPolicy}
        />
      )}
    </div>
  )
}

// Separate component for the form modal
const PolicyFormModal: React.FC<{
  formData: any
  setFormData: (data: any) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  loading: boolean
  editingPolicy: LeavePolicy | null
}> = ({ formData, setFormData, onSubmit, onClose, loading, editingPolicy }) => {
  const departments = ['Engineering', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations']

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingPolicy ? 'Edit Leave Policy' : 'Add New Leave Policy'}
          </h3>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Policy Name *
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
                Policy Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="e.g., ANNUAL"
                required
                disabled={!!editingPolicy}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={3}
              placeholder="Brief description of the leave policy..."
            />
          </div>

          {/* Entitlement Settings */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Entitlement Settings</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Entitlement (days) *
                </label>
                <input
                  type="number"
                  value={formData.annual_entitlement}
                  onChange={(e) => setFormData({ ...formData, annual_entitlement: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  min="0"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Consecutive Days
                </label>
                <input
                  type="number"
                  value={formData.max_consecutive_days}
                  onChange={(e) => setFormData({ ...formData, max_consecutive_days: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  min="1"
                  placeholder="No limit"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Advance Notice (days)
                </label>
                <input
                  type="number"
                  value={formData.advance_notice_days}
                  onChange={(e) => setFormData({ ...formData, advance_notice_days: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Carry Forward Settings */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Carry Forward & Encashment</h4>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.carry_forward_allowed}
                    onChange={(e) => setFormData({ ...formData, carry_forward_allowed: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Allow Carry Forward</span>
                </label>
                
                {formData.carry_forward_allowed && (
                  <div className="flex-1 max-w-xs">
                    <input
                      type="number"
                      value={formData.max_carry_forward_days}
                      onChange={(e) => setFormData({ ...formData, max_carry_forward_days: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Max days"
                      min="1"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.encashment_allowed}
                    onChange={(e) => setFormData({ ...formData, encashment_allowed: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Allow Encashment</span>
                </label>
                
                {formData.encashment_allowed && (
                  <div className="flex-1 max-w-xs">
                    <input
                      type="number"
                      value={formData.max_encashment_days}
                      onChange={(e) => setFormData({ ...formData, max_encashment_days: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Max days"
                      min="1"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Eligibility & Workflow */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Eligibility & Workflow</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Service (months)
                </label>
                <input
                  type="number"
                  value={formData.min_service_months}
                  onChange={(e) => setFormData({ ...formData, min_service_months: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender Restriction
                </label>
                <select
                  value={formData.gender_restriction}
                  onChange={(e) => setFormData({ ...formData, gender_restriction: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">All Genders</option>
                  <option value="Male">Male Only</option>
                  <option value="Female">Female Only</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department Restrictions
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {departments.map(dept => (
                  <label key={dept} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.department_restriction.includes(dept)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            department_restriction: [...formData.department_restriction, dept]
                          })
                        } else {
                          setFormData({
                            ...formData,
                            department_restriction: formData.department_restriction.filter(d => d !== dept)
                          })
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{dept}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty to allow all departments</p>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Approval Workflow
              </label>
              <select
                value={formData.approval_workflow}
                onChange={(e) => setFormData({ ...formData, approval_workflow: e.target.value as 'single' | 'multi' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="single">Single Level (Manager Only)</option>
                <option value="multi">Multi Level (Manager + HR)</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="border-t border-gray-200 pt-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Active Policy</span>
            </label>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : (editingPolicy ? 'Update Policy' : 'Create Policy')}
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