import React, { useState, useEffect } from 'react'
import { Bell, Check, CheckCheck, Clock, Calendar, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  type Notification 
} from '../../lib/notifications'

interface NotificationPanelProps {
  onClose: () => void
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  const fetchNotifications = async () => {
    if (!user) return

    try {
      const result = await getUserNotifications(user.employee.id)
      if (result.success) {
        setNotifications(result.data)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    const result = await markNotificationAsRead(notificationId)
    if (result.success) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!user) return

    const result = await markAllNotificationsAsRead(user.employee.id)
    if (result.success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'leave_approved':
        return <Check className="h-4 w-4 text-green-600" />
      case 'leave_rejected':
        return <X className="h-4 w-4 text-red-600" />
      case 'leave_submitted':
        return <Calendar className="h-4 w-4 text-blue-600" />
      case 'leave_manager_approved':
        return <CheckCheck className="h-4 w-4 text-blue-600" />
      default:
        return <Bell className="h-4 w-4 text-gray-600" />
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-80 max-h-96 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                  !notification.is_read ? 'bg-blue-50' : ''
                }`}
                onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(notification.created_at).toLocaleDateString()} {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="flex-shrink-0">
                      <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}