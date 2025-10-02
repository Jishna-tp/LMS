import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Edit,
  Plus
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { 
  getAllEmployeeBalances,
  getEmployeeLeaveBalances,
  updateLeaveBalance,
  initializeEmployeeLeaveBalances,
  type EmployeeLeaveBalance 
} from '../../lib/leavePolicy'

export const LeaveBalanceManagement: React.FC = () => {
  const { user } = useAuth()
  const [balances, setBalances] = useState<EmployeeLeaveBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [policyFilter, setPolicyFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [selectedBalance, setSelectedBalance] = useState<EmployeeLeaveBalance | null>(null)
  const [adjustmentData, setAdjustmentData] = useState({
    opening_balance: 0,
    annual_entitlement: 0,
    used_balance: 0,
    reason: ''
  })
  const [message, setMessage] = useState({ type: '', text: '' })

  // Check if user has admin/HR access
  if (user?.employee.role !== 'Admin' && user?.employee.role !== 'HR') {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
          <p className="text-yellow-800">You don't have permission to access leave balance management.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchBalances()
  }, [yearFilter])

  const fetchBalances = async () => {
    try {
      const result = await getAllEmployeeBalances(parseInt(yearFilter))
      if (result.success) {
        setBalances(result.data)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to fetch balances' })
      }
    } catch (error) {
      console.error('Error fetching balances:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustBalance = (balance: EmployeeLeaveBalance) => {
    setSelectedBalance(balance)
    setAdjustmentData({
      opening_balance: balance.opening_balance,
      annual_entitlement: balance.annual_entitlement,
      used_balance: balance.used_balance,
      reason: ''
    })
    setShowAdjustModal(true)
  }

  const handleSaveAdjustment = async () => {
    if (!selectedBalance) return

    try {
      const result = await updateLeaveBalance(selectedBalance.id, {
        opening_balance: adjustmentData.opening_balance,
        annual_entitlement: adjustmentData.annual_entitlement,
        used_balance: adjustmentData.used_balance
      })

      if (result.success) {
        setMessage({ type: 'success', text: 'Leave balance updated successfully' })
        setShowAdjustModal(false)
        setSelectedBalance(null)
        fetchBalances()
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update balance' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred' })
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Employee Name', 'Department', 'Leave Type', 'Year', 
      'Opening Balance', 'Annual Entitlement', 'Used Balance', 
      'Pending Balance', 'Available Balance', 'Carry Forward'
    ]
    
    const csvData = filteredBalances.map(balance => [
      balance.employee?.name || '',
      balance.employee?.department || '',
      balance.policy?.name || '',
      balance.year,
      balance.opening_balance,
      balance.annual_entitlement,
      balance.used_balance,
      balance.pending_balance,
      balance.available_balance,
      balance.carry_forward_balance
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leave-balances-${yearFilter}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const departments = [...new Set(balances.map(b => b.employee?.department).filter(Boolean))]
  const policies = [...new Set(balances.map(b => b.policy?.name).filter(Boolean))]
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)

  const filteredBalances = balances.filter(balance => {
    const matchesSearch = searchTerm === '' || 
      balance.employee?.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesDepartment = departmentFilter === 'all' || 
      balance.employee?.department === departmentFilter
    
    const matchesPolicy = policyFilter === 'all' || 
      balance.policy?.name === policyFilter
    
    return matchesSearch && matchesDepartment && matchesPolicy
  })

  // Calculate summary statistics
  const totalEntitlement = filteredBalances.reduce((sum, b) => sum + b.annual_entitlement, 0)
  const totalUsed = filteredBalances.reduce((sum, b) => sum + b.used_balance, 0)
  const totalAvailable = filteredBalances.reduce((sum, b) => sum + b.available_balance, 0)
  const totalPending = filteredBalances.reduce((sum, b) => sum + b.pending_balance, 0)

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="bg-gray-200 h-8 w-48 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
          <h2 className="text-2xl font-bold text-gray-900">Leave Balance Management</h2>
          <p className="text-gray-600">Monitor and adjust employee leave balances</p>
        </div>
        
        <div className="mt-4 lg:mt-0 flex space-x-2">
          <button
            onClick={fetchBalances}
            className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          
          <button
            onClick={exportToCSV}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Entitlement</p>
              <p className="text-2xl font-semibold text-gray-900">{totalEntitlement.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Used</p>
              <p className="text-2xl font-semibold text-gray-900">{totalUsed.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Available</p>
              <p className="text-2xl font-semibold text-gray-900">{totalAvailable.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Users className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Pending</p>
              <p className="text-2xl font-semibold text-gray-900">{totalPending.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4">
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
        
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          <option value="all">All Departments</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        
        <select
          value={policyFilter}
          onChange={(e) => setPolicyFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          <option value="all">All Leave Types</option>
          {policies.map(policy => (
            <option key={policy} value={policy}>{policy}</option>
          ))}
        </select>
        
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Balance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leave Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opening
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entitlement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pending
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Available
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBalances.map((balance) => (
                <tr key={balance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {balance.employee?.name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {balance.employee?.department || 'Unknown'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {balance.policy?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {balance.opening_balance}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {balance.annual_entitlement}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {balance.used_balance}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {balance.pending_balance}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      balance.available_balance < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {balance.available_balance}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleAdjustBalance(balance)}
                      className="text-blue-600 hover:text-blue-900 flex items-center"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBalances.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No leave balances found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {showAdjustModal && selectedBalance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Adjust Leave Balance
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedBalance.employee?.name} - {selectedBalance.policy?.name}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opening Balance
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={adjustmentData.opening_balance}
                  onChange={(e) => setAdjustmentData({ 
                    ...adjustmentData, 
                    opening_balance: parseFloat(e.target.value) || 0 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Entitlement
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={adjustmentData.annual_entitlement}
                  onChange={(e) => setAdjustmentData({ 
                    ...adjustmentData, 
                    annual_entitlement: parseFloat(e.target.value) || 0 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Used Balance
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={adjustmentData.used_balance}
                  onChange={(e) => setAdjustmentData({ 
                    ...adjustmentData, 
                    used_balance: parseFloat(e.target.value) || 0 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Adjustment
                </label>
                <textarea
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={3}
                  placeholder="Reason for this adjustment..."
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  New Available Balance: {' '}
                  <span className="font-medium">
                    {(adjustmentData.opening_balance + adjustmentData.annual_entitlement - adjustmentData.used_balance - selectedBalance.pending_balance).toFixed(1)}
                  </span>
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex space-x-3">
              <button
                onClick={handleSaveAdjustment}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Save Adjustment
              </button>
              <button
                onClick={() => {
                  setShowAdjustModal(false)
                  setSelectedBalance(null)
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}