import api from '@/api/client'
import type {
  AdminStatus,
  BulkResolveWithTemplateResult,
  CreateCsaPayload,
  CsaAdmin,
  CsaDirectoryEntry,
  CsaIpWhitelistEntry,
  CsaIpWhitelistResponse,
  CsaOverview,
  CsaPerformance,
  CsaTicketsResponse,
  FailedLoginAttemptsResponse,
  FailedLoginsResponse,
  NotificationBadge,
  ReportListQuery,
  SupportMessage,
  SupportNotification,
  SupportReplyTemplate,
  SupportReport,
  SupportTicketListItem,
  TicketDetailResponse,
  TicketListQuery,
  UpdateCsaPayload,
  SupportTicketPriority,
  SupportTicketResolution,
  SupportTicketStatus,
} from '@/types/customerSupport'

export const customerSupportApi = {
  // --- CSA management (SUPER_ADMIN) ---
  getCsaOverview() {
    return api.get<CsaOverview>('/admin/support/csas/overview')
  },

  listCsas(params: {
    status?: AdminStatus
    country?: string
    search?: string
    page?: number
    limit?: number
  } = {}) {
    return api.get<{
      csas: CsaAdmin[]
      page: number
      limit: number
      total: number
      hasMore: boolean
    }>('/admin/support/csas', { params })
  },

  /** ACTIVE CSAs for pickers (CSA + SUPER_ADMIN). */
  listCsaDirectory() {
    return api.get<{ csas: CsaDirectoryEntry[] }>('/admin/support/csas/directory')
  },

  createCsa(payload: CreateCsaPayload) {
    return api.post<{ csa: CsaAdmin }>('/admin/support/csas', payload)
  },

  getCsa(adminId: string) {
    return api.get<{ csa: CsaAdmin }>('/admin/support/csas/' + adminId)
  },

  updateCsa(adminId: string, payload: UpdateCsaPayload) {
    return api.patch<{ csa: CsaAdmin }>('/admin/support/csas/' + adminId, payload)
  },

  setCsaStatus(adminId: string, status: AdminStatus) {
    return api.patch<{ csa: CsaAdmin }>('/admin/support/csas/' + adminId + '/status', { status })
  },

  getCsaStats(adminId: string) {
    return api.get<{ adminId: string; stats: CsaPerformance }>(
      '/admin/support/csas/' + adminId + '/stats',
    )
  },

  listFailedLogins(params: {
    withinHours?: number
    includeLocked?: boolean
    page?: number
    limit?: number
  } = {}) {
    return api.get<FailedLoginsResponse>('/admin/support/csas/failed-logins', { params })
  },

  listFailedLoginAttempts(params: {
    withinHours?: number
    adminId?: string
    page?: number
    limit?: number
  } = {}) {
    return api.get<FailedLoginAttemptsResponse>('/admin/support/csas/failed-login-attempts', {
      params,
    })
  },

  listCsaTickets(
    adminId: string,
    params: {
      status?: SupportTicketStatus
      ratedOnly?: boolean
      page?: number
      limit?: number
    } = {},
  ) {
    return api.get<CsaTicketsResponse>(`/admin/support/csas/${adminId}/tickets`, { params })
  },

  listCsaIpWhitelist(adminId: string) {
    return api.get<CsaIpWhitelistResponse>(`/admin/support/csas/${adminId}/ip-whitelist`)
  },

  addCsaIp(adminId: string, ipAddress: string) {
    return api.post<{ ip: CsaIpWhitelistEntry }>(
      `/admin/support/csas/${adminId}/ip-whitelist`,
      { ipAddress },
    )
  },

  removeCsaIp(adminId: string, whitelistId: string) {
    return api.delete<{ ok: true; id: string }>(
      `/admin/support/csas/${adminId}/ip-whitelist/${whitelistId}`,
    )
  },

  async exportCsasCsv(status?: AdminStatus) {
    const { data } = await api.get<string>('/admin/support/csas/export', {
      params: status ? { status } : undefined,
      responseType: 'text',
    })
    return data
  },

  // --- Tickets ---
  listTickets(params: TicketListQuery = {}) {
    return api.get<{
      tickets: SupportTicketListItem[]
      pagination: { page: number; limit: number; total: number; hasMore: boolean }
    }>('/admin/support/tickets', { params })
  },

  getTicket(ticketId: string, params?: { cursor?: string; limit?: number }) {
    return api.get<TicketDetailResponse>('/admin/support/tickets/' + ticketId, { params })
  },

  reply(ticketId: string, payload: { content: string; imageUrl?: string }) {
    return api.post<{ message: SupportMessage }>(
      '/admin/support/tickets/' + ticketId + '/reply',
      payload,
    )
  },

  resolve(ticketId: string, payload: { resolution: SupportTicketResolution; note: string }) {
    return api.post('/admin/support/tickets/' + ticketId + '/resolve', payload)
  },

  close(ticketId: string) {
    return api.post('/admin/support/tickets/' + ticketId + '/close')
  },

  claim(ticketId: string) {
    return api.post('/admin/support/tickets/' + ticketId + '/claim')
  },

  assign(ticketId: string, adminId: string) {
    return api.post('/admin/support/tickets/' + ticketId + '/assign', { adminId })
  },

  setPriority(ticketId: string, priority: SupportTicketPriority) {
    return api.patch('/admin/support/tickets/' + ticketId + '/priority', { priority })
  },

  addNote(ticketId: string, content: string) {
    return api.post('/admin/support/tickets/' + ticketId + '/notes', { content })
  },

  bulkResolveWithTemplate(payload: {
    ticketIds: string[]
    templateId: string
    resolution?: SupportTicketResolution
  }) {
    return api.post<BulkResolveWithTemplateResult>(
      '/admin/support/tickets/bulk-resolve-with-template',
      payload,
    )
  },

  // --- Reply templates ---
  listReplyTemplates() {
    return api.get<{ templates: SupportReplyTemplate[] }>('/admin/support/reply-templates')
  },

  createReplyTemplate(payload: { title: string; content: string }) {
    return api.post<{ template: SupportReplyTemplate }>(
      '/admin/support/reply-templates',
      payload,
    )
  },

  updateReplyTemplate(templateId: string, payload: { title?: string; content?: string }) {
    return api.patch<{ template: SupportReplyTemplate }>(
      '/admin/support/reply-templates/' + templateId,
      payload,
    )
  },

  deleteReplyTemplate(templateId: string) {
    return api.delete<{ ok: true; id: string }>('/admin/support/reply-templates/' + templateId)
  },

  getUploadUrl(payload: { ticketId: string; fileName: string; mimeType: string }) {
    return api.post<{
      uploadUrl: string
      publicUrl: string
      key: string
      contentType?: string
    }>('/admin/support/upload-url', payload)
  },

  myStats() {
    return api.get<{ stats: CsaPerformance }>('/admin/support/me/stats')
  },

  // --- Notifications ---
  getBadge() {
    return api.get<NotificationBadge>('/admin/support/notifications/badge')
  },

  listNotifications(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
    return api.get<{
      notifications: SupportNotification[]
      total: number
      hasMore: boolean
    }>('/admin/support/notifications', { params })
  },

  markNotificationsRead(ids?: string[]) {
    return api.post('/admin/support/notifications/read', ids ? { ids } : {})
  },

  // --- Reports ---
  listReports(params: ReportListQuery = {}) {
    return api.get<{
      reports: SupportReport[]
      pagination?: { page: number; limit: number; total: number; hasMore: boolean }
      total?: number
      page?: number
      limit?: number
      hasMore?: boolean
    }>('/admin/support/reports', { params })
  },

  getReport(reportId: string) {
    return api.get<{ report: SupportReport }>('/admin/support/reports/' + reportId)
  },

  reviewReport(
    reportId: string,
    payload: { status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED'; resolutionNote?: string },
  ) {
    return api.patch<{ report: SupportReport }>(
      '/admin/support/reports/' + reportId + '/status',
      payload,
    )
  },

  escalateReport(reportId: string) {
    return api.post<{
      report: SupportReport
      ticket: { id: string; publicId?: string }
    }>('/admin/support/reports/' + reportId + '/escalate')
  },
}

export async function uploadSupportReplyImage(ticketId: string, file: File): Promise<string> {
  const { data } = await customerSupportApi.getUploadUrl({
    ticketId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
  })
  const putRes = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': data.contentType || file.type || 'application/octet-stream' },
    body: file,
  })
  if (!putRes.ok) throw new Error('Image upload failed: ' + putRes.status)
  return data.publicUrl
}
