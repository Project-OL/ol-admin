import { defineStore } from 'pinia'
import { platformMessagesApi } from '@/api/platformMessages'
import type {
  BroadcastNotificationPayload,
  SendMessageResponse,
} from '@/types/platformMessages'
import { showToast } from '@/utils/toast'

const useMock = import.meta.env.VITE_USE_MOCK === 'true'

export const usePlatformMessagesStore = defineStore('platformMessages', {
  actions: {
    async sendSystemMessage(userId: string, message: string): Promise<SendMessageResponse | undefined> {
      const text = message.trim()
      if (!text) return

      if (useMock) {
        showToast('System message sent (mock)', 'success')
        return { ok: true, conversationId: 'mock', messageId: 'mock', content: text }
      }

      const { data } = await platformMessagesApi.sendSystemMessage(userId, { message: text })
      showToast('System message sent to platform inbox', 'success')
      return data
    },

    async sendNotification(userId: string, message: string): Promise<SendMessageResponse | undefined> {
      const text = message.trim()
      if (!text) return

      if (useMock) {
        showToast('Notification sent (mock)', 'success')
        return {
          ok: true,
          conversationId: 'mock',
          messageId: 'mock',
          content: text,
          campaignId: 'mock',
        }
      }

      const { data } = await platformMessagesApi.sendNotification(userId, { message: text })
      showToast('Notification sent to platform inbox', 'success')
      return data
    },

    async broadcastNotification(payload: BroadcastNotificationPayload) {
      if (useMock) {
        showToast('Broadcast queued (mock)', 'success')
        return { ok: true, queued: true, campaignId: payload.campaignId ?? 'mock' }
      }

      const { data } = await platformMessagesApi.broadcastNotification(payload)
      showToast('Broadcast queued successfully', 'success')
      return data
    },
  },
})
