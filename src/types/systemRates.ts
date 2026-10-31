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
  /** Lucky gifts: host cut of the total cost (400 = 4%). Absent on backends before BE-20 step 1.3. */
  luckyHostShareBp?: number
  /** Lucky gifts: reserve-pool RTP target (9200 = 92%). */
  luckyTargetRtpBp?: number
  updatedAt: string | null
  updatedByAdminId: string | null
}

export type HostRevenueSharesUpdate = {
  giftReceiveBp?: number
  subscriptionBp?: number
  guardianPurchaseBp?: number
  videoCallHostShareBp?: number
  luckyHostShareBp?: number
  luckyTargetRtpBp?: number
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

export type BankFieldKey =
  | 'firstName'
  | 'lastName'
  | 'bankName'
  | 'branch'
  | 'ifscCode'
  | 'accountNumber'
  | 'upiId'
  | 'email'
  | 'phone'

/** One field of the host "Bind bank" form, with its admin toggles and the check it enforces. */
export type BankFieldRuleDto = {
  field: BankFieldKey
  label: string
  required: boolean
  /** When true the format check (`format` / `pattern`) is enforced. */
  validate: boolean
  minLength: number
  maxLength: number
  format: string
  pattern: string
  patternFlags: string
}

export type BankFieldRuleDraft = { required: boolean; validate: boolean }

export type PayoutRailsConfig = {
  epay: PayoutRailDto
  bank: PayoutRailDto
  /** Absent on backends older than the bank-field-rules release. */
  bankFields?: BankFieldRuleDto[]
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
  bankFields?: Partial<Record<BankFieldKey, Partial<BankFieldRuleDraft>>>
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

export type RoyalHostGiftingTier = {
  threshold: string
  cumulativePoints: string
}

export type RoyalHostRewardConfigDto = {
  weeklyHoursRequired: number
  dailyHoursCapMinutes: number
  timingStep1Points: string
  timingStep2Points: string
  timingStep2EarningThreshold: string
  giftingTiers: RoyalHostGiftingTier[]
  consecutiveMissWeeksLimit: number
  autoRevokeEarningThreshold: string
  updatedAt: string
}

export type RoyalHostRewardConfigUpdate = Partial<Omit<RoyalHostRewardConfigDto, 'updatedAt'>>

/** Editable gifting-tier row for the Royal Host reward editor. */
export type RoyalHostGiftingTierDraft = {
  threshold: string
  cumulativePoints: string
}

export type NormalHostTier = {
  thresholdPoints: string
  hourlyRatePoints: string
  hourCapHours: number
  windowDays: number
}

export type NormalHostRewardConfigDto = {
  tiers: NormalHostTier[]
  updatedAt: string
}

export type NormalHostRewardConfigUpdate = {
  tiers: NormalHostTier[]
}

/** Normal Host basic daily reward: flat points for live minutes on a day with no tier. */
export type NormalHostBasicRewardConfigDto = {
  enabled: boolean
  requiredMinutes: number
  pointsAmount: string
  updatedAt: string
}

export type NormalHostBasicRewardConfigUpdate = {
  enabled: boolean
  requiredMinutes: number
  pointsAmount: string
}

/** Editable tier row for the Normal Host reward editor. */
export type NormalHostTierDraft = {
  thresholdPoints: string
  hourlyRatePoints: string
  hourCapHours: number
  windowDays: number
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
