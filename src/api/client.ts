import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { showToast } from '@/utils/toast'

const ACCESS_KEY = 'admin_token'
const REFRESH_KEY = 'admin_refresh_token'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'https://api.offoolive.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem(ACCESS_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const { data } = await axios.post<{ accessToken: string }>(
      `${api.defaults.baseURL}/admin/auth/refresh`,
      { refreshToken },
    )
    localStorage.setItem(ACCESS_KEY, data.accessToken)
    return data.accessToken
  } catch {
    clearTokens()
    return null
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const isAuthRoute = original?.url?.includes('/admin/auth/login')
      || original?.url?.includes('/admin/auth/refresh')

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const newToken = await refreshPromise
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      clearTokens()
      if (import.meta.env.VITE_USE_MOCK !== 'true') {
        window.location.href = '/login'
      }
    } else if (error.response?.status === 403) {
      const body = error.response.data as { code?: string } | undefined
      if (body?.code === 'ADMIN_VIEW_FORBIDDEN') {
        showToast('This feature is outside your assigned views', 'error')
        void import('@/stores/auth').then(({ useAuthStore }) => {
          void useAuthStore().fetchMyViews()
        })
      } else {
        showToast('Insufficient permissions', 'error')
      }
    }

    return Promise.reject(error)
  },
)

export function walletIdempotencyKey(action: string) {
  return `admin-wallet-${Date.now()}-${action}`
}

export default api
