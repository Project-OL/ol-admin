import api from '@/api/client'
import type {
  AdminActivityActionTypesResponse,
  AdminActivityAdminsResponse,
  AdminActivityListQuery,
  AdminActivityListResponse,
} from '@/types/adminActivity'

export const adminActivityApi = {
  list(params: AdminActivityListQuery = {}) {
    return api.get<AdminActivityListResponse>('/admin/activity-logs', { params })
  },

  listActionTypes() {
    return api.get<AdminActivityActionTypesResponse>('/admin/activity-logs/action-types')
  },

  listAdmins() {
    return api.get<AdminActivityAdminsResponse>('/admin/activity-logs/admins')
  },
}
