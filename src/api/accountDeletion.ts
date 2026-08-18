import api from '@/api/client'
import type {
  AccountDeletionCancelResponse,
  AccountDeletionConfig,
  AccountDeletionConfigUpdate,
  AccountDeletionListQuery,
  AccountDeletionListResponse,
  AccountDeletionRequest,
} from '@/types/accountDeletion'

export const accountDeletionApi = {
  getConfig() {
    return api.get<AccountDeletionConfig>('/admin/system-settings/account-deletion')
  },

  updateConfig(payload: AccountDeletionConfigUpdate) {
    return api.put<AccountDeletionConfig>('/admin/system-settings/account-deletion', payload)
  },

  list(params: AccountDeletionListQuery = {}) {
    return api.get<AccountDeletionListResponse>('/admin/account-deletions', { params })
  },

  getById(id: string) {
    return api.get<AccountDeletionRequest>(`/admin/account-deletions/${id}`)
  },

  cancel(id: string) {
    return api.post<AccountDeletionCancelResponse>(`/admin/account-deletions/${id}/cancel`)
  },
}
