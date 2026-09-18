import { defineStore } from 'pinia'
import { superAdminNotificationsApi } from '@/api/superAdminNotifications'
import type { SuperAdminModerationNotification } from '@/types/api'

export const useSuperAdminNotificationsStore = defineStore('superAdminNotifications', {
  state: () => ({
    badge: { unreadCount: 0 },
    notifications: [] as SuperAdminModerationNotification[],
    loadingNotifications: false,
    pollTimer: null as ReturnType<typeof setInterval> | null,
  }),

  actions: {
    async refreshBadge() {
      try {
        const { data } = await superAdminNotificationsApi.getBadge()
        this.badge = data
      } catch {
        /* interceptor */
      }
    },

    async loadNotifications(unreadOnly = true) {
      this.loadingNotifications = true
      try {
        const { data } = await superAdminNotificationsApi.list({
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
      await superAdminNotificationsApi.markRead(ids)
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
