import api from '@/api/client'
import type {
  CreateStoreItemPayload,
  PatchStoreItemPayload,
  StoreAdminListItem,
  StoreAnalytics,
  StoreListQuery,
  StoreListResponse,
  UserStoreSummary,
} from '@/types/store'
import type { UserSearchResponse } from '@/types/api'

export const storeAdminApi = {
  getAnalytics() {
    return api.get<StoreAnalytics>('/admin/store/analytics')
  },

  listItems(params: StoreListQuery = {}) {
    return api.get<StoreListResponse>('/admin/store/items', { params })
  },

  createItem(payload: CreateStoreItemPayload) {
    return api.post<StoreAdminListItem>('/admin/store/items', payload)
  },

  patchItem(id: string, payload: PatchStoreItemPayload) {
    return api.patch<StoreAdminListItem>(`/admin/store/items/${id}`, payload)
  },

  deleteItem(id: string) {
    return api.delete(`/admin/store/items/${id}`)
  },

  searchUsersWithStore(q: string, type = 'auto') {
    return api.get<UserSearchResponse & { users: Array<{ store?: UserStoreSummary }> }>(
      '/admin/users/search',
      { params: { q, type, includeStore: true } },
    )
  },

  getUserStoreItems(userId: string) {
    return api.get<UserStoreSummary>(`/admin/users/${userId}/store-items`)
  },
}
