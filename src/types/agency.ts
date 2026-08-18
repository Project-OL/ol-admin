export interface AgencyOverviewStats {
  totalAgencies: number
  totalActiveAgencies: number
  activeAgenciesPercent: number
  totalSuspendedAgencies: number
  totalHosts: number
  todayAgencyEarningsPoints: string
  yesterdayAgencyEarningsPoints: string
  todayEarningsChangePercent: number | null
}

export interface AgencyListItem {
  agencyUserId: string
  agencyPublicId: string
  userName: string
  userPublicId: string
  totalHosts: number
  country: string | null
  earningsThisMonthPoints: string
  earningsThisMonthUsd: string
  commissionTier: string
  /** Admin grant — agent cannot accept payroll without this */
  payrollPrivilegeGranted: boolean
  /** Agent accept-toggle (forced off when privilege revoked) */
  payrollEnabled: boolean
  status: 'ACTIVE' | 'SUSPENDED' | string
  approvedAt: string
}

export interface AgencyListResponse {
  items: AgencyListItem[]
  total: number
  skip: number
  take: number
}

export interface AgencyKycReview {
  govtIdUploaded?: boolean
  govtIdUrl?: string | null
  govtIdSubmittedAt?: string | null
  contactSubmitted?: boolean
  contactPhone?: string | null
  contactEmail?: string | null
  contactSubmittedAt?: string | null
  faceVerified?: boolean
  faceImageUrl?: string | null
  isComplete?: boolean
}

/** KYC block on pending/rejected application list items */
export interface AgencyApplicationKyc {
  govtIdUploaded: boolean
  govtIdUrl: string | null
  govtIdSubmittedAt: string | null
  contactSubmitted: boolean
  contactPhone: string | null
  contactEmail: string | null
  contactSubmittedAt: string | null
  faceVerified: boolean
  faceImageUrl: string | null
  isComplete: boolean
}

export type AgencyApplicationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'MORE_DOCS_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'

/** Shared shape for GET pending + GET rejected application lists */
export interface AgencyApplicationListItem {
  applicationId: string
  applicantUserId: string
  applicantUserName: string
  username: string
  userPublicId: string
  country: string | null
  avatarUrl: string | null
  faceImageUrl: string | null
  status: AgencyApplicationStatus | string
  appliedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  adminNote: string | null
  userNote: string | null
  kyc: AgencyApplicationKyc
}

export type PendingApplication = AgencyApplicationListItem

export interface AgencyApplicationListPage {
  items: AgencyApplicationListItem[]
  total: number
  skip: number
  take: number
}

/** @deprecated Use AgencyApplicationListPage */
export type PendingApplicationsResponse = AgencyApplicationListPage

/** @deprecated Use AgencyApplicationListPage */
export type RejectedAgencyApplicationsPage = AgencyApplicationListPage

/** @deprecated Use AgencyApplicationListItem */
export type RejectedAgencyApplication = AgencyApplicationListItem

/** Response from GET /admin/agency/applications/:userId/kyc */
export interface AgencyApplicationKycDetail {
  govtIdUrl: string | null
  faceImageUrl: string | null
  contactPhone: string | null
  contactEmail: string | null
  contactSubmittedAt: string | null
  govtIdSubmittedAt: string | null
  govtIdUploaded: boolean
  contactSubmitted: boolean
  faceVerified: boolean
  /** Raw KYC row — prefer URL fields above for display */
  kyc?: Record<string, unknown>
}

export interface AgencyDetail {
  agencyUserId: string
  agencyPublicId: string
  userName: string
  userPublicId: string
  contactPhone: string | null
  contactEmail: string | null
  approvedAt: string
  country: string | null
  kycVerified: boolean
  kycDocuments: AgencyKycReview
  faceVerified: boolean
  totalHosts: number
  totalEarningHosts: number
  totalEarningsPoints: string
  totalEarningsUsd: string
  thisMonthEarningsPoints: string
  thisMonthEarningsUsd: string
  commissionTier: string
  currentWindowTotalPoints?: string
  /** Admin-assigned base tier while lock is active. */
  tierLockLevel?: string | null
  tierLockUntil?: string | null
  tierLockBonusPoints?: string | null
  effectiveWindowTotalPoints?: string
  /** Admin grant — agent cannot accept payroll without this */
  payrollPrivilegeGranted: boolean
  /** Agent accept-toggle (forced off when privilege revoked) */
  payrollEnabled: boolean
  status: 'ACTIVE' | 'SUSPENDED' | string
  pausedUntil: string | null
}

