export type LedgerAuditCategory = 'VIP' | 'COIN' | 'POINT' | 'TRADING_COIN'
export type LedgerAuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL'
export type LedgerAuditStatus = 'OPEN' | 'ACKNOWLEDGED' | 'DISMISSED'

export type LedgerAuditCode =
  | 'VIP_EXPIRY_MISMATCH'
  | 'VIP_ACTIVE_WITHOUT_PURCHASE'
  | 'VIP_PURCHASE_WITHOUT_LEDGER'
  | 'VIP_LEDGER_WITHOUT_PURCHASE'
  | 'NON_APP_ADMIN_LEDGER'
  | 'NON_APP_UNKNOWN_LEDGER'
  | 'LEDGER_BALANCE_CHAIN_BREAK'
  | string

export type LedgerAuditSearchType = 'auto' | 'userId' | 'publicId' | 'displayId'

export type LedgerAuditFlagUser = {
  id: string
  username: string
  publicId: string
  currentVipPublicId: string | null
  firstName: string | null
  lastName: string | null
  /** currentVipPublicId ?? publicId */
  displayId: string
}

/** Evidence is code-specific; always treat as a loose record in the UI. */
export type LedgerAuditEvidence = Record<string, unknown> & {
  userId?: string
  username?: string
  publicId?: string
  currentVipPublicId?: string | null
  expectedExpiresAt?: string | null
  actualExpiresAt?: string | null
  purchaseCount?: number
  purchases?: Array<{
    id: string
    createdAt: string
    periodDays: number
    coinCost: string
    expiresAtAfter: string
    ledgerEntryId: string
  }>
  origin?: 'ADMIN' | 'UNKNOWN'
  ledgerEntryId?: string
  pointLedgerEntryId?: string
  priorLedgerEntryId?: string | null
  currencyType?: string
  txType?: string
  direction?: 'CREDIT' | 'DEBIT'
  amount?: string
  balanceAfter?: string
  balanceBefore?: string
  expectedBalanceAfter?: string
  actualBalanceAfter?: string
  balanceCarriesForward?: boolean
  idempotencyKey?: string
  metadata?: unknown
  description?: string | null
  createdAt?: string
}

export type LedgerAuditFlag = {
  id: string
  userId: string
  category: LedgerAuditCategory
  code: LedgerAuditCode
  severity: LedgerAuditSeverity
  status: LedgerAuditStatus
  fingerprint: string
  summary: string
  evidence: LedgerAuditEvidence
  ledgerEntryId: string | null
  pointLedgerEntryId: string | null
  vipPurchaseId: string | null
  windowStart: string
  windowEnd: string
  resolvedAt: string | null
  resolvedByAdminId: string | null
  resolutionNote: string | null
  createdAt: string
  updatedAt: string
  user?: LedgerAuditFlagUser
}

export type LedgerAuditFlagListResponse = {
  page: number
  limit: number
  total: number
  items: LedgerAuditFlag[]
}

export type LedgerAuditFlagListQuery = {
  page?: number
  limit?: number
  status?: LedgerAuditStatus
  category?: LedgerAuditCategory
  code?: LedgerAuditCode
  severity?: LedgerAuditSeverity
  from?: string
  to?: string
  q?: string
  qType?: LedgerAuditSearchType
}

export type LedgerAuditFlagPatchBody = {
  status: 'ACKNOWLEDGED' | 'DISMISSED' | 'OPEN'
  note?: string | null
}

export type LedgerAuditRunResponse = {
  ok: true
  queued: true
  jobId: string
}
