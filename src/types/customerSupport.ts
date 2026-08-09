export type AdminStatus = 'ACTIVE' | 'DISABLED' | 'SUSPENDED'

export type SupportTicketStatus =
  | 'OPEN'
  | 'AWAITING_REPLY'
  | 'ASSIGNED'
  | 'PENDING_REVIEW'
  | 'CLOSED'

export type SupportTicketStage = 'open' | 'assigned' | 'pending_review' | 'closed'

export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export type SupportTicketType =
  | 'CONSULT'
  | 'REPORT_COMPLAINTS'
  | 'FEEDBACK'
  | 'BUSINESS_COOPERATION'

export type SupportTicketResolution = 'RESOLVED' | 'REJECTED'

export type SupportTicketRefType =
  | 'WITHDRAWAL'
  | 'POINT_TRANSFER'
  | 'COIN_TRANSFER'
  | 'LEDGER_ENTRY'

export type CsaNotificationType =
  | 'TICKET_ASSIGNED'
  | 'TICKET_REPLY'
  | 'TICKET_REASSIGNED'
  | 'TICKET_ESCALATED'
  | 'REPORT_ASSIGNED'

export type ReportStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED'
export type ReportContext = 'CHAT' | 'LIVE'
export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'INAPPROPRIATE_CONTENT'
  | 'FAKE_ACCOUNT'
  | 'VIOLENCE'
  | 'OTHER'

export interface CsaPerformance {
  openTickets: number
  resolvedTotal: number
  rejectedTotal: number
  resolved30d: number
  avgRating: number | null
  ratingCount: number
  avgFirstResponseMs: number | null
}

export interface CsaAdmin {
  id: string
  name: string
  username: string | null
  email: string
  phone: string | null
  phoneCountryCode: string | null
  gender: string | null
  country: string | null
  status: AdminStatus
  role: string
  createdAt: string
  lastLoginAt: string | null
  failedLoginCount: number
  lastFailedLoginAt?: string | null
  lockedUntil: string | null
  /** Convenience: lockedUntil is in the future (login lockout, not SUSPENDED/DISABLED). */
  isLocked?: boolean
  isOnline?: boolean
  openTicketCount?: number
  performance?: CsaPerformance
  reassignment?: { reassigned: number; unassigned: number } | null
  ipWhitelist?: CsaIpWhitelistEntry[]
}

export interface CsaOverview {
  totalCsa: number
  activeCsa: number
  onlineNow: number
  suspendedCsa: number
  disabledCsa: number
  failedLoginAttempts24h: number
  lockedAccounts: number
}

export interface CreateCsaPayload {
  name: string
  username: string
  email: string
  password: string
  phone: string
  phoneCountryCode: string
  gender?: 'male' | 'female' | 'other'
  country: string
  /** Exact IPv4/IPv6 allow-list for CSA login (max 20). Empty → cannot log in until IPs added. */
  allowedIps?: string[]
}

export interface CsaIpWhitelistEntry {
  id: string
  ipAddress: string
  createdAt: string
  createdByAdminId?: string | null
}

export interface CsaIpWhitelistResponse {
  adminId: string
  ips: CsaIpWhitelistEntry[]
}

export interface UpdateCsaPayload {
  name?: string
  username?: string
  phone?: string
  phoneCountryCode?: string
  gender?: 'male' | 'female' | 'other' | null
  country?: string
}

export interface SupportUserCard {
  id: string
  username?: string | null
  name?: string | null
  publicId?: string | null
  avatarUrl?: string | null
  country?: string | null
}

export interface SupportAdminCard {
  id: string
  displayName?: string | null
  email?: string | null
  username?: string | null
}

export interface SupportTicketListItem {
  id: string
  publicId?: string
  type: SupportTicketType
  subType?: string | null
  status: SupportTicketStatus
  stage: SupportTicketStage
  priority: SupportTicketPriority
  resolution?: SupportTicketResolution | null
  refType?: SupportTicketRefType | null
  refId?: string | null
  assignedAdminId?: string | null
  assignedAdmin?: SupportAdminCard | null
  user?: SupportUserCard | null
  messages?: Array<{
    id: string
    content?: string | null
    senderType?: string
    createdAt: string
  }>
  updatedAt: string
  createdAt: string
  hasUnread?: boolean
  rating?: number | null
  ratedAt?: string | null
}

export interface SupportMessage {
  id: string
  ticketId?: string
  senderType: 'USER' | 'SUPPORT' | 'SYSTEM' | string
  content: string | null
  imageUrl?: string | null
  createdAt: string
}

export interface SupportNote {
  id: string
  content: string
  createdAt: string
  admin?: SupportAdminCard | null
}

export interface SupportTicketDetail extends SupportTicketListItem {
  subject?: string | null
  description?: string | null
  resolvedAt?: string | null
  rating?: number | null
  ratedAt?: string | null
}

export interface TicketDetailResponse {
  ticket: SupportTicketDetail
  messages: SupportMessage[]
  notes: SupportNote[]
  hasMore: boolean
  nextCursor: string | null
}

export interface CsaTicketsResponse {
  adminId: string
  avgRating: number | null
  ratingCount: number
  tickets: SupportTicketListItem[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}

export interface FailedLoginsResponse {
  withinHours: number
  accounts: CsaAdmin[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface TicketListQuery {
  assignedTo?: string
  status?: SupportTicketStatus
  priority?: SupportTicketPriority
  type?: SupportTicketType
  page?: number
  limit?: number
}

export interface NotificationBadge {
  unreadCount: number
  myOpenTickets: number
  myAwaitingReply: number
}

export interface SupportNotification {
  id: string
  type: CsaNotificationType
  message: string
  isRead: boolean
  createdAt: string
  reportId?: string | null
  ticket?: {
    ticketId: string
    type?: string
    subType?: string
    status?: string
  } | null
}

export interface SupportReport {
  id: string
  status: ReportStatus
  context?: ReportContext | null
  reason?: ReportReason | string | null
  details?: string | null
  evidenceUrls?: string[]
  liveSessionId?: string | null
  hostUserId?: string | null
  escalatedTicketId?: string | null
  resolutionNote?: string | null
  createdAt: string
  reviewedAt?: string | null
  reporter?: SupportUserCard | null
  reportedUser?: SupportUserCard | null
  hostUser?: SupportUserCard | null
}

export interface ReportListQuery {
  status?: ReportStatus
  context?: ReportContext
  reason?: ReportReason
  reportedUserId?: string
  page?: number
  limit?: number
}
