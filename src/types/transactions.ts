export type TransactionsTab =
  | 'coins'
  | 'points'
  | 'trading-coins'
  /** DIAMOND wallet ledger — conversions, game wagers/wins/refunds, and the GAME_HOUSE legs. */
  | 'game-diamonds'
  /** @deprecated Explorer alias — mapped to `trading-coins`. Revert POST path still uses this key. */
  | 'coin-trading-transfers'
  | 'gifts'
  | 'subscriptions'
  | 'vip-purchases'
  | 'store-purchases'

export type LedgerDirection = 'credit' | 'debit' | 'CREDIT' | 'DEBIT'

export type AdminUserBrief = {
  userId: string
  username: string
  /** Legal name (first + last); may be empty. */
  name?: string
  displayName: string
  publicId: string
  displayPublicId: string
  avatarUrl: string | null
}

/** Wallet-history-shaped peer / catalog extras on ledger rows. */
export type CounterpartyDetails = {
  userId?: string
  name?: string
  publicId?: string
  avatarUrl?: string | null
  storeItemName?: string
  price?: string
  rarePublicId?: string
  membershipType?: string
  addedByAdmin?: { adminUserId: string; name?: string; publicId?: string }
  transactionId?: string
} | null

export type AdminTransactionsListQuery = {
  id?: string
  ledgerEntryId?: string
  transactionId?: string
  giftTransactionId?: string
  transferId?: string
  purchaseId?: string
  subscriptionId?: string
  storePurchaseId?: string
  vipPurchaseId?: string
  userId?: string
  senderUserId?: string
  receiverUserId?: string
  counterpartyId?: string
  publicId?: string
  q?: string
  types?: string
  direction?: 'credit' | 'debit'
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export type AdminGiftLink = {
  giftTransactionId: string
  giftId: string
  giftName: string
  displayImageUrl: string | null
  coinCost: number
  pointsAwarded: number
  quantity: number
}

export type AdminStoreItemBrief = {
  id: string
  name: string
  category: string
  coinCost: number
  displayImageUrl: string | null
  effectUrl?: string | null
  validityDays?: number | null
}

export type AdminVipPurchaseBrief = {
  id: string
  tier: string
  periodDays: number
  coinCost: string
  expiresAtAfter: string
}

export type AdminCoinTradingTransferBrief = {
  id: string
  tradingCoinsDebited: string
  coinsCredited: string
  recipientWalletType: string
  reversedAt?: string | null
}

/** Present on coin / trading-coin / points ledger rows — which POST to call when canRevert. */
export type AdminCoinRevertVia = {
  endpoint: 'coin_ledger' | 'coin_trading_transfer' | 'withdrawal'
  id: string
} | null

export type PlatformProfitBuckets = {
  coins: string
  points: string
  tradingCoins: string
}

export type AdminLedgerEntry = {
  id: string
  direction: LedgerDirection
  txType: string
  transactionName: string
  amount: string
  balanceAfter: string
  refId: string | null
  description: string | null
  metadata: unknown
  createdAt: string
  currencyType?: string
  user: AdminUserBrief
  counterparty: AdminUserBrief | null
  /** Wallet-history shape; always has user fields when a peer exists. */
  counterpartyDetails?: CounterpartyDetails
  gift: AdminGiftLink | null
  storeItem?: AdminStoreItemBrief | null
  vipPurchase?: AdminVipPurchaseBrief | null
  coinTradingTransfer?: AdminCoinTradingTransferBrief | null
  canRevert: boolean
  /** Additive: exact revert route for personal/trading coin ledger. */
  revertVia?: AdminCoinRevertVia
  /** Additive: set when this row's transaction (or its transfer) was already reverted. */
  reversal?: AdminReversalSummary | null
  platformProfit?: PlatformProfitBuckets
}

export type AdminCoinTradingTransfer = {
  id: string
  sender: AdminUserBrief
  receiver: AdminUserBrief
  tradingCoinsDebited: string
  coinsCredited: string
  recipientWalletType: string
  senderLedgerEntryId: string
  recipientLedgerEntryId: string
  reversedAt: string | null
  reverseReason: string | null
  reversedBy: AdminUserBrief | null
  createdAt: string
  canRevert: boolean
  reversal?: AdminReversalSummary | null
}

export type AdminGiftTransaction = {
  id: string
  sender: AdminUserBrief
  receiver: AdminUserBrief
  gift: {
    id: string
    name: string
    code: string
    displayImageUrl: string | null
    catalogCoinCost: number
    vipOnly: boolean
  }
  coinCost: number
  pointsAwarded: number
  quantity: number
  context: string | null
  createdAt: string
  canRevert: boolean
  platformProfit?: PlatformProfitBuckets
}

export type AdminSubscription = {
  id: string
  status: string
  subscriber: AdminUserBrief
  creator: AdminUserBrief
  nextRenewalAt: string
  graceUntil: string | null
  createdAt: string
  updatedAt: string
}

export type AdminVipPurchase = {
  id: string
  user: AdminUserBrief
  tier: string
  periodDays: number
  coinCost: string
  ledgerEntryId: string
  ledgerEntry: {
    id: string
    amount: string
    direction: LedgerDirection
    txType: string
    balanceAfter: string
    createdAt: string
  }
  expiresAtBefore: string | null
  expiresAtAfter: string
  createdAt: string
  platformProfit?: PlatformProfitBuckets
}

export type AdminStorePurchase = {
  id: string
  recipient: AdminUserBrief
  buyer: AdminUserBrief
  storeItem: AdminStoreItemBrief
  coinsPaid: number
  isActive: boolean
  isApplied: boolean
  expiresAt: string
  activatedAt: string | null
  expiredAt: string | null
  revokedAt: string | null
  createdAt: string
  platformProfit?: PlatformProfitBuckets
}

export type AdminTransactionEntry =
  | AdminLedgerEntry
  | AdminCoinTradingTransfer
  | AdminGiftTransaction
  | AdminSubscription
  | AdminVipPurchase
  | AdminStorePurchase

export type AdminTransactionsListResponse<T = AdminTransactionEntry> = {
  entries: T[]
  nextCursor: string | null
  hasMore: boolean
}

export type PlatformProfitSummaryResponse = {
  platformProfitTotals: PlatformProfitBuckets
}

export type AdminRevertMode = 'full' | 'force'

export type AdminTransactionRevertBody = {
  /** Required unless `dryRun`. */
  reason?: string
  idempotencyKey?: string
  /** `force` (SUPER_ADMIN only): recover what the receiver still has; shortfall is final. */
  mode?: AdminRevertMode
  /** Preview only — no money moves. */
  dryRun?: boolean
}

/** `dryRun: true` response. Amounts are integer strings. */
export type AdminRevertPreview = {
  ok: true
  dryRun: true
  /** Withdrawal rows forward to the withdrawal reverse; no amounts, no force. */
  via?: 'withdrawal'
  currency?: string
  originalAmount?: string
  receiverAvailable?: string
  /** What a force reverse would recover now (= original when sufficient). */
  recoverable?: string
  shortfall?: string
  sufficient: boolean
  forceAllowed: boolean
}

/** Set on a row once its transaction was reverted (full or forced). */
export type AdminReversalSummary = {
  reversedAt: string
  forced: boolean
  /** Null for reverts made before partial reverts existed. */
  recoveredAmount: string | null
  shortfallAmount: string
}
