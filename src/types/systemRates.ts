/** Soft-replace tier ladders (topup USD or exchange USD-equivalent). */
export type RateTier = {
  minUsd: number
  maxUsd: number | null
  coinsPerUsd: number
  sortOrder: number
}

export type RateTierBody = {
  tiers: Array<{
    minUsd: number
    maxUsd?: number | null
    coinsPerUsd: number
  }>
}

export type CoinPackage = {
  id: string
  coins: number
  priceCents: number
  amountUsd: string
  currency: string
  label: string | null
  sortOrder: number
}

export type CoinPackagesBody = {
  packages: Array<{
    coins: number
    priceCents: number
    currency?: string
    label?: string | null
  }>
}

export type TradingPackage = {
  id: string
  tradingCoins: string
  priceCents: number
  amountUsd: string
  coinsPerUsd: number
  currency: string
  label: string | null
  sortOrder: number
}

export type TradingPackagesBody = {
  packages: Array<{
    tradingCoins: string
    priceCents: number
    coinsPerUsd: number
    currency?: string
    label?: string | null
  }>
}

export type LevelThreshold = {
  level: number
  threshold: string
  label: string | null
  iconKey: string | null
}

export type WalletLevelConfigsBody = {
  wealth?: Array<{
    level: number
    threshold: string
    label?: string | null
    iconKey?: string | null
  }>
  livestream?: Array<{
    level: number
    threshold: string
    label?: string | null
    iconKey?: string | null
  }>
}

export type CommissionLevel = {
  level: string
  minWindowPoints: string
  liveRateBp: number
  matchChatRateBp: number
  sortOrder: number
}

export type CommissionLevelsBody = {
  levels: Array<{
    level: string
    minWindowPoints: string
    liveRateBp: number
    matchChatRateBp: number
    sortOrder: number
  }>
}

export type CommissionLevelsResponse = {
  levels: CommissionLevel[]
  recomputeEnqueued: boolean
}

export type HostRevenueShares = {
  giftReceiveBp: number
  subscriptionBp: number
  guardianPurchaseBp: number
  videoCallHostShareBp: number
  updatedAt: string | null
  updatedByAdminId: string | null
}

export type HostRevenueSharesUpdate = {
  giftReceiveBp?: number
  subscriptionBp?: number
  guardianPurchaseBp?: number
  videoCallHostShareBp?: number
}

export type CommissionWindowSnapshot = {
  windowDays: number
  windowHours: number
  windowMinutes: number
  totalMinutes: number
  updatedAt: string | null
  updatedByAdminId: string | null
}

export type CommissionWindowUpdate = {
  windowDays?: number
  windowHours?: number
  windowMinutes?: number
}

export type CommissionWindowUpdateResponse = CommissionWindowSnapshot & {
  recomputeEnqueued: boolean
}

export type PayrollConfigSnapshot = {
  id: number
  platformFeeRateBp: number
  agentRewardRateBp: number
  serviceFeeUsd: number
  minWithdrawalUsd: number
  maxWithdrawalUsd: number
  slaHours: number
  waitingHours: number
  maxAssignmentAttempts: number
  inrPerUsd: number
}

export type PayrollConfigUpdate = Partial<
  Omit<PayrollConfigSnapshot, 'id'>
>

export type VideoCallPriceCapTier = {
  minLevel: number
  maxLevel: number | null
  price: number
  label: string | null
  sortOrder: number
}

export type VideoCallPriceCapsSnapshot = {
  tiers: VideoCallPriceCapTier[]
}

export type VideoCallPriceCapsBody = {
  tiers: Array<{
    minLevel: number
    maxLevel?: number | null
    price: number
    label?: string | null
  }>
}

export type SystemRatesAggregate = {
  hostRevenueShares: HostRevenueShares
  personalExchangeRates: { tiers: RateTier[] }
  coinPackages: { packages: CoinPackage[] }
  walletLevelConfigs: { wealth: LevelThreshold[]; livestream: LevelThreshold[] }
  tradingTopupRates: { tiers: RateTier[] }
  agentExchangeRates: { tiers: RateTier[] }
  tradingTopupPackages: { packages: TradingPackage[] }
  commissionLevels: { levels: CommissionLevel[] }
  commissionWindow: CommissionWindowSnapshot
  payroll: PayrollConfigSnapshot
  videoCallPriceCaps?: VideoCallPriceCapsSnapshot
}

/** Editable row for tier tables (maxUsd blank = open-ended). */
export type RateTierDraft = {
  minUsd: number | null
  maxUsd: number | null
  coinsPerUsd: number | null
}

export type CoinPackageDraft = {
  coins: number | null
  priceUsd: number | null
  currency: string
  label: string
}

export type TradingPackageDraft = {
  tradingCoins: string
  priceUsd: number | null
  coinsPerUsd: number | null
  currency: string
  label: string
}

export type LevelThresholdDraft = {
  level: number | null
  threshold: string
  label: string
  iconKey: string
}

export type CommissionLevelDraft = {
  level: string
  minWindowPoints: string
  liveRatePercent: number | null
  matchChatRatePercent: number | null
  sortOrder: number | null
}

/** Grouped band for Call Price editor (multiple prices per level range). */
export type CallPriceBandDraft = {
  minLevel: number | null
  maxLevel: number | null
  label: string
  prices: Array<number | null>
}
