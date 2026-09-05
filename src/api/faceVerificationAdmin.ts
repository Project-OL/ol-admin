import api from '@/api/client'
import type {
  AcceptDuplicateBothResponse,
  ClearAllStuckSessionsQuery,
  ClearAllStuckSessionsResponse,
  DuplicateOrderResponse,
  PendingDuplicatesQuery,
  PendingDuplicatesResponse,
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

  listPendingDuplicates(params: PendingDuplicatesQuery = {}) {
    return api.get<PendingDuplicatesResponse>('/admin/face-verification/duplicates/pending', {
      params,
    })
  },

  acceptDuplicateBoth(userId: string, reason?: string) {
    return api.post<AcceptDuplicateBothResponse>(
      `/admin/face-verification/${userId}/accept-duplicate`,
      { reason },
    )
  },

  /** Park a duplicate case below every other row in the worklist (ordering only). */
  sendDuplicateToBottom(userId: string) {
    return api.post<DuplicateOrderResponse>(
      `/admin/face-verification/duplicates/${userId}/send-to-bottom`,
    )
  },

  restoreDuplicateOrder(userId: string) {
    return api.post<DuplicateOrderResponse>(
      `/admin/face-verification/duplicates/${userId}/restore-order`,
    )
  },
}
