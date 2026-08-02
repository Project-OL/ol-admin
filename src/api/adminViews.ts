import api from '@/api/client'
import type {
  AssignViewsRequest,
  AssignViewsResponse,
  CreateOrExtendViewPayload,
  CsaViewsResponse,
  MyViewsResponse,
  ReplaceViewPayload,
  ReplaceViewResponse,
  UpsertViewResponse,
  ViewCatalogResponse,
} from '@/types/adminViews'

export const adminViewsApi = {
  me() {
    return api.get<MyViewsResponse>('/admin/views/me')
  },

  listCatalog() {
    return api.get<ViewCatalogResponse>('/admin/views')
  },

  createOrExtend(payload: CreateOrExtendViewPayload) {
    return api.post<UpsertViewResponse>('/admin/views', payload)
  },

  replace(viewName: string, payload: ReplaceViewPayload) {
    return api.put<ReplaceViewResponse>(`/admin/views/${encodeURIComponent(viewName)}`, payload)
  },

  getCsaViews(adminId: string) {
    return api.get<CsaViewsResponse>(`/admin/support/csas/${adminId}/views`)
  },

  assignCsaViews(adminId: string, payload: AssignViewsRequest) {
    return api.put<AssignViewsResponse>(`/admin/support/csas/${adminId}/views`, payload)
  },
}