export interface AgencyListQuery {
  skip?: number
  take?: number
  status?: 'ACTIVE' | 'SUSPENDED'
  country?: string
  q?: string
}

export interface ApproveApplicationPayload {
  applicationId: string
  commissionTier?: string
}

export interface RejectApplicationPayload {
  adminNote?: string
  userNote?: string
}

export interface SuspendAgencyPayload {
  suspendDays?: number
  pausedUntil?: string
}

export type AgencyBanPayload = {
  reason?: string
}

export type AgencyBanResponse = {
  ok: boolean
  agencyUserId: string
  agencyPublicId: string
  barred: boolean
  adminUserId: string
}

export type AgencyPayrollResponse = {
  ok: boolean
  agencyUserId: string
  payrollPrivilegeGranted: boolean
  payrollEnabled: boolean
}

export type AgencyUnbarResponse = {
  ok: boolean
  userId: string
  barred: boolean
}

export interface TransferHostsPayload {
  targetAgencyIdentifier: string
  hostUserIds: string[]
}

export type AgencyPeriodQuery = {
  periodDays?: number
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

export type AgencyPeriod = {
  from: string
  to: string
  periodDays?: number
}

export type AgencyHostEarningsItem = {
  hostUserId: string
  displayName: string
  displayPublicId: string
  publicId: string
  username: string
  avatarUrl: string | null
  joinedAt: string
  hostEarningsPoints: string
  hostCommissionPoints: string
  totalPoints: string
  liveDurationSeconds: string
}

export type AgencyHostEarningsResponse = {
  agencyUserId: string
  agencyPublicId: string
  commissionTier: string
  period: AgencyPeriod
  hosts: AgencyHostEarningsItem[]
  nextCursor: string | null
  hasMore: boolean
}

export type AgencyCommissionHostBrief = {
  userId: string
  displayName: string
  publicId: string
  displayPublicId: string
  username: string
  avatarUrl: string | null
}

export type AgencyCommissionHistoryEntry = {
  id: string
  direction: string
  amount: string
  balanceAfter: string
  refId: string | null
  description: string | null
  createdAt: string
  category: string | null
  rateBp: number | null
  hostTxType: string | null
  hostLedgerEntryId: string | null
  host: AgencyCommissionHostBrief | null
}

export type AgencyCommissionHistoryQuery = AgencyPeriodQuery & {
  hostPublicId?: string
  hostUserId?: string
}

export type AgencyCommissionHistoryResponse = {
  agencyUserId: string
  agencyPublicId: string
  commissionTier: string
  period: AgencyPeriod
  filter: {
    hostPublicId?: string | null
    hostUserId?: string | null
  }
  entries: AgencyCommissionHistoryEntry[]
  nextCursor: string | null
  hasMore: boolean
}

export type AgencyLevelSnapshot = {
  currentLevel: string
  currentWindowTotalPoints: string
  lastLevelRecomputedAt: string | null
  tierLockLevel?: string | null
  tierLockUntil?: string | null
  tierLockBonusPoints?: string | null
  effectiveWindowTotalPoints?: string
}

export type AgencyRecomputeLevelResponse = {
  ok: boolean
  agencyUserId: string
  agencyPublicId: string
  levelWindow: {
    from: string
    to: string
    note?: string
  }
  before: AgencyLevelSnapshot
  after: AgencyLevelSnapshot
}

export type AgencyRecomputeMasterResponse = {
  ok: boolean
  enqueued: boolean
}

/** GET /admin/agency/commission/config */
export type AgencyCommissionWindowConfig = {
  windowDays: number
  windowHours: number
  windowMinutes: number
  /** Convenience: days*24*60 + hours*60 + minutes */
  totalMinutes: number
  updatedAt: string | null
  updatedByAdminId: string | null
}

/** PUT /admin/agency/commission/config — partial update, at least one field */
export type AgencyCommissionWindowConfigUpdate = {
  windowDays?: number
  windowHours?: number
  windowMinutes?: number
}

export type AgencyCommissionWindowConfigUpdateResponse = AgencyCommissionWindowConfig & {
  recomputeEnqueued: boolean
}

export const COMMISSION_TIERS = ['D', 'C', 'B', 'A', 'S', 'SS+'] as const
