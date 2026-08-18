export type AdminCurrencyKind = 'COIN' | 'POINT' | 'TRADING_COIN'
export type AdminCurrencyDirection = 'credit' | 'debit'

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
