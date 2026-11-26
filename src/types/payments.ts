export type PaymentChannel = 'EPAY' | 'GOOGLE_PLAY' | 'APPLE'
export type PaymentTxnKind = 'PURCHASE' | 'REFUND' | 'PAYOUT' | 'PAYOUT_REVERSAL'

export type PaymentTxn = {
  id: string
  channel: PaymentChannel
  kind: PaymentTxnKind
  /** PURCHASE: SUCCEEDED | REFUNDED · REFUND: APPLIED · PAYOUT: SUCCEEDED | REVERSED */
  status: string
  externalId: string
  providerRef: string | null
  parentId: string | null
  userId: string
  user: { publicId: string | null; name: string | null; status: string } | null
  walletCurrency: 'COIN' | 'TRADING_COIN' | 'POINT' | string
  amount: string
  currency: string
  units: string | null
  sourceTable: string | null
  sourceId: string | null
  reason: string | null
  metadata: Record<string, unknown> | null
  occurredAt: string
  createdAt: string
}

export type PaymentTxnListQuery = {
  channel?: PaymentChannel
  kind?: PaymentTxnKind
  status?: string
  userId?: string
  externalId?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export type PaymentTxnListResponse = { items: PaymentTxn[]; nextCursor: string | null }

export type SuspectIdentityType = 'PHONE' | 'EMAIL' | 'DEVICE' | 'USER'
export type SuspectStatus = 'ACTIVE' | 'CLEARED'

export type PaymentSuspect = {
  id: string
  identityType: SuspectIdentityType
  identityValue: string
  userId: string
  reason: string
  sourceTxnId: string | null
  status: SuspectStatus
  hitCount: number
  note: string | null
  lastFlaggedAt: string
  clearedAt: string | null
  clearedByAdminId: string | null
  createdAt: string
}

export type PaymentSuspectListQuery = {
  status?: SuspectStatus
  identityType?: SuspectIdentityType
  userId?: string
  q?: string
  page?: number
  limit?: number
}

export type PaymentSuspectListResponse = {
  items: PaymentSuspect[]
  total: number
  page: number
  limit: number
}

export type AdminPaymentRefundBody = {
  channel: PaymentChannel
  purchaseExternalId: string
  refundExternalId?: string
  /** Decimal string; omit for a full refund. */
  refundAmount?: string
  reason: string
}

export type AdminPaymentRefundResult =
  | { outcome: 'APPLIED'; refundTxnId: string; userId: string; clawedUnits: string }
  | { outcome: 'ALREADY_APPLIED'; refundTxnId: string; userId: string }
