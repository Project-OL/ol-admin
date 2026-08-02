import api, { clearTokens, setTokens } from '@/api/client'
import type {
  CreateAdminPayload,
  CreateAdminResponse,
  LoginResponse,
  MeResponse,
  RefreshResponse,
} from '@/types/api'

export const adminAuthApi = {
  login(email: string, password: string) {
    return api.post<LoginResponse>('/admin/auth/login', { email, password })
  },

  refresh(refreshToken: string) {
    return api.post<RefreshResponse>('/admin/auth/refresh', { refreshToken })
  },

  me() {
    return api.get<MeResponse>('/admin/auth/me')
  },

  logout() {
    return api.post('/admin/auth/logout')
  },

  createAdmin(payload: CreateAdminPayload) {
    return api.post<CreateAdminResponse>('/admin/auth/create-admin', payload)
  },
}

export async function persistLogin(email: string, password: string) {
  const { data } = await adminAuthApi.login(email, password)
  setTokens(data.accessToken, data.refreshToken)
  return data
}

export async function persistLogout() {
  try {
    await adminAuthApi.logout()
  } finally {
    clearTokens()
  }
}
