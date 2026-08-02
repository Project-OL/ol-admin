/** "METHOD /admin/path" — e.g. "GET /admin/users/search" */
export type AdminEndpoint = string

export type AdminViewSummary = {
  name: string
  endpoints: AdminEndpoint[]
}

export type AdminViewCatalogItem = AdminViewSummary & {
  assignedAdminCount: number
  createdAt: string
  updatedAt: string
}

/** GET /admin/views */
export type ViewCatalogResponse = { views: AdminViewCatalogItem[] }

/** POST /admin/views (201 created / 200 extended) */
export type UpsertViewResponse = {
  view: Omit<AdminViewCatalogItem, 'assignedAdminCount'>
  created: boolean
}

/** PUT /admin/views/:viewName */
export type ReplaceViewResponse = {
  view: Omit<AdminViewCatalogItem, 'assignedAdminCount'>
}

/** GET /admin/views/me */
export type MyViewsResponse = {
  /** false for SUPER_ADMIN and for admins with no assignments */
  restricted: boolean
  views: AdminViewSummary[]
}

/** GET /admin/support/csas/:adminId/views */
export type CsaViewsResponse = {
  adminId: string
  views: AdminViewSummary[]
}

/** PUT /admin/support/csas/:adminId/views */
export type AssignViewsRequest = { views: string[] }
export type AssignViewsResponse = {
  adminId: string
  views: AdminViewSummary[]
}

export type CreateOrExtendViewPayload = {
  name: string
  endpoints: AdminEndpoint[]
}

export type ReplaceViewPayload = {
  endpoints: AdminEndpoint[]
}
