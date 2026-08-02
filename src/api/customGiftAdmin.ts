import api from '@/api/client'
import type {
  CompleteCustomGiftPayload,
  CustomGiftConfig,
  CustomGiftRequestAdmin,
  CustomGiftRequestListQuery,
  CustomGiftRequestListResponse,
  FailCustomGiftPayload,
  UpdateCustomGiftConfigPayload,
} from '@/types/customGift'

export const customGiftAdminApi = {
  getConfig() {
    return api.get<CustomGiftConfig>('/admin/custom-gifts/config')
  },

  updateConfig(payload: UpdateCustomGiftConfigPayload) {
    return api.put<CustomGiftConfig>('/admin/custom-gifts/config', payload)
  },

  listRequests(params: CustomGiftRequestListQuery = {}) {
    return api.get<CustomGiftRequestListResponse>('/admin/custom-gifts/requests', { params })
  },

  getRequest(requestId: string) {
    return api.get<{ request: CustomGiftRequestAdmin }>(
      `/admin/custom-gifts/requests/${requestId}`,
    )
  },

  complete(requestId: string, payload: CompleteCustomGiftPayload = {}) {
    return api.post<{ request: CustomGiftRequestAdmin }>(
      `/admin/custom-gifts/requests/${requestId}/complete`,
      payload,
    )
  },

  fail(requestId: string, payload: FailCustomGiftPayload) {
    return api.post<{ request: CustomGiftRequestAdmin }>(
      `/admin/custom-gifts/requests/${requestId}/fail`,
      payload,
    )
  },
}
