import React, { useState } from 'react'
import { User, Mail, Calendar, Building, Lock, Save, AlertCircle, CheckCircle, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { changePassword } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export const Profile: React.FC = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile')
  const [managerInfo, setManagerInfo] = useState<{ name: string } | null>(null)
  const [loadingManager, setLoadingManager] = useState(true)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [usernameForm, setUsernameForm] = useState({
    username: user?.username || ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  React.useEffect(() => {
    if (user?.employee.manager_id) {
      fetchManagerInfo()
    } else {
      setLoadingManager(false)
    }
  }, [user])

  const fetchManagerInfo = async () => {
    if (!user?.employee.manager_id) return

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('name')
        .eq('id', user.employee.manager_id)
        .single()

      if (error) throw error
      setManagerInfo(data)
    } catch (error) {
      console.error('Error fetching manager info:', error)
    } finally {
      setLoadingManager(false)
    }
  }
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' })
      setLoading(false)
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      setLoading(false)
      return
    }

    try {
      await changePassword(user!.id, passwordForm.currentPassword, passwordForm.newPassword)
      setMessage({ type: 'success', text: 'Password changed successfully' })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await supabase
        .from('users')
        .update({ username: usernameForm.username })
        .eq('id', user!.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Username updated successfully' })
      
      // Update user in context (simplified - in real app would refresh user data)
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update username' })
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto sm:mx-0">
              <span className="text-white text-lg sm:text-xl font-semibold">
                {user.employee.name.charAt(0)}
              </span>
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{user.employee.name}</h2>
              <p className="text-sm sm:text-base text-gray-600">{user.employee.role} • {user.employee.department}</p>
              <p className="text-sm text-gray-500">{user.employee.employee_id}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Profile Information
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'password'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Security
            </button>
          </nav>
        </div>

        {/* Content */}
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

          {activeTab === 'profile' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Employee Information */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Employee Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  <div className="flex items-center space-x-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Full Name</p>
                      <p className="text-sm sm:text-base text-gray-900 truncate">{user.employee.name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p className="text-sm sm:text-base text-gray-900 truncate">{user.employee.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <Building className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Department</p>
                      <p className="text-sm sm:text-base text-gray-900">{user.employee.department}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Employee ID</p>
                      <p className="text-sm sm:text-base text-gray-900">{user.employee.employee_id}</p>
                    </div>
                  </div>

                  {user.employee.manager_id && (
                    <div className="flex items-center space-x-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
                      <Users className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Line Manager</p>
                        <p className="text-sm sm:text-base text-gray-900">
                          {loadingManager ? 'Loading...' : (managerInfo?.name || 'Unknown')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Username Update */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Account Settings</h3>
                <form onSubmit={handleUsernameChange} className="max-w-full sm:max-w-md">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={usernameForm.username}
                        onChange={(e) => setUsernameForm({ username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {loading ? 'Updating...' : 'Update Username'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Change Password</h3>
              <form onSubmit={handlePasswordChange} className="max-w-full sm:max-w-md space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {loading ? 'Changing Password...' : 'Change Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}