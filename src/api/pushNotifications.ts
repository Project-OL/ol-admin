import api from '@/api/client'
import type {
  ListPushDeliveriesParams,
  ListPushDeliveriesResponse,
  ListPushUsersParams,
  ListPushUsersResponse,
  PushBroadcastRequest,
  PushBroadcastResponse,
  PushPayload,
  PushTodayStats,
  PushToUserResponse,
} from '@/types/pushNotifications'

export const pushNotificationsApi = {
  listUsers(params: ListPushUsersParams = {}) {
    return api.get<ListPushUsersResponse>('/admin/notifications/push/users', { params })
  },

  getTodayStats() {
    return api.get<PushTodayStats>('/admin/notifications/push/stats/today')
  },

  listDeliveries(params: ListPushDeliveriesParams = {}) {
    return api.get<ListPushDeliveriesResponse>('/admin/notifications/push/deliveries', {
      params,
    })
  },

  sendToUser(userId: string, payload: PushPayload) {
    return api.post<PushToUserResponse>(
      `/admin/notifications/push/user/${userId}`,
      payload,
    )
  },

  broadcast(payload: PushBroadcastRequest) {
    return api.post<PushBroadcastResponse>('/admin/notifications/push/broadcast', payload)
  },
}
