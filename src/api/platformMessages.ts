import api from '@/api/client'
import type {
  BroadcastNotificationPayload,
  BroadcastNotificationResponse,
  SendMessagePayload,
  SendMessageResponse,
} from '@/types/platformMessages'

export const platformMessagesApi = {
  sendSystemMessage(userId: string, payload: SendMessagePayload) {
    return api.post<SendMessageResponse>(`/admin/users/${userId}/messages/system`, payload)
  },

  sendNotification(userId: string, payload: SendMessagePayload) {
    return api.post<SendMessageResponse>(`/admin/users/${userId}/messages/notification`, payload)
  },

  broadcastNotification(payload: BroadcastNotificationPayload) {
    return api.post<BroadcastNotificationResponse>(
      '/admin/messages/notifications/broadcast',
      payload,
    )
  },
}
