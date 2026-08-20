export type AdminCurrencyKind = 'COIN' | 'POINT' | 'TRADING_COIN'
export type AdminCurrencyDirection = 'credit' | 'debit'
export type LedgerGrain = 'month' | 'quarter' | 'year' | 'custom'
export type CompanyCashDirection = 'IN' | 'OUT'
export type CompanyCashReason = 'AGENCY_TRADING_PURCHASE' | 'EPAY_PAYOUT' | 'PAYROLL_TAKEOVER_PAYOUT'

export type PlatformProfitBuckets = {
  coins: string
  points: string
  tradingCoins: string
}

export type AdminCurrencyAdjustBody = {
  userId: string
  currency: AdminCurrencyKind
  direction: AdminCurrencyDirection
  amount: string
  description?: string
  idempotencyKey?: string
  forceTradingCredit?: boolean
  cashUsd?: string
  promotional?: boolean
}

export type AdminCurrencySupplySummary = {
  created: PlatformProfitBuckets
  returned: PlatformProfitBuckets
}

export type AdminCurrencyAdjustmentEntry = {
  id: string
  currency: AdminCurrencyKind
  direction: 'CREDIT' | 'DEBIT' | string
  amount: string
  balanceAfter: string
  description: string | null
  createdAt: string
  supplyEffect: 'created' | 'returned'
  user: {
    userId: string
    username: string
    name?: string
    displayName: string
    publicId: string
    displayPublicId: string
    avatarUrl: string | null
  }
}

export type AdminCurrencyAdjustmentsResponse = {
  entries: AdminCurrencyAdjustmentEntry[]
  nextCursor: string | null
  hasMore: boolean
}

export type LedgerLine = {
  id: string
  label: string
  units: string
  usd: string
}

export type MasterLedgerStock = {
  at: string
  companyAgencyUserId: string | null
  identityOk: boolean
  identityDelta: string
  inventory: LedgerLine[]
  outstanding: string
  outstandingUsd: string
  netMinted: string
  destroyedUnits: string
}

export type MasterLedgerPnl = {
  revenue: LedgerLine[]
  costs: LedgerLine[]
  operatingProfitUnits: string
  operatingProfitUsd: string
}

export type MasterLedgerDashboard = {
  period: { grain: LedgerGrain; from: string; to: string }
  hero: {
    capitalInUsd: string
    cashOutUsd: string
    cashProfitUsd: string
    operatingProfitUnits: string
    operatingProfitUsd: string
    identityOk: boolean
    identityDelta: string
  }
  stock: MasterLedgerStock
  pnl: MasterLedgerPnl
  cash: {
    capitalInUsd: string
    cashOutUsd: string
    cashProfitUsd: string
  }
}

export type CompanyCashEntry = {
  id: string
  direction: CompanyCashDirection
  reason: CompanyCashReason
  amountUsd: string
  amountUsdDisplay: string
  unitsAmount: string | null
  currencyType: AdminCurrencyKind | null
  counterpartyUserId: string | null
  counterparty: { name: string; publicId: string; username: string } | null
  ledgerRefId: string | null
  withdrawalId: string | null
  description: string | null
  promotional: boolean
  adminUserId: string
  createdAt: string
}

export type CompanyCashJournalResponse = {
  entries: CompanyCashEntry[]
  nextCursor: string | null
  hasMore: boolean
}

export type CompanyCashCreateBody = {
  direction: CompanyCashDirection
  reason: CompanyCashReason
  amountUsd: string
  counterpartyUserId?: string
  description?: string
  unitsAmount?: string
}
