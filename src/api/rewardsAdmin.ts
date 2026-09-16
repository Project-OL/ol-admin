import api from '@/api/client'
import type {
  BulkDebitPointsResult,
  ListRewardClaimsQuery,
  ListRewardClaimsResponse,
} from '@/types/rewards'

export const rewardsAdminApi = {
  listClaims(params: ListRewardClaimsQuery) {
    return api.get<ListRewardClaimsResponse>('/admin/rewards/claims', { params })
  },

  exportClaims(params: Omit<ListRewardClaimsQuery, 'page' | 'limit'>) {
    return api.get('/admin/rewards/claims/export', { params, responseType: 'blob' })
  },

  bulkDebitPoints(payload: { userIds: string[]; amount: number; description?: string }) {
    return api.post<BulkDebitPointsResult>('/admin/users/wallet/points/bulk-deduct', {
      userIds: payload.userIds,
      amount: String(payload.amount),
      description: payload.description,
    })
  },
}
