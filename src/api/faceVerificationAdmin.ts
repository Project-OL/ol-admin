import api from '@/api/client'
import type {
  ClearAllStuckSessionsQuery,
  ClearAllStuckSessionsResponse,
  StuckRegistrationSessionsQuery,
  StuckRegistrationSessionsResponse,
} from '@/types/faceVerificationSessions'

export const faceVerificationAdminApi = {
  listStuckRegistrationSessions(params: StuckRegistrationSessionsQuery = {}) {
    return api.get<StuckRegistrationSessionsResponse>(
      '/admin/face-verification/registration-sessions/stuck',
      { params },
    )
  },

  clearAllStuckRegistrationSessions(payload: ClearAllStuckSessionsQuery = {}) {
    return api.post<ClearAllStuckSessionsResponse>(
      '/admin/face-verification/registration-sessions/clear-all',
      payload,
    )
  },
}
