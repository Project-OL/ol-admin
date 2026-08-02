import { defineStore } from 'pinia'
import { customerSupportApi } from '@/api/customerSupport'
import type { NotificationBadge, SupportNotification } from '@/types/customerSupport'

export const useSupportNotificationsStore = defineStore('supportNotifications', {
  state: () => ({
    badge: {
      unreadCount: 0,
      myOpenTickets: 0,
      myAwaitingReply: 0,
    } as NotificationBadge,
    notifications: [] as SupportNotification[],
    loadingNotifications: false,
    pollTimer: null as ReturnType<typeof setInterval> | null,
  }),

  actions: {
    async refreshBadge() {
      try {
        const { data } = await customerSupportApi.getBadge()
        this.badge = data
      } catch {
        /* interceptor */
      }
    },

    async loadNotifications(unreadOnly = true) {
      this.loadingNotifications = true
      try {
        const { data } = await customerSupportApi.listNotifications({
          unreadOnly,
          page: 1,
          limit: 20,
        })
        this.notifications = data.notifications ?? []
      } finally {
        this.loadingNotifications = false
      }
    },

    async markRead(ids?: string[]) {
      await customerSupportApi.markNotificationsRead(ids)
      await Promise.all([this.refreshBadge(), this.loadNotifications(true)])
    },

    startPolling() {
      if (this.pollTimer) return
      void this.refreshBadge()
      this.pollTimer = setInterval(() => {
        void this.refreshBadge()
      }, 30_000)
    },

    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
  },
})
