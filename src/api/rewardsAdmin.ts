import api from '@/api/client'
import type { ListRewardClaimsQuery, ListRewardClaimsResponse } from '@/types/rewards'

export const rewardsAdminApi = {
  listClaims(params: ListRewardClaimsQuery) {
    return api.get<ListRewardClaimsResponse>('/admin/rewards/claims', { params })
  },

  exportClaims(params: Omit<ListRewardClaimsQuery, 'page' | 'limit'>) {
    return api.get('/admin/rewards/claims/export', { params, responseType: 'blob' })
  },
}
