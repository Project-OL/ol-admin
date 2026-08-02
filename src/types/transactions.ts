export type TransactionsTab =
  | 'coins'
  | 'points'
  | 'trading-coins'
  | 'coin-trading-transfers'
  | 'gifts'
  | 'subscriptions'
  | 'vip-purchases'
  | 'store-purchases'

export type LedgerDirection = 'credit' | 'debit' | 'CREDIT' | 'DEBIT'

export type AdminUserBrief = {
  userId: string
  username: string
  displayName: string
  publicId: string
  displayPublicId: string
  avatarUrl: string | null
}

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
  gift: AdminGiftLink | null
  storeItem?: AdminStoreItemBrief | null
  vipPurchase?: AdminVipPurchaseBrief | null
  coinTradingTransfer?: AdminCoinTradingTransferBrief | null
  canRevert: boolean
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

export type AdminTransactionRevertBody = {
  reason: string
  idempotencyKey?: string
}
