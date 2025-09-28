import React from 'react'
import { Menu, Bell, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { NotificationPanel } from './NotificationPanel'

interface HeaderProps {
  onMenuToggle: () => void
  title: string
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, title }) => {
  const { user } = useAuth()
  const [showNotifications, setShowNotifications] = React.useState(false)

  const handleLeaveClick = (leaveId: string) => {
    // This would ideally navigate to the specific leave
    // For now, we'll just close notifications and the parent can handle navigation
    setShowNotifications(false)
    // In a real app, you might use React Router to navigate to /leaves/${leaveId}
    console.log('Navigate to leave:', leaveId)
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100 mr-4"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-md hover:bg-gray-100 relative"
          >
            <Bell className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.employee.name}</p>
              <p className="text-xs text-gray-500">{user?.employee.department}</p>
            </div>
            <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
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
          <div className="absolute right-6 top-full mt-2 z-50">
            <NotificationPanel 
              onClose={() => setShowNotifications(false)} 
              onLeaveClick={handleLeaveClick}
            />
          </div>
        </>
      )}
    </header>
  )
}