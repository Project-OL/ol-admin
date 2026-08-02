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
  contactPhone?: string | null
  contactEmail?: string | null
  contactSubmittedAt?: string | null
  faceVerified?: boolean
  isComplete?: boolean
}

export interface PendingApplication {
  applicationId: string
  applicantUserId: string
  applicantUserName: string
  userPublicId: string
  country: string | null
  kyc: AgencyKycReview
  status: string
  appliedAt: string
}

export interface PendingApplicationsResponse {
  items: PendingApplication[]
  total: number
  skip: number
  take: number
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

export const COMMISSION_TIERS = ['D', 'C', 'B', 'A'] as const
