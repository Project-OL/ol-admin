import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken } from '@/api/client'
import { showToast } from '@/utils/toast'

/** Live streaming backend REST root (`/api`). Restriction routes are `/v1/admin/users/...`. */
export const LIVE_API_BASE_URL =
  import.meta.env.VITE_LIVE_API_BASE_URL ?? 'https://live.offoolive.com/api'

export const liveApi = axios.create({
  baseURL: LIVE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

liveApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

liveApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const body = error.response?.data as { code?: string; message?: string } | undefined
    if (error.response?.status === 403 && body?.code === 'ADMIN_VIEW_FORBIDDEN') {
      showToast('This feature is outside your assigned views', 'error')
    }
    return Promise.reject(error)
  },
)

export default liveApi
