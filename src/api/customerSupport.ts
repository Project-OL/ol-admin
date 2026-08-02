import api from '@/api/client'
import type {
  AdminStatus,
  CreateCsaPayload,
  CsaAdmin,
  CsaOverview,
  CsaPerformance,
  NotificationBadge,
  ReportListQuery,
  SupportNotification,
  SupportReport,
  SupportTicketListItem,
  TicketDetailResponse,
  TicketListQuery,
  UpdateCsaPayload,
  SupportTicketPriority,
  SupportTicketResolution,
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
    return api.post('/admin/support/tickets/' + ticketId + '/reply', payload)
  },

  resolve(ticketId: string, payload: { resolution: SupportTicketResolution; note?: string }) {
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
