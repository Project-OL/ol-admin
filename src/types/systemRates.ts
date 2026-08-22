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

export type RestrictedIdentityWordsDto = {
  words: string[]
}

export type RestrictedIdentityWordsBody = {
  words: string[]
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

export type RichTierConfig = {
  tier: number
  minRechargeCoins: string
  displayName: string
}

export type RichTierConfigBody = {
  tiers: Array<{
    tier: number
    minRechargeCoins: string
    displayName: string
  }>
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

export type PayrollFeeTier = {
  minPoints: string
  maxPoints: string | null
  minUsd: number
  maxUsd: number | null
  platformFeeRateBp: number
  agentRewardRateBp: number
  sortOrder: number
}

export type PayrollFeeTierDraft = {
  minUsd: number | null
  maxUsd: number | null
  platformFeeRatePercent: number | null
  agentRewardRatePercent: number | null
}

export type PayrollCountryFxRate = {
  country: string
  countryCode: string | null
  currencyCode: string
  ratePerUsd: number
  sortOrder: number
}

export type PayrollCountryFxDraft = {
  country: string
  countryCode: string
  currencyCode: string
  ratePerUsd: number | null
}

export type PayrollConfigSnapshot = {
  id: number
  platformFeeRateBp: number
  agentRewardRateBp: number
  feeTiers?: PayrollFeeTier[]
  serviceFeeUsd: number
  minWithdrawalUsd: number
  maxWithdrawalUsd: number
  slaHours: number
  waitingHours: number
  maxAssignmentAttempts: number
  inrPerUsd: number
  nprPerUsd?: number
  countryRates?: PayrollCountryFxRate[]
}

export type PayrollConfigUpdate = Partial<
  Omit<PayrollConfigSnapshot, 'id' | 'feeTiers' | 'countryRates'>
> & {
  feeTiers?: Array<{
    minUsd: number
    maxUsd?: number | null
    platformFeeRateBp: number
    agentRewardRateBp: number
  }>
  countryRates?: Array<{
    country: string
    countryCode?: string | null
    currencyCode: string
    ratePerUsd: number
  }>
}

export type PayoutRailDto = {
  feeRateBp: number
  feePercent: number
  arrivalTime: string
  enabled: boolean
}

export type PayoutRailsConfig = {
  epay: PayoutRailDto
  bank: PayoutRailDto
  updatedAt: string
}

export type PayoutRailUpdate = {
  feeRateBp?: number
  arrivalTime?: string
  enabled?: boolean
}

export type PayoutRailsConfigUpdate = {
  epay?: PayoutRailUpdate
  bank?: PayoutRailUpdate
}

export type PayoutRailDraft = {
  enabled: boolean
  feePercent: number
  arrivalTime: string
}

export type MessagingActionUnit = 'seconds' | 'minutes' | 'hours'

export type MessagingConfigDto = {
  amount: number
  unit: MessagingActionUnit
  windowMs: number
  /** Floor of windowMs / 60_000; may be 0 for sub-minute windows. */
  windowMinutes: number
  windowSeconds: number
  updatedAt: string
}

export type MessagingConfigUpdate = {
  amount: number
  unit: MessagingActionUnit
}

/** PENDING_REVIEW contest window before auto-close (same shape as messaging window). */
export type SupportReviewWindowConfigDto = MessagingConfigDto

export type SupportReviewWindowConfigUpdate = MessagingConfigUpdate

export type AdminAuthLockoutUnit = 'minutes' | 'hours'

export type AdminAuthConfigDto = {
  failedLoginThreshold: number
  amount: number
  unit: AdminAuthLockoutUnit
  lockoutMinutes: number
  lockoutMs: number
  updatedAt: string
}

export type AdminAuthConfigUpdate = {
  failedLoginThreshold?: number
  amount?: number
  unit?: AdminAuthLockoutUnit
}

export type AgencyHostCooldownUnit = 'hours' | 'days'

export type AgencyHostConfigDto = {
  amount: number
  unit: AgencyHostCooldownUnit
  rejoinCooldownHours: number
  rejoinCooldownMs: number
  updatedAt: string
}

export type AgencyHostConfigUpdate = {
  amount?: number
  unit?: AgencyHostCooldownUnit
  rejoinCooldownHours?: number
}

export type LivestreamRewardConfigDto = {
  windowDays: number
  pointsPerHour: number
  updatedAt: string
}

export type LivestreamRewardConfigUpdate = {
  windowDays?: number
  pointsPerHour?: number
}

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
  richTierConfigs?: { tiers: RichTierConfig[] }
  tradingTopupRates: { tiers: RateTier[] }
  agentExchangeRates: { tiers: RateTier[] }
  tradingTopupPackages: { packages: TradingPackage[] }
  commissionLevels: { levels: CommissionLevel[] }
  commissionWindow: CommissionWindowSnapshot
  payroll: PayrollConfigSnapshot
  videoCallPriceCaps?: VideoCallPriceCapsSnapshot
  agencyHost?: AgencyHostConfigDto
  livestreamReward?: LivestreamRewardConfigDto
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
