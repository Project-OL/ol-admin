import api from '@/api/client'
import type {
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
}
