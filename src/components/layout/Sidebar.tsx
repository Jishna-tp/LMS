import React from 'react'
import { useState, useEffect } from 'react'
import { 
  LayoutDashboard, 
  User, 
  Calendar, 
  Users, 
  CalendarDays,
  Gift,
  BarChart3,
  LogOut,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getUnreadNotificationCount } from '../../lib/notifications'
import { isSupabaseConfigured } from '../../lib/supabase'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  isOpen: boolean
  onToggle: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isOpen, onToggle }) => {
  const { user, logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (user) {
      fetchUnreadCount()
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchUnreadCount = async () => {
    if (!user || !isSupabaseConfigured()) return
    
    try {
      const result = await getUnreadNotificationCount(user.employee.id)
      if (result.success) {
        setUnreadCount(result.count)
      } else {
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
      setUnreadCount(0)
    }
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Employee', 'Manager', 'HR', 'Admin'] },
    { id: 'profile', label: 'Profile', icon: User, roles: ['Employee', 'Manager', 'HR', 'Admin'] },
    { id: 'leaves', label: 'Leaves', icon: Calendar, roles: ['Employee', 'Manager', 'HR', 'Admin'] },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, roles: ['Employee', 'Manager', 'HR', 'Admin'] },
    { id: 'employees', label: 'Employees', icon: Users, roles: ['Admin'] },
    { id: 'holidays', label: 'Holidays', icon: Gift, roles: ['Admin'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['HR', 'Admin'] },
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.employee.role || 'Employee')
  )

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:z-auto lg:h-full
        flex flex-col
      `}>
        <div className="p-6 lg:p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">EMS</h1>
            <button
              onClick={onToggle}
              className="lg:hidden p-1 rounded-md hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          {user && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900 truncate">{user.employee.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.employee.role}</p>
              <p className="text-xs text-gray-500 truncate">{user.employee.employee_id}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 lg:p-4 space-y-2">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon
            const showNotificationBadge = item.id === 'leaves' && unreadCount > 0
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id)
                  if (window.innerWidth < 1024) onToggle()
                }}
                className={`
                  w-full flex items-center justify-between px-3 sm:px-4 py-3 text-left rounded-lg transition-colors
                  ${activeTab === item.id
                    ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-center">
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 ${activeTab === item.id ? 'text-blue-700' : 'text-gray-400'}`} />
                  <span className="text-sm sm:text-base">{item.label}</span>
                </div>
                {showNotificationBadge && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 min-w-[18px] sm:min-w-[20px] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-4 lg:p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full flex items-center px-3 sm:px-4 py-3 text-left rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
            <span className="text-sm sm:text-base">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  )
}