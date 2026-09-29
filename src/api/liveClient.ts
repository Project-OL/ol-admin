import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken } from '@/api/client'
import { apiErrorCode, apiErrorMessage } from '@/utils/apiError'
import { showApiErrorToast } from '@/utils/toast'

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
    if (apiErrorCode(error) === 'ADMIN_VIEW_FORBIDDEN') {
      showApiErrorToast('This feature is outside your assigned views')
    } else if (
      error.response?.status !== 401 &&
      !error.config?.skipErrorToast &&
      !axios.isCancel(error)
    ) {
      showApiErrorToast(apiErrorMessage(error))
    }
    return Promise.reject(error)
  },
)

export default liveApi
