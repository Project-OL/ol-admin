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
  | 'GIFT_FRAUD'
  | 'MULTIPLE_ACCOUNT'
  | 'TOP_UP_FRAUD'
  | 'LIVE_BROADCAST_VIOLATION'
  | 'CHILD_SAFETY_VIOLATION'

export const REPORT_REASON_OPTIONS: ReportReason[] = [
  'SPAM',
  'HARASSMENT',
  'INAPPROPRIATE_CONTENT',
  'FAKE_ACCOUNT',
  'VIOLENCE',
  'OTHER',
  'GIFT_FRAUD',
  'MULTIPLE_ACCOUNT',
  'TOP_UP_FRAUD',
  'LIVE_BROADCAST_VIOLATION',
  'CHILD_SAFETY_VIOLATION',
]

export interface CsaPerformance {
  openTickets: number
  resolvedTotal: number
  rejectedTotal: number
  resolved30d: number
  avgRating: number | null
  ratingCount: number
  avgFirstResponseMs: number | null
}

export interface CsaDirectoryEntry {
  id: string
  name: string
  username: string | null
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
  /** Consecutive wrong-password streak (resets on success). */
  failedLoginCount: number
  lastFailedLoginAt?: string | null
  lockedUntil: string | null
  /** Convenience: lockedUntil is in the future (login lockout, not SUSPENDED/DISABLED). */
  isLocked?: boolean
  isOnline?: boolean
  /** Append-only failed attempts in the last 24h (kept after a successful login). */
  failedAttemptCount24h?: number
  /** Append-only failed attempts in the roster `withinHours` window. */
  failedAttemptCount?: number
  openTicketCount?: number
  closedTicketCount?: number
  avgRating?: number | null
  ratingCount?: number
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

export interface SupportTicketTransactionRef {
  refType: SupportTicketRefType
  refId: string
}

/** User's opening form — preferred source for category, description, screenshot. */
export interface SupportTicketInitialSubmission {
  type: SupportTicketType | string
  subType?: string | null
  typeLabel?: string | null
  subTypeLabel?: string | null
  description?: string | null
  imageUrl?: string | null
  transactionRef?: SupportTicketTransactionRef | null
  submittedAt?: string | null
}

export interface SupportTicketListItem {
  id: string
  publicId?: string
  type: SupportTicketType
  subType?: string | null
  /** Human-readable labels from API (prefer over raw enum keys). */
  typeLabel?: string | null
  subTypeLabel?: string | null
  status: SupportTicketStatus
  stage: SupportTicketStage
  priority: SupportTicketPriority
  resolution?: SupportTicketResolution | null
  refType?: SupportTicketRefType | null
  refId?: string | null
  /** Legacy top-level fields — mirrored in `initialSubmission` when present. */
  description?: string | null
  imageUrl?: string | null
  initialSubmission?: SupportTicketInitialSubmission | null
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
  resolvedAt?: string | null
  /** Full days since CSA resolve/reject (resolvedAt); omitted when not yet reviewed. */
  daysSinceReviewed?: number | null
  hasUnread?: boolean
  rating?: number | null
  ratedAt?: string | null
  /** Starred by the calling admin (per-admin bookmark, not a global flag). */
  isStarred?: boolean
}

export interface SupportMessage {
  id: string
  publicId?: string
  ticketId?: string
  senderType: 'USER' | 'SUPPORT' | 'SYSTEM' | string
  content: string | null
  imageUrl?: string | null
  isAutoReply?: boolean
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
  resolvedAt?: string | null
  /** ISO timestamp: when the PENDING_REVIEW contest window expires. */
  pendingReviewUntil?: string | null
  /** When true on CLOSED tickets, user may still submit a star rating (app-side). */
  canRate?: boolean
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

export type AdminLoginFailureReason =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ADMIN_IP_FORBIDDEN'

export interface FailedLoginAttempt {
  id: string
  adminId: string
  email: string
  name: string
  reason: AdminLoginFailureReason
  ipAddress: string | null
  createdAt: string
}

export interface FailedLoginsResponse {
  withinHours: number
  accounts: CsaAdmin[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface FailedLoginAttemptsResponse {
  withinHours: number
  attempts: FailedLoginAttempt[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface SupportReplyTemplate {
  id: string
  title: string
  content: string
  createdByAdminId?: string | null
  createdAt: string
  updatedAt: string
}

export interface BulkResolveWithTemplateResult {
  templateId: string
  succeeded: number
  failed: number
  results: Array<{ ticketId: string; ok: boolean; error?: string }>
}

export interface TicketListQuery {
  assignedTo?: string
  status?: SupportTicketStatus
  priority?: SupportTicketPriority
  type?: SupportTicketType
  minDaysSinceReviewed?: number
  maxDaysSinceReviewed?: number
  /** Only tickets the calling admin has starred. */
  starredOnly?: boolean
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
  hostUserId?: string
  reporterId?: string
  page?: number
  limit?: number
}
