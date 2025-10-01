import React from 'react'
import { Menu, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { NotificationPanel } from './NotificationPanel'
import { getUnreadNotificationCount } from '../../lib/notifications'

interface HeaderProps {
  onMenuToggle: () => void
  title: string
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, title }) => {
  const { user } = useAuth()
  const [showNotifications, setShowNotifications] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)

  React.useEffect(() => {
    if (user) {
      fetchUnreadCount()
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchUnreadCount = async () => {
    if (!user) return
    
    const result = await getUnreadNotificationCount(user.employee.id)
    if (result.success) {
      setUnreadCount(result.count)
    }
  }

  const handleLeaveClick = (leaveId: string) => {
    // Close notifications panel
    setShowNotifications(false)
    // This could be enhanced to navigate directly to the specific leave
    // For now, it will just close the panel and user can navigate to leaves tab
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-4 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100 mr-4"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 truncate">{title}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-md hover:bg-gray-100 relative transition-colors"
          >
            <Bell className="h-5 w-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 truncate max-w-32 lg:max-w-none">{user?.employee.name}</p>
              <p className="text-xs text-gray-500">{user?.employee.department}</p>
            </div>
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-medium">
                {user?.employee.name.charAt(0)}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Notification Panel */}
      {showNotifications && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowNotifications(false)}
          />
          <div className="absolute right-4 sm:right-6 top-full mt-2 z-50">
            <NotificationPanel 
              onClose={() => {
                setShowNotifications(false)
                fetchUnreadCount() // Refresh count when closing
              }}
              onLeaveClick={handleLeaveClick}
            />
          </div>
        </>
      )}
    </header>
  )
}