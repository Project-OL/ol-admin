import api from '@/api/client'
import type { SuperAdminModerationNotification } from '@/types/api'

export interface SuperAdminNotificationBadge {
  unreadCount: number
}

export const superAdminNotificationsApi = {
  getBadge() {
    return api.get<SuperAdminNotificationBadge>('/admin/super-notifications/badge')
  },

  list(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
    return api.get<{
      notifications: SuperAdminModerationNotification[]
      total: number
      hasMore: boolean
    }>('/admin/super-notifications', { params })
  },

  markRead(ids?: string[]) {
    return api.post('/admin/super-notifications/read', ids ? { ids } : {})
  },
}
