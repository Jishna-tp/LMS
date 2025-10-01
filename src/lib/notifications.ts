import { supabase, isSupabaseConfigured } from './supabase'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'leave_approved' | 'leave_rejected' | 'leave_submitted' | 'leave_manager_approved'
  is_read: boolean
  related_leave_id: string | null
  created_at: string
}

// Create notification
export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: 'leave_approved' | 'leave_rejected' | 'leave_submitted' | 'leave_manager_approved',
  relatedLeaveId?: string
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        title,
        message,
        type,
        related_leave_id: relatedLeaveId || null
      }])

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error creating notification:', error)
    return { success: false, error: error.message }
  }
}

// Get user notifications
export const getUserNotifications = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('Error fetching notifications:', error)
    return { success: false, error: error.message, data: [] }
  }
}

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error marking notification as read:', error)
    return { success: false, error: error.message }
  }
}

// Mark all notifications as read for a user
export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error)
    return { success: false, error: error.message }
  }
}

// Get unread notification count
export const getUnreadNotificationCount = async (userId: string) => {
  try {
    if (!isSupabaseConfigured()) {
      return { success: false, count: 0 }
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return { success: true, count: count || 0 }
  } catch (error: any) {
    // Silently handle connection errors to prevent breaking the UI
    return { success: false, count: 0 }
  }
}