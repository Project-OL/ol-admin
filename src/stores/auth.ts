import { defineStore } from 'pinia'
import { adminAuthApi, persistLogin, persistLogout } from '@/api/adminAuth'
import { adminViewsApi } from '@/api/adminViews'
import { clearTokens, getAccessToken } from '@/api/client'
import type { AdminViewSummary } from '@/types/adminViews'
import type { AdminProfile, AdminRole } from '@/types/api'
import { isViewAllowed } from '@/constants/viewRoutes'

const useMock = import.meta.env.VITE_USE_MOCK === 'true'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    admin: null as AdminProfile | null,
    loading: false,
    initialized: false,
    /** true when this admin is gated to assigned views only */
    restricted: false,
    myViews: [] as AdminViewSummary[],
  }),

  getters: {
    isAuthenticated: (state) => useMock || Boolean(state.admin) || Boolean(getAccessToken()),
    isSuperAdmin: (state) => state.admin?.role === 'SUPER_ADMIN',
    isCustomerSupport: (state) => state.admin?.role === 'CUSTOMER_SUPPORT',
    canAccessSupport: (state) =>
      state.admin?.role === 'SUPER_ADMIN' ||
      state.admin?.role === 'CUSTOMER_SUPPORT' ||
      state.admin?.role === 'MODERATOR',
    role: (state): AdminRole | null => state.admin?.role ?? null,
    myViewNames: (state): Set<string> => new Set(state.myViews.map((v) => v.name)),
  },

  actions: {
    canAccessView(viewName: string): boolean {
      if (!this.restricted) return true
      return isViewAllowed(viewName, this.myViewNames)
    },

    clearViews() {
      this.restricted = false
      this.myViews = []
    },

    async fetchMyViews() {
      if (useMock) {
        this.restricted = false
        this.myViews = []
        return
      }
      if (!getAccessToken()) {
        this.clearViews()
        return
      }
      try {
        const { data } = await adminViewsApi.me()
        this.restricted = data.restricted
        this.myViews = data.views ?? []
      } catch {
        // Keep last known views; auth/me failures are handled elsewhere
      }
    },

    async initialize() {
      if (this.initialized) return
      this.initialized = true

      if (useMock) {
        this.admin = {
          id: 'mock-admin',
          email: 'admin@local.com',
          displayName: 'Mock Admin',
          role: 'SUPER_ADMIN',
        }
        this.restricted = false
        this.myViews = []
        return
      }

      if (!getAccessToken()) return

      try {
        const { data } = await adminAuthApi.me()
        this.admin = {
          id: data.admin.id,
          email: data.admin.email ?? '',
          displayName: data.admin.displayName ?? data.admin.role,
          role: data.admin.role,
          username: data.admin.username,
          country: data.admin.country,
          status: data.admin.status,
        }
        await this.fetchMyViews()
      } catch {
        clearTokens()
        this.clearViews()
      }
    },

    async login(email: string, password: string) {
      this.loading = true
      try {
        const data = await persistLogin(email, password)
        this.admin = {
          id: data.admin.id,
          email: data.admin.email,
          displayName: data.admin.displayName,
          role: data.admin.role,
          username: data.admin.username,
          country: data.admin.country,
          status: data.admin.status,
        }
        await this.fetchMyViews()
        return data
      } finally {
        this.loading = false
      }
    },

    async logout() {
      if (useMock) {
        this.admin = null
        this.clearViews()
        return
      }
      await persistLogout()
      this.admin = null
      this.clearViews()
    },
  },
})
