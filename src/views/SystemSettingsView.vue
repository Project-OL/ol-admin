<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import { format, parseISO } from 'date-fns'
import { systemSettingsApi } from '@/api/systemSettings'
import InlineEditField from '@/components/shared/InlineEditField.vue'
import type {
  CallPriceBandDraft,
  CoinPackage,
  CoinPackageDraft,
  CommissionLevel,
  CommissionLevelDraft,
  CommissionWindowSnapshot,
  HostRevenueShares,
  LevelThreshold,
  LevelThresholdDraft,
  MessagingActionUnit,
  MessagingConfigDto,
  PayrollConfigSnapshot,
  PayrollCountryFxDraft,
  PayrollFeeTierDraft,
  PayoutRailDraft,
  PayoutRailsConfig,
  RateTier,
  RateTierDraft,
  SupportReviewWindowConfigDto,
  TradingPackage,
  TradingPackageDraft,
  VideoCallPriceCapTier,
  RichTierConfig,
  AdminAuthConfigDto,
  AdminAuthLockoutUnit,
  AgencyHostConfigDto,
  AgencyHostCooldownUnit,
  LivestreamRewardConfigDto,
  RestrictedIdentityWordsDto,
} from '@/types/systemRates'
import { showToast } from '@/utils/toast'

type SettingsTab =
  | 'host'
  | 'callPrice'
  | 'personal'
  | 'elite'
  | 'trading'
  | 'commission'
  | 'messaging'
  | 'support'
  | 'adminLogin'
  | 'restrictedNames'
  | 'agency'
  | 'platformReward'
  | 'payroll'

const PAYOUT_RAIL_KEYS = ['epay', 'bank'] as const

const TABS: { value: SettingsTab; label: string; short: string }[] = [
  { value: 'host', label: 'Host shares', short: 'Host' },
  { value: 'callPrice', label: 'Call Price', short: 'Call' },
  { value: 'personal', label: 'Personal', short: 'Personal' },
  { value: 'elite', label: 'Elite tier', short: 'Elite' },
  { value: 'trading', label: 'Trading', short: 'Trading' },
  { value: 'commission', label: 'Commission', short: 'Comm' },
  { value: 'messaging', label: 'Messaging', short: 'Msg' },
  { value: 'support', label: 'Support tickets', short: 'Support' },
  { value: 'adminLogin', label: 'Admin login', short: 'Login' },
  { value: 'restrictedNames', label: 'Restricted names', short: 'Names' },
  { value: 'agency', label: 'Agency', short: 'Agency' },
  { value: 'platformReward', label: 'Platform rewards', short: 'Rewards' },
  { value: 'payroll', label: 'Payroll / FX', short: 'Payroll' },
]

const MAX_WINDOW_MINUTES = 365 * 24 * 60
const MAX_MESSAGING_WINDOW_SECONDS = 7 * 24 * 60 * 60
const MAX_ADMIN_LOCKOUT_SECONDS = 30 * 24 * 60 * 60
const MAX_AGENCY_REJOIN_SECONDS = 365 * 24 * 60 * 60
const AGENCY_REJOIN_UNITS: AgencyHostCooldownUnit[] = ['hours', 'days']
const NEAR_MAX_MESSAGING_SECONDS = 6 * 24 * 60 * 60
const MESSAGING_UNITS: MessagingActionUnit[] = ['seconds', 'minutes', 'hours']
const ADMIN_LOCK_UNITS: AdminAuthLockoutUnit[] = ['minutes', 'hours']

const activeTab = ref<SettingsTab>('host')
const loading = ref(false)
const loadError = ref('')

const savingHost = ref(false)
const savingCallPrice = ref(false)
const savingPersonalExchange = ref(false)
const savingCoinPackages = ref(false)
const savingWalletLevels = ref(false)
const savingRichTier = ref(false)
const savingTradingTopup = ref(false)
const savingAgentExchange = ref(false)
const savingTradingPackages = ref(false)
const savingCommissionLevels = ref(false)
const savingCommissionWindow = ref(false)
const savingPayroll = ref(false)
const savingPayoutRails = ref(false)
const savingMessaging = ref(false)
const savingSupport = ref(false)
const savingAdminAuth = ref(false)
const savingRestrictedWords = ref(false)
const savingAgencyHost = ref(false)
const savingLivestreamReward = ref(false)

const hostError = ref('')
const callPriceError = ref('')
const personalExchangeError = ref('')
const coinPackagesError = ref('')
const walletLevelsError = ref('')
const richTierError = ref('')
const tradingTopupError = ref('')
const agentExchangeError = ref('')
const tradingPackagesError = ref('')
const commissionLevelsError = ref('')
const commissionWindowError = ref('')
const payrollError = ref('')
const payoutRailsError = ref('')
const messagingError = ref('')
const supportError = ref('')
const adminAuthError = ref('')
const restrictedWordsError = ref('')
const agencyHostError = ref('')
const livestreamRewardError = ref('')

const hostSaved = ref<HostRevenueShares | null>(null)
const hostForm = reactive({
  giftReceivePercent: 60,
  subscriptionPercent: 75,
  guardianPurchasePercent: 75,
  videoCallHostSharePercent: 60,
})

const personalExchangeTiers = ref<RateTierDraft[]>([])
const coinPackageDrafts = ref<CoinPackageDraft[]>([])
const restrictedWordDrafts = ref<string[]>([''])
const wealthDrafts = ref<LevelThresholdDraft[]>([])
const livestreamDrafts = ref<LevelThresholdDraft[]>([])
const richTierDrafts = ref<RichTierConfig[]>([])

const tradingTopupTiers = ref<RateTierDraft[]>([])
const agentExchangeTiers = ref<RateTierDraft[]>([])
const tradingPackageDrafts = ref<TradingPackageDraft[]>([])

const commissionLevelDrafts = ref<CommissionLevelDraft[]>([])
const commissionWindowSaved = ref<CommissionWindowSnapshot | null>(null)
const commissionWindowForm = reactive({
  windowDays: 30,
  windowHours: 0,
  windowMinutes: 0,
})

const payrollSaved = ref<PayrollConfigSnapshot | null>(null)
const payrollForm = reactive({
  serviceFeeUsd: 0,
  minWithdrawalUsd: 0,
  maxWithdrawalUsd: 0,
  slaHours: 0,
  waitingHours: 0,
  maxAssignmentAttempts: 0,
  inrPerUsd: 0,
  nprPerUsd: 0,
})
const payrollFeeTiers = ref<PayrollFeeTierDraft[]>([])
const payrollCountryRates = ref<PayrollCountryFxDraft[]>([])

const payoutRailsSaved = ref<PayoutRailsConfig | null>(null)
const payoutRailsForm = reactive({
  epay: { enabled: true, feePercent: 6, arrivalTime: 'Within 24 hours' } as PayoutRailDraft,
  bank: { enabled: true, feePercent: 6, arrivalTime: '3-5 business days' } as PayoutRailDraft,
})

const messagingSaved = ref<MessagingConfigDto | null>(null)
const messagingForm = reactive({
  amount: 1 as number | null,
  unit: 'hours' as MessagingActionUnit,
})

const supportSaved = ref<SupportReviewWindowConfigDto | null>(null)
const supportForm = reactive({
  amount: 24 as number | null,
  unit: 'hours' as MessagingActionUnit,
})

const adminAuthSaved = ref<AdminAuthConfigDto | null>(null)
const adminAuthForm = reactive({
  failedLoginThreshold: 5 as number | null,
  amount: 24 as number | null,
  unit: 'hours' as AdminAuthLockoutUnit,
})

const agencyHostSaved = ref<AgencyHostConfigDto | null>(null)
const agencyHostForm = reactive({
  amount: 1 as number | null,
  unit: 'days' as AgencyHostCooldownUnit,
})

const livestreamRewardSaved = ref<LivestreamRewardConfigDto | null>(null)
const livestreamRewardForm = reactive({
  windowDays: 7 as number | null,
  pointsPerHour: 2500 as number | null,
})

const callPriceBands = ref<CallPriceBandDraft[]>([])

const windowTotalMinutes = computed(
  () =>
    commissionWindowForm.windowDays * 24 * 60 +
    commissionWindowForm.windowHours * 60 +
    commissionWindowForm.windowMinutes,
)

const messagingPreviewSeconds = computed(() => {
  const amount = messagingForm.amount
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 0
  const n = Math.trunc(amount)
  if (messagingForm.unit === 'hours') return n * 3600
  if (messagingForm.unit === 'minutes') return n * 60
  return n
})

const messagingNearMax = computed(
  () =>
    messagingPreviewSeconds.value >= NEAR_MAX_MESSAGING_SECONDS &&
    messagingPreviewSeconds.value <= MAX_MESSAGING_WINDOW_SECONDS,
)

const supportPreviewSeconds = computed(() => {
  const amount = supportForm.amount
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 0
  const n = Math.trunc(amount)
  if (supportForm.unit === 'hours') return n * 3600
  if (supportForm.unit === 'minutes') return n * 60
  return n
})

const supportNearMax = computed(
  () =>
    supportPreviewSeconds.value >= NEAR_MAX_MESSAGING_SECONDS &&
    supportPreviewSeconds.value <= MAX_MESSAGING_WINDOW_SECONDS,
)

const adminAuthPreviewSeconds = computed(() => {
  const amount = adminAuthForm.amount
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 0
  const n = Math.trunc(amount)
  if (adminAuthForm.unit === 'hours') return n * 3600
  return n * 60
})

const agencyHostPreviewSeconds = computed(() => {
  const amount = agencyHostForm.amount
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 0
  const n = Math.trunc(amount)
  return agencyHostForm.unit === 'days' ? n * 86400 : n * 3600
})

function bpToPercent(bp: number) {
  return bp / 100
}

function percentToBp(percent: number) {
  return Math.round(percent * 100)
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function formatDuration(minutes: number) {
  const d = Math.floor(minutes / (24 * 60))
  const h = Math.floor((minutes % (24 * 60)) / 60)
  const m = minutes % 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m || !parts.length) parts.push(`${m}m`)
  return parts.join(' ')
}

function formatDurationFromSeconds(totalSeconds: number) {
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (s || !parts.length) parts.push(`${s}s`)
  return parts.join(' ')
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  const body = err.response?.data as
    | { code?: string; message?: string; error?: string }
    | undefined
  if (body?.message) return body.message
  if (typeof body?.error === 'string' && body.error) return body.error
  if (body?.code === 'CONFIG_ERROR') return 'Config is missing on the server (migration not applied).'
  if (body?.code === 'ADMIN_VIEW_FORBIDDEN') return 'You do not have permission to manage this setting.'
  if (body?.code === 'INVALID_SHARE_BP' || body?.code === 'INVALID_RATE_BP') {
    return 'Basis points must be between 1 and 10000.'
  }
  if (body?.code === 'INVALID_FEE_CONFIG') return 'Invalid fee or payroll configuration value.'
  if (body?.code === 'INVALID_ACTION_WINDOW') {
    return body.message || 'Messaging window must be between 1 second and 7 days.'
  }
  if (body?.code === 'VALIDATION_ERROR') return body.message || 'Validation failed.'
  return fallback
}

function emptyTier(): RateTierDraft {
  return { minUsd: 0, maxUsd: null, coinsPerUsd: 9000 }
}

function toTierDrafts(tiers: RateTier[]): RateTierDraft[] {
  if (!tiers.length) return [emptyTier()]
  return tiers.map((t) => ({
    minUsd: t.minUsd,
    maxUsd: t.maxUsd,
    coinsPerUsd: t.coinsPerUsd,
  }))
}

function toCoinDrafts(packages: CoinPackage[]): CoinPackageDraft[] {
  if (!packages.length) {
    return [{ coins: 10000, priceUsd: 0.99, currency: 'USD', label: '' }]
  }
  return packages.map((p) => ({
    coins: p.coins,
    priceUsd: p.priceCents / 100,
    currency: p.currency || 'USD',
    label: p.label ?? '',
  }))
}

function toTradingDrafts(packages: TradingPackage[]): TradingPackageDraft[] {
  if (!packages.length) {
    return [{ tradingCoins: '94000', priceUsd: 10, coinsPerUsd: 9400, currency: 'USD', label: '' }]
  }
  return packages.map((p) => ({
    tradingCoins: p.tradingCoins,
    priceUsd: p.priceCents / 100,
    coinsPerUsd: p.coinsPerUsd,
    currency: p.currency || 'USD',
    label: p.label ?? '',
  }))
}

function toLevelDrafts(levels: LevelThreshold[]): LevelThresholdDraft[] {
  if (!levels.length) {
    return [{ level: 1, threshold: '0', label: 'L1', iconKey: '' }]
  }
  return levels.map((l) => ({
    level: l.level,
    threshold: l.threshold,
    label: l.label ?? '',
    iconKey: l.iconKey ?? '',
  }))
}

function applyRichTiers(tiers: RichTierConfig[]) {
  richTierDrafts.value = [...tiers]
    .sort((a, b) => a.tier - b.tier)
    .map((t) => ({
      tier: t.tier,
      minRechargeCoins: t.minRechargeCoins,
      displayName: t.displayName,
    }))
}

function toCommissionDrafts(levels: CommissionLevel[]): CommissionLevelDraft[] {
  if (!levels.length) {
    return [
      {
        level: 'D',
        minWindowPoints: '0',
        liveRatePercent: 5,
        matchChatRatePercent: 5,
        sortOrder: 1,
      },
    ]
  }
  return levels.map((l) => ({
    level: l.level,
    minWindowPoints: l.minWindowPoints,
    liveRatePercent: bpToPercent(l.liveRateBp),
    matchChatRatePercent: bpToPercent(l.matchChatRateBp),
    sortOrder: l.sortOrder,
  }))
}

function applyHost(shares: HostRevenueShares) {
  hostSaved.value = shares
  hostForm.giftReceivePercent = bpToPercent(shares.giftReceiveBp)
  hostForm.subscriptionPercent = bpToPercent(shares.subscriptionBp)
  hostForm.guardianPurchasePercent = bpToPercent(shares.guardianPurchaseBp)
  hostForm.videoCallHostSharePercent = bpToPercent(shares.videoCallHostShareBp)
}

function applyCommissionWindow(cfg: CommissionWindowSnapshot) {
  commissionWindowSaved.value = cfg
  commissionWindowForm.windowDays = cfg.windowDays
  commissionWindowForm.windowHours = cfg.windowHours
  commissionWindowForm.windowMinutes = cfg.windowMinutes
}

function defaultPayrollFeeTiers(): PayrollFeeTierDraft[] {
  return [
    { minUsd: 0, maxUsd: 20, platformFeeRatePercent: 5, agentRewardRatePercent: 60 },
    { minUsd: 20, maxUsd: 100, platformFeeRatePercent: 3, agentRewardRatePercent: 60 },
    { minUsd: 100, maxUsd: null, platformFeeRatePercent: 2, agentRewardRatePercent: 60 },
  ]
}

function defaultPayrollCountryRates(cfg?: PayrollConfigSnapshot | null): PayrollCountryFxDraft[] {
  if (cfg?.countryRates?.length) {
    return cfg.countryRates.map((row) => ({
      country: row.country,
      countryCode: row.countryCode ?? '',
      currencyCode: row.currencyCode,
      ratePerUsd: row.ratePerUsd,
    }))
  }
  return [
    {
      country: 'India',
      countryCode: 'IN',
      currencyCode: 'INR',
      ratePerUsd: cfg?.inrPerUsd && cfg.inrPerUsd > 0 ? cfg.inrPerUsd : 94,
    },
    {
      country: 'Nepal',
      countryCode: 'NP',
      currencyCode: 'NPR',
      ratePerUsd: cfg?.nprPerUsd && cfg.nprPerUsd > 0 ? cfg.nprPerUsd : 150,
    },
  ]
}

function applyPayroll(cfg: PayrollConfigSnapshot) {
  payrollSaved.value = cfg
  payrollForm.serviceFeeUsd = cfg.serviceFeeUsd
  payrollForm.minWithdrawalUsd = cfg.minWithdrawalUsd
  payrollForm.maxWithdrawalUsd = cfg.maxWithdrawalUsd
  payrollForm.slaHours = cfg.slaHours
  payrollForm.waitingHours = cfg.waitingHours
  payrollForm.maxAssignmentAttempts = cfg.maxAssignmentAttempts
  payrollForm.inrPerUsd = cfg.inrPerUsd
  payrollForm.nprPerUsd = cfg.nprPerUsd ?? 150
  payrollFeeTiers.value = cfg.feeTiers?.length
    ? cfg.feeTiers.map((t) => ({
        minUsd: t.minUsd,
        maxUsd: t.maxUsd,
        platformFeeRatePercent: bpToPercent(t.platformFeeRateBp),
        agentRewardRatePercent: bpToPercent(t.agentRewardRateBp),
      }))
    : defaultPayrollFeeTiers()
  payrollCountryRates.value = defaultPayrollCountryRates(cfg)
}

function addPayrollCountryRate() {
  payrollCountryRates.value.push({
    country: '',
    countryCode: '',
    currencyCode: '',
    ratePerUsd: null,
  })
}

function removePayrollCountryRate(index: number) {
  if (payrollCountryRates.value.length <= 1) return
  payrollCountryRates.value.splice(index, 1)
}

function addPayrollFeeTier() {
  const rows = payrollFeeTiers.value
  const last = rows[rows.length - 1]
  const minUsd = last?.maxUsd ?? (last?.minUsd != null ? last.minUsd + 1 : 0)
  if (last && last.maxUsd == null) last.maxUsd = minUsd
  rows.push({
    minUsd,
    maxUsd: null,
    platformFeeRatePercent: last?.platformFeeRatePercent ?? 2,
    agentRewardRatePercent: last?.agentRewardRatePercent ?? 60,
  })
}

function removePayrollFeeTier(index: number) {
  if (payrollFeeTiers.value.length <= 1) return
  payrollFeeTiers.value.splice(index, 1)
  const last = payrollFeeTiers.value[payrollFeeTiers.value.length - 1]
  if (last) last.maxUsd = null
}

function usdToPointsLabel(usd: number | null | undefined) {
  if (usd == null || !Number.isFinite(usd)) return ''
  const pts = Math.round(usd * 10_000)
  return `${pts.toLocaleString()} pts`
}

function applyPayoutRails(cfg: PayoutRailsConfig) {
  payoutRailsSaved.value = cfg
  payoutRailsForm.epay.enabled = cfg.epay.enabled
  payoutRailsForm.epay.feePercent = cfg.epay.feePercent
  payoutRailsForm.epay.arrivalTime = cfg.epay.arrivalTime
  payoutRailsForm.bank.enabled = cfg.bank.enabled
  payoutRailsForm.bank.feePercent = cfg.bank.feePercent
  payoutRailsForm.bank.arrivalTime = cfg.bank.arrivalTime
}

function applyMessaging(cfg: MessagingConfigDto) {
  messagingSaved.value = cfg
  messagingForm.amount = cfg.amount
  messagingForm.unit = cfg.unit
}

function applySupport(cfg: SupportReviewWindowConfigDto) {
  supportSaved.value = cfg
  supportForm.amount = cfg.amount
  supportForm.unit = cfg.unit
}

function applyAdminAuth(cfg: AdminAuthConfigDto) {
  adminAuthSaved.value = cfg
  adminAuthForm.failedLoginThreshold = cfg.failedLoginThreshold
  adminAuthForm.amount = cfg.amount
  adminAuthForm.unit = cfg.unit
}

function applyAgencyHost(cfg: AgencyHostConfigDto) {
  agencyHostSaved.value = cfg
  agencyHostForm.amount = cfg.amount
  agencyHostForm.unit = cfg.unit
}

function applyLivestreamReward(cfg: LivestreamRewardConfigDto) {
  livestreamRewardSaved.value = cfg
  livestreamRewardForm.windowDays = cfg.windowDays
  livestreamRewardForm.pointsPerHour = cfg.pointsPerHour
}

function defaultCallPriceBands(): CallPriceBandDraft[] {
  return [
    { minLevel: 1, maxLevel: 4, label: '≤Lv4', prices: [1800] },
    { minLevel: 5, maxLevel: 9, label: 'Lv5-9', prices: [2400] },
    {
      minLevel: 10,
      maxLevel: null,
      label: 'Lv10 & Above',
      prices: [3000, 3600, 4800, 6000, 7200],
    },
  ]
}

function groupCallPriceTiers(tiers: VideoCallPriceCapTier[]): CallPriceBandDraft[] {
  if (!tiers.length) return defaultCallPriceBands()
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder)
  const bands: CallPriceBandDraft[] = []
  const indexByKey = new Map<string, number>()
  for (const tier of sorted) {
    const key = `${tier.minLevel}|${tier.maxLevel ?? ''}|${tier.label ?? ''}`
    let idx = indexByKey.get(key)
    if (idx == null) {
      idx = bands.length
      indexByKey.set(key, idx)
      bands.push({
        minLevel: tier.minLevel,
        maxLevel: tier.maxLevel,
        label: tier.label ?? '',
        prices: [],
      })
    }
    bands[idx]!.prices.push(tier.price)
  }
  return bands
}

function applyCallPriceTiers(tiers: VideoCallPriceCapTier[]) {
  callPriceBands.value = groupCallPriceTiers(tiers)
}

function applyAggregate(data: Awaited<ReturnType<typeof systemSettingsApi.getRatesAggregate>>['data']) {
  applyHost(data.hostRevenueShares)
  personalExchangeTiers.value = toTierDrafts(data.personalExchangeRates.tiers)
  coinPackageDrafts.value = toCoinDrafts(data.coinPackages.packages)
  wealthDrafts.value = toLevelDrafts(data.walletLevelConfigs.wealth)
  livestreamDrafts.value = toLevelDrafts(data.walletLevelConfigs.livestream)
  if (data.richTierConfigs?.tiers) {
    applyRichTiers(data.richTierConfigs.tiers)
  }
  tradingTopupTiers.value = toTierDrafts(data.tradingTopupRates.tiers)
  agentExchangeTiers.value = toTierDrafts(data.agentExchangeRates.tiers)
  tradingPackageDrafts.value = toTradingDrafts(data.tradingTopupPackages.packages)
  commissionLevelDrafts.value = toCommissionDrafts(data.commissionLevels.levels)
  applyCommissionWindow(data.commissionWindow)
  applyPayroll(data.payroll)
  if (data.agencyHost) {
    applyAgencyHost(data.agencyHost)
  }
  if (data.livestreamReward) {
    applyLivestreamReward(data.livestreamReward)
  }
  if (data.videoCallPriceCaps) {
    applyCallPriceTiers(data.videoCallPriceCaps.tiers)
  }
}

async function loadAll() {
  loading.value = true
  loadError.value = ''
  payoutRailsError.value = ''
  messagingError.value = ''
  supportError.value = ''
  adminAuthError.value = ''
  agencyHostError.value = ''
  livestreamRewardError.value = ''
  richTierError.value = ''
  try {
    const { data } = await systemSettingsApi.getRatesAggregate()
    applyAggregate(data)
    if (!data.videoCallPriceCaps) {
      try {
        const caps = await systemSettingsApi.getVideoCallPriceCaps()
        applyCallPriceTiers(caps.data.tiers)
      } catch {
        applyCallPriceTiers([])
      }
    }
    try {
      const rails = await systemSettingsApi.getPayoutRailsConfig()
      applyPayoutRails(rails.data)
    } catch (err) {
      payoutRailsError.value = apiErrorMessage(err, 'Failed to load payout rails.')
    }
    try {
      const messaging = await systemSettingsApi.getMessagingConfig()
      applyMessaging(messaging.data)
    } catch (err) {
      messagingError.value = apiErrorMessage(err, 'Failed to load messaging config.')
    }
    try {
      const support = await systemSettingsApi.getSupportReviewWindowConfig()
      applySupport(support.data)
    } catch (err) {
      supportError.value = apiErrorMessage(err, 'Failed to load support review window.')
    }
    try {
      const adminAuth = await systemSettingsApi.getAdminAuthConfig()
      applyAdminAuth(adminAuth.data)
    } catch (err) {
      adminAuthError.value = apiErrorMessage(err, 'Failed to load admin login lock settings.')
    }
    try {
      const restricted = await systemSettingsApi.getRestrictedIdentityWords()
      applyRestrictedWords(restricted.data)
    } catch (err) {
      restrictedWordsError.value = apiErrorMessage(err, 'Failed to load restricted name words.')
    }
    try {
      const agencyHost = await systemSettingsApi.getAgencyHostConfig()
      applyAgencyHost(agencyHost.data)
    } catch (err) {
      agencyHostError.value = apiErrorMessage(err, 'Failed to load agency rejoin cooldown.')
    }
    try {
      const livestreamReward = await systemSettingsApi.getLivestreamRewardConfig()
      applyLivestreamReward(livestreamReward.data)
    } catch (err) {
      livestreamRewardError.value = apiErrorMessage(err, 'Failed to load platform reward settings.')
    }
    if (!richTierDrafts.value.length) {
      try {
        const rich = await systemSettingsApi.getRichTierConfig()
        applyRichTiers(rich.data.tiers)
      } catch (err) {
        richTierError.value = apiErrorMessage(err, 'Failed to load elite tier thresholds.')
      }
    }
  } catch (err) {
    loadError.value = apiErrorMessage(err, 'Failed to load system rates.')
  } finally {
    loading.value = false
  }
}

function validateBpPercent(label: string, percent: number): string | null {
  if (!Number.isFinite(percent)) return `${label} must be a number.`
  const bp = percentToBp(percent)
  if (!Number.isInteger(bp) || bp < 1 || bp > 10000) {
    return `${label} must be between 0.01% and 100%.`
  }
  return null
}

function parseOptionalMaxUsd(value: unknown): number | null | 'invalid' {
  if (value === '' || value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 'invalid'
  return n
}

function validateTierRows(rows: RateTierDraft[], label: string): string | null {
  if (!rows.length) return `${label}: add at least one tier.`
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const n = i + 1
    if (row.minUsd == null || !Number.isFinite(row.minUsd) || row.minUsd < 0) {
      return `${label} row ${n}: min USD must be ≥ 0.`
    }
    const maxUsd = parseOptionalMaxUsd(row.maxUsd)
    if (maxUsd === 'invalid') {
      return `${label} row ${n}: max USD must be a number (or empty for open-ended).`
    }
    if (maxUsd != null && maxUsd <= row.minUsd) {
      return `${label} row ${n}: max USD must be greater than min USD (or empty for open-ended).`
    }
    if (
      row.coinsPerUsd == null ||
      !Number.isInteger(row.coinsPerUsd) ||
      row.coinsPerUsd <= 0
    ) {
      return `${label} row ${n}: coins per USD must be a positive integer.`
    }
  }
  const sorted = [...rows].sort((a, b) => (a.minUsd ?? 0) - (b.minUsd ?? 0))
  for (let i = 0; i < sorted.length; i++) {
    if ((sorted[i]!.minUsd ?? 0) !== (rows[i]!.minUsd ?? 0)) {
      return `${label}: keep tiers sorted by min USD ascending.`
    }
  }
  const openEnded = rows.filter((r) => parseOptionalMaxUsd(r.maxUsd) == null)
  if (openEnded.length !== 1) {
    return `${label}: exactly one tier should have an empty (open-ended) max USD.`
  }
  if (parseOptionalMaxUsd(rows[rows.length - 1]!.maxUsd) != null) {
    return `${label}: the last tier should be open-ended (empty max USD).`
  }
  return null
}

function buildTierBody(rows: RateTierDraft[]) {
  return {
    tiers: rows.map((r) => ({
      minUsd: r.minUsd!,
      maxUsd: parseOptionalMaxUsd(r.maxUsd) as number | null,
      coinsPerUsd: r.coinsPerUsd!,
    })),
  }
}

function addTier(rows: RateTierDraft[]) {
  const last = rows[rows.length - 1]
  const minUsd = last?.maxUsd ?? (last?.minUsd != null ? last.minUsd + 1 : 0)
  if (last && last.maxUsd == null) last.maxUsd = minUsd
  rows.push({ minUsd, maxUsd: null, coinsPerUsd: last?.coinsPerUsd ?? 9000 })
}

function removeTier(rows: RateTierDraft[], index: number) {
  if (rows.length <= 1) return
  rows.splice(index, 1)
  const last = rows[rows.length - 1]
  if (last) last.maxUsd = null
}

async function saveHostShares() {
  hostError.value = ''
  for (const [label, value] of [
    ['Gift share', hostForm.giftReceivePercent],
    ['Subscription share', hostForm.subscriptionPercent],
    ['Guardian share', hostForm.guardianPurchasePercent],
    ['Video call share', hostForm.videoCallHostSharePercent],
  ] as const) {
    const err = validateBpPercent(label, value)
    if (err) {
      hostError.value = err
      return
    }
  }
  savingHost.value = true
  try {
    const { data } = await systemSettingsApi.updateHostRevenueShares({
      giftReceiveBp: percentToBp(hostForm.giftReceivePercent),
      subscriptionBp: percentToBp(hostForm.subscriptionPercent),
      guardianPurchaseBp: percentToBp(hostForm.guardianPurchasePercent),
      videoCallHostShareBp: percentToBp(hostForm.videoCallHostSharePercent),
    })
    applyHost(data)
    showToast('Host revenue shares saved.', 'success')
  } catch (err) {
    hostError.value = apiErrorMessage(err, 'Failed to save host revenue shares.')
    showToast(hostError.value, 'error')
  } finally {
    savingHost.value = false
  }
}

function parseOptionalMaxLevel(value: unknown): number | null | 'invalid' {
  if (value === '' || value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return 'invalid'
  return n
}

function validateCallPriceBands(bands: CallPriceBandDraft[]): string | null {
  if (!bands.length) return 'Add at least one level band.'
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i]!
    const n = i + 1
    if (band.minLevel == null || !Number.isInteger(band.minLevel) || band.minLevel < 1) {
      return `Band ${n}: min level must be an integer ≥ 1.`
    }
    const maxLevel = parseOptionalMaxLevel(band.maxLevel)
    if (maxLevel === 'invalid') {
      return `Band ${n}: max level must be an integer (or empty for open-ended).`
    }
    if (maxLevel != null && maxLevel < band.minLevel) {
      return `Band ${n}: max level must be ≥ min level (or empty for open-ended).`
    }
    if (band.label.length > 64) {
      return `Band ${n}: label must be at most 64 characters.`
    }
    if (!band.prices.length) {
      return `Band ${n}: add at least one price.`
    }
    const seen = new Set<number>()
    for (let j = 0; j < band.prices.length; j++) {
      const price = band.prices[j]
      if (price == null || !Number.isInteger(price) || price <= 0) {
        return `Band ${n} price ${j + 1}: must be a positive integer.`
      }
      if (seen.has(price)) {
        return `Band ${n}: prices must be unique within a band (${price} duplicated).`
      }
      seen.add(price)
    }
  }
  return null
}

function flattenCallPriceBands(bands: CallPriceBandDraft[]) {
  return bands.flatMap((band) =>
    band.prices.map((price) => ({
      minLevel: band.minLevel!,
      maxLevel: parseOptionalMaxLevel(band.maxLevel) as number | null,
      price: price!,
      label: band.label.trim() || null,
    })),
  )
}

function addCallPriceBand() {
  const last = callPriceBands.value[callPriceBands.value.length - 1]
  const minLevel =
    last?.maxLevel != null
      ? last.maxLevel + 1
      : last?.minLevel != null
        ? last.minLevel + 1
        : 1
  if (last && last.maxLevel == null) {
    last.maxLevel = minLevel - 1 >= last.minLevel! ? minLevel - 1 : last.minLevel
  }
  callPriceBands.value.push({
    minLevel,
    maxLevel: null,
    label: '',
    prices: [3000],
  })
}

function removeCallPriceBand(index: number) {
  if (callPriceBands.value.length <= 1) return
  callPriceBands.value.splice(index, 1)
}

function addCallPrice(band: CallPriceBandDraft) {
  const last = band.prices[band.prices.length - 1]
  band.prices.push(typeof last === 'number' ? last + 600 : 1800)
}

function removeCallPrice(band: CallPriceBandDraft, priceIndex: number) {
  if (band.prices.length <= 1) return
  band.prices.splice(priceIndex, 1)
}

async function saveCallPrice() {
  callPriceError.value = ''
  const err = validateCallPriceBands(callPriceBands.value)
  if (err) {
    callPriceError.value = err
    return
  }
  savingCallPrice.value = true
  try {
    const { data } = await systemSettingsApi.updateVideoCallPriceCaps({
      tiers: flattenCallPriceBands(callPriceBands.value),
    })
    applyCallPriceTiers(data.tiers)
    showToast('Call Price updated.', 'success')
  } catch (e) {
    callPriceError.value = apiErrorMessage(e, 'Failed to save call price caps.')
    showToast(callPriceError.value, 'error')
  } finally {
    savingCallPrice.value = false
  }
}

async function savePersonalExchange() {
  personalExchangeError.value = ''
  const err = validateTierRows(personalExchangeTiers.value, 'Personal exchange')
  if (err) {
    personalExchangeError.value = err
    return
  }
  savingPersonalExchange.value = true
  try {
    const { data } = await systemSettingsApi.updatePersonalExchangeRates(
      buildTierBody(personalExchangeTiers.value),
    )
    personalExchangeTiers.value = toTierDrafts(data.tiers)
    showToast('Personal exchange rates saved.', 'success')
  } catch (e) {
    personalExchangeError.value = apiErrorMessage(e, 'Failed to save personal exchange rates.')
    showToast(personalExchangeError.value, 'error')
  } finally {
    savingPersonalExchange.value = false
  }
}

async function saveCoinPackages() {
  coinPackagesError.value = ''
  const rows = coinPackageDrafts.value
  if (!rows.length) {
    coinPackagesError.value = 'Add at least one coin package.'
    return
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const n = i + 1
    if (row.coins == null || !Number.isInteger(row.coins) || row.coins <= 0) {
      coinPackagesError.value = `Package ${n}: coins must be a positive integer.`
      return
    }
    if (row.priceUsd == null || !Number.isFinite(row.priceUsd) || row.priceUsd <= 0) {
      coinPackagesError.value = `Package ${n}: price must be greater than 0.`
      return
    }
    if (!row.currency.trim()) {
      coinPackagesError.value = `Package ${n}: currency is required.`
      return
    }
  }
  savingCoinPackages.value = true
  try {
    const { data } = await systemSettingsApi.updateCoinPackages({
      packages: rows.map((r) => ({
        coins: r.coins!,
        priceCents: Math.round(r.priceUsd! * 100),
        currency: r.currency.trim().toUpperCase(),
        label: r.label.trim() || null,
      })),
    })
    coinPackageDrafts.value = toCoinDrafts(data.packages)
    showToast('Coin packages saved.', 'success')
  } catch (e) {
    coinPackagesError.value = apiErrorMessage(e, 'Failed to save coin packages.')
    showToast(coinPackagesError.value, 'error')
  } finally {
    savingCoinPackages.value = false
  }
}

function validateLevelRows(rows: LevelThresholdDraft[], label: string): string | null {
  if (!rows.length) return `${label}: add at least one level.`
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const n = i + 1
    if (row.level == null || !Number.isInteger(row.level) || row.level < 1) {
      return `${label} row ${n}: level must be a positive integer.`
    }
    if (!/^\d+$/.test(row.threshold.trim())) {
      return `${label} row ${n}: threshold must be a non-negative integer string.`
    }
  }
  return null
}

async function saveWalletLevels() {
  walletLevelsError.value = ''
  const wealthErr = validateLevelRows(wealthDrafts.value, 'Wealth')
  if (wealthErr) {
    walletLevelsError.value = wealthErr
    return
  }
  const liveErr = validateLevelRows(livestreamDrafts.value, 'Livestream')
  if (liveErr) {
    walletLevelsError.value = liveErr
    return
  }
  savingWalletLevels.value = true
  try {
    const mapLevel = (r: LevelThresholdDraft) => ({
      level: r.level!,
      threshold: r.threshold.trim(),
      label: r.label.trim() || null,
      iconKey: r.iconKey.trim() || null,
    })
    const { data } = await systemSettingsApi.updateWalletLevelConfigs({
      wealth: wealthDrafts.value.map(mapLevel),
      livestream: livestreamDrafts.value.map(mapLevel),
    })
    wealthDrafts.value = toLevelDrafts(data.wealth)
    livestreamDrafts.value = toLevelDrafts(data.livestream)
    showToast('Wallet level thresholds saved.', 'success')
  } catch (e) {
    walletLevelsError.value = apiErrorMessage(e, 'Failed to save wallet level configs.')
    showToast(walletLevelsError.value, 'error')
  } finally {
    savingWalletLevels.value = false
  }
}

async function saveRichTier() {
  richTierError.value = ''
  if (richTierDrafts.value.length !== 10) {
    richTierError.value = 'Exactly 10 elite tiers (RICH I–X) are required.'
    return
  }
  for (let i = 0; i < richTierDrafts.value.length; i++) {
    const row = richTierDrafts.value[i]!
    const n = i + 1
    if (row.tier !== n) {
      richTierError.value = `Row ${n}: tier must be ${n}.`
      return
    }
    if (!/^\d+$/.test(row.minRechargeCoins.trim()) || BigInt(row.minRechargeCoins.trim()) <= 0n) {
      richTierError.value = `Row ${n}: coins recharged must be a positive integer.`
      return
    }
    if (!row.displayName.trim()) {
      richTierError.value = `Row ${n}: elite level name is required.`
      return
    }
    if (i > 0 && BigInt(row.minRechargeCoins.trim()) <= BigInt(richTierDrafts.value[i - 1]!.minRechargeCoins.trim())) {
      richTierError.value = `Row ${n}: coins recharged must be greater than the previous tier.`
      return
    }
  }
  savingRichTier.value = true
  try {
    const { data } = await systemSettingsApi.updateRichTierConfig({
      tiers: richTierDrafts.value.map((r) => ({
        tier: r.tier,
        minRechargeCoins: r.minRechargeCoins.trim(),
        displayName: r.displayName.trim(),
      })),
    })
    applyRichTiers(data.tiers)
    showToast('Elite tier thresholds saved.', 'success')
  } catch (e) {
    richTierError.value = apiErrorMessage(e, 'Failed to save elite tier thresholds.')
    showToast(richTierError.value, 'error')
  } finally {
    savingRichTier.value = false
  }
}

async function saveTradingTopupRates() {
  tradingTopupError.value = ''
  const err = validateTierRows(tradingTopupTiers.value, 'Trading topup rates')
  if (err) {
    tradingTopupError.value = err
    return
  }
  savingTradingTopup.value = true
  try {
    const { data } = await systemSettingsApi.updateTradingTopupRates(
      buildTierBody(tradingTopupTiers.value),
    )
    tradingTopupTiers.value = toTierDrafts(data.tiers)
    showToast('Trading topup rates saved.', 'success')
  } catch (e) {
    tradingTopupError.value = apiErrorMessage(e, 'Failed to save trading topup rates.')
    showToast(tradingTopupError.value, 'error')
  } finally {
    savingTradingTopup.value = false
  }
}

async function saveAgentExchange() {
  agentExchangeError.value = ''
  const err = validateTierRows(agentExchangeTiers.value, 'Agent exchange')
  if (err) {
    agentExchangeError.value = err
    return
  }
  savingAgentExchange.value = true
  try {
    const { data } = await systemSettingsApi.updateAgentExchangeRates(
      buildTierBody(agentExchangeTiers.value),
    )
    agentExchangeTiers.value = toTierDrafts(data.tiers)
    showToast('Agent exchange rates saved.', 'success')
  } catch (e) {
    agentExchangeError.value = apiErrorMessage(e, 'Failed to save agent exchange rates.')
    showToast(agentExchangeError.value, 'error')
  } finally {
    savingAgentExchange.value = false
  }
}

async function saveTradingPackages() {
  tradingPackagesError.value = ''
  const rows = tradingPackageDrafts.value
  if (!rows.length) {
    tradingPackagesError.value = 'Add at least one trading package.'
    return
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const n = i + 1
    if (!/^\d+$/.test(row.tradingCoins.trim()) || row.tradingCoins.trim() === '0') {
      tradingPackagesError.value = `Package ${n}: trading coins must be a positive integer string.`
      return
    }
    if (row.priceUsd == null || !Number.isFinite(row.priceUsd) || row.priceUsd <= 0) {
      tradingPackagesError.value = `Package ${n}: price must be greater than 0.`
      return
    }
    if (row.coinsPerUsd == null || !Number.isInteger(row.coinsPerUsd) || row.coinsPerUsd <= 0) {
      tradingPackagesError.value = `Package ${n}: coins per USD must be a positive integer.`
      return
    }
    if (!row.currency.trim()) {
      tradingPackagesError.value = `Package ${n}: currency is required.`
      return
    }
  }
  savingTradingPackages.value = true
  try {
    const { data } = await systemSettingsApi.updateTradingTopupPackages({
      packages: rows.map((r) => ({
        tradingCoins: r.tradingCoins.trim(),
        priceCents: Math.round(r.priceUsd! * 100),
        coinsPerUsd: r.coinsPerUsd!,
        currency: r.currency.trim().toUpperCase(),
        label: r.label.trim() || null,
      })),
    })
    tradingPackageDrafts.value = toTradingDrafts(data.packages)
    showToast('Trading topup packages saved.', 'success')
  } catch (e) {
    tradingPackagesError.value = apiErrorMessage(e, 'Failed to save trading packages.')
    showToast(tradingPackagesError.value, 'error')
  } finally {
    savingTradingPackages.value = false
  }
}

async function saveCommissionLevels() {
  commissionLevelsError.value = ''
  const rows = commissionLevelDrafts.value
  if (!rows.length) {
    commissionLevelsError.value = 'Add at least one commission level.'
    return
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const n = i + 1
    if (!row.level.trim()) {
      commissionLevelsError.value = `Level ${n}: letter/code is required.`
      return
    }
    if (!/^\d+$/.test(row.minWindowPoints.trim())) {
      commissionLevelsError.value = `Level ${n}: min window points must be a non-negative integer string.`
      return
    }
    if (row.liveRatePercent == null) {
      commissionLevelsError.value = `Level ${n}: live rate is required.`
      return
    }
    const liveErr = validateBpPercent(`Level ${n} live rate`, row.liveRatePercent)
    if (liveErr) {
      commissionLevelsError.value = liveErr
      return
    }
    if (row.matchChatRatePercent == null) {
      commissionLevelsError.value = `Level ${n}: match/chat rate is required.`
      return
    }
    const matchErr = validateBpPercent(`Level ${n} match/chat rate`, row.matchChatRatePercent)
    if (matchErr) {
      commissionLevelsError.value = matchErr
      return
    }
    if (row.sortOrder == null || !Number.isInteger(row.sortOrder) || row.sortOrder < 1) {
      commissionLevelsError.value = `Level ${n}: sort order must be a positive integer.`
      return
    }
  }
  savingCommissionLevels.value = true
  try {
    const { data } = await systemSettingsApi.updateCommissionLevels({
      levels: rows.map((r) => ({
        level: r.level.trim(),
        minWindowPoints: r.minWindowPoints.trim(),
        liveRateBp: percentToBp(r.liveRatePercent!),
        matchChatRateBp: percentToBp(r.matchChatRatePercent!),
        sortOrder: r.sortOrder!,
      })),
    })
    commissionLevelDrafts.value = toCommissionDrafts(data.levels)
    if (data.recomputeEnqueued) {
      showToast('Commission levels saved. Tier recompute queued.', 'success')
    } else {
      showToast('Commission levels saved.', 'success')
    }
  } catch (e) {
    commissionLevelsError.value = apiErrorMessage(e, 'Failed to save commission levels.')
    showToast(commissionLevelsError.value, 'error')
  } finally {
    savingCommissionLevels.value = false
  }
}

function validateCommissionWindow(): string | null {
  const days = Math.trunc(Number(commissionWindowForm.windowDays))
  const hours = Math.trunc(Number(commissionWindowForm.windowHours))
  const minutes = Math.trunc(Number(commissionWindowForm.windowMinutes))
  if (!Number.isFinite(days) || !Number.isInteger(days) || days < 0 || days > 365) {
    return 'Days must be an integer from 0 to 365.'
  }
  if (!Number.isFinite(hours) || !Number.isInteger(hours) || hours < 0 || hours > 23) {
    return 'Hours must be an integer from 0 to 23.'
  }
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return 'Minutes must be an integer from 0 to 59.'
  }
  const total = days * 24 * 60 + hours * 60 + minutes
  if (total < 1) return 'Window must be at least 1 minute.'
  if (total > MAX_WINDOW_MINUTES) return 'Window cannot exceed 365 days.'
  return null
}

function commissionWindowPayload() {
  return {
    windowDays: Math.trunc(Number(commissionWindowForm.windowDays)),
    windowHours: Math.trunc(Number(commissionWindowForm.windowHours)),
    windowMinutes: Math.trunc(Number(commissionWindowForm.windowMinutes)),
  }
}

async function saveCommissionWindow() {
  // Flush any focused inline editor before reading the form (mousedown can beat blur).
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  commissionWindowError.value = ''
  const validationError = validateCommissionWindow()
  if (validationError) {
    commissionWindowError.value = validationError
    return
  }
  savingCommissionWindow.value = true
  try {
    const payload = commissionWindowPayload()
    commissionWindowForm.windowDays = payload.windowDays
    commissionWindowForm.windowHours = payload.windowHours
    commissionWindowForm.windowMinutes = payload.windowMinutes
    const { data } = await systemSettingsApi.updateCommissionWindow(payload)
    applyCommissionWindow(data)
    if (data.recomputeEnqueued) {
      showToast('Saved. Global agency tier recompute queued.', 'success')
    } else {
      showToast('Commission window saved.', 'success')
    }
  } catch (e) {
    commissionWindowError.value = apiErrorMessage(e, 'Failed to save commission window.')
    showToast(commissionWindowError.value, 'error')
  } finally {
    savingCommissionWindow.value = false
  }
}

function validatePercent0to100(label: string, percent: number): string | null {
  if (!Number.isFinite(percent)) return `${label} must be a number.`
  const bp = percentToBp(percent)
  if (bp < 0 || bp > 10000) return `${label} must be between 0% and 100%.`
  return null
}

async function savePayroll() {
  payrollError.value = ''
  if (!payrollFeeTiers.value.length) {
    payrollError.value = 'At least one withdrawal fee band is required.'
    return
  }
  for (let i = 0; i < payrollFeeTiers.value.length; i++) {
    const row = payrollFeeTiers.value[i]!
    const n = i + 1
    if (row.minUsd == null || !Number.isFinite(row.minUsd) || row.minUsd < 0) {
      payrollError.value = `Band ${n}: min USD is required.`
      return
    }
    if (i < payrollFeeTiers.value.length - 1) {
      if (row.maxUsd == null || !Number.isFinite(row.maxUsd) || row.maxUsd <= row.minUsd) {
        payrollError.value = `Band ${n}: max USD must be greater than min.`
        return
      }
    }
    const platformErr = validatePercent0to100(
      `Band ${n} platform fee`,
      row.platformFeeRatePercent ?? Number.NaN,
    )
    if (platformErr) {
      payrollError.value = platformErr
      return
    }
    const agentErr = validatePercent0to100(
      `Band ${n} agent reward`,
      row.agentRewardRatePercent ?? Number.NaN,
    )
    if (agentErr) {
      payrollError.value = agentErr
      return
    }
  }
  if (!payrollCountryRates.value.length) {
    payrollError.value = 'At least one country FX rate is required.'
    return
  }
  for (let i = 0; i < payrollCountryRates.value.length; i++) {
    const row = payrollCountryRates.value[i]!
    const n = i + 1
    if (!row.country.trim()) {
      payrollError.value = `Country ${n}: name is required.`
      return
    }
    if (!row.currencyCode.trim() || !/^[A-Za-z]{3,8}$/.test(row.currencyCode.trim())) {
      payrollError.value = `Country ${n}: currency code must be 3–8 letters.`
      return
    }
    if (row.countryCode.trim() && !/^[A-Za-z]{2,3}$/.test(row.countryCode.trim())) {
      payrollError.value = `Country ${n}: country code must be 2–3 letters.`
      return
    }
    if (row.ratePerUsd == null || !Number.isFinite(row.ratePerUsd) || row.ratePerUsd <= 0) {
      payrollError.value = `Country ${n}: rate per USD must be a positive number.`
      return
    }
  }
  for (const [label, value] of [
    ['Service fee USD', payrollForm.serviceFeeUsd],
    ['Min withdrawal USD', payrollForm.minWithdrawalUsd],
    ['Max withdrawal USD', payrollForm.maxWithdrawalUsd],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      payrollError.value = `${label} must be a non-negative number.`
      return
    }
  }
  for (const [label, value] of [
    ['SLA hours', payrollForm.slaHours],
    ['Waiting hours', payrollForm.waitingHours],
    ['Max assignment attempts', payrollForm.maxAssignmentAttempts],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      payrollError.value = `${label} must be a non-negative integer.`
      return
    }
  }
  if (payrollForm.maxWithdrawalUsd < payrollForm.minWithdrawalUsd) {
    payrollError.value = 'Max withdrawal must be ≥ min withdrawal.'
    return
  }

  savingPayroll.value = true
  try {
    const { data } = await systemSettingsApi.updatePayrollConfig({
      feeTiers: payrollFeeTiers.value.map((row, i) => ({
        minUsd: row.minUsd!,
        maxUsd: i === payrollFeeTiers.value.length - 1 ? null : row.maxUsd,
        platformFeeRateBp: percentToBp(row.platformFeeRatePercent!),
        agentRewardRateBp: percentToBp(row.agentRewardRatePercent!),
      })),
      serviceFeeUsd: payrollForm.serviceFeeUsd,
      minWithdrawalUsd: payrollForm.minWithdrawalUsd,
      maxWithdrawalUsd: payrollForm.maxWithdrawalUsd,
      slaHours: payrollForm.slaHours,
      waitingHours: payrollForm.waitingHours,
      maxAssignmentAttempts: payrollForm.maxAssignmentAttempts,
      countryRates: payrollCountryRates.value.map((row) => ({
        country: row.country.trim(),
        countryCode: row.countryCode.trim() || null,
        currencyCode: row.currencyCode.trim().toUpperCase(),
        ratePerUsd: row.ratePerUsd!,
      })),
    })
    applyPayroll(data)
    showToast('Payroll / FX config saved.', 'success')
  } catch (e) {
    payrollError.value = apiErrorMessage(e, 'Failed to save payroll config.')
    showToast(payrollError.value, 'error')
  } finally {
    savingPayroll.value = false
  }
}

function validatePayoutRail(rail: PayoutRailDraft, label: string): string | null {
  const feeErr = validatePercent0to100(`${label} display fee`, rail.feePercent)
  if (feeErr) return feeErr
  if (!rail.arrivalTime.trim()) return `${label}: arrival copy is required.`
  return null
}

async function savePayoutRails() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  payoutRailsError.value = ''
  for (const [label, rail] of [
    ['EPAY', payoutRailsForm.epay],
    ['BANK', payoutRailsForm.bank],
  ] as const) {
    const err = validatePayoutRail(rail, label)
    if (err) {
      payoutRailsError.value = err
      return
    }
  }

  const bothOff = !payoutRailsForm.epay.enabled && !payoutRailsForm.bank.enabled
  const disablingEpay = Boolean(payoutRailsSaved.value?.epay.enabled && !payoutRailsForm.epay.enabled)
  const disablingBank = Boolean(payoutRailsSaved.value?.bank.enabled && !payoutRailsForm.bank.enabled)

  if (bothOff) {
    const ok = window.confirm(
      'Both EPAY and BANK will be disabled. Hosts cannot withdraw by any method until you re-enable at least one. Continue?',
    )
    if (!ok) return
  } else if (disablingEpay || disablingBank) {
    const names = [disablingEpay ? 'EPAY' : null, disablingBank ? 'BANK' : null]
      .filter(Boolean)
      .join(' and ')
    const ok = window.confirm(
      `${names} will be disabled. Hosts cannot bind or start new withdrawals with this method until re-enabled. Continue?`,
    )
    if (!ok) return
  }

  savingPayoutRails.value = true
  try {
    const toRailBody = (rail: PayoutRailDraft) => ({
      enabled: rail.enabled,
      feeRateBp: percentToBp(rail.feePercent),
      arrivalTime: rail.arrivalTime.trim(),
    })
    const { data } = await systemSettingsApi.updatePayoutRailsConfig({
      epay: toRailBody(payoutRailsForm.epay),
      bank: toRailBody(payoutRailsForm.bank),
    })
    applyPayoutRails(data)
    showToast('Payout methods saved.', 'success')
  } catch (e) {
    payoutRailsError.value = apiErrorMessage(e, 'Failed to save payout rails.')
    showToast(payoutRailsError.value, 'error')
  } finally {
    savingPayoutRails.value = false
  }
}

function validateMessagingForm(): string | null {
  const amount = messagingForm.amount
  if (amount == null || !Number.isInteger(amount) || amount < 1) {
    return 'Amount must be a positive integer.'
  }
  if (!MESSAGING_UNITS.includes(messagingForm.unit)) {
    return 'Unit must be seconds, minutes, or hours.'
  }
  const seconds = messagingPreviewSeconds.value
  if (seconds < 1) return 'Window must be at least 1 second.'
  if (seconds > MAX_MESSAGING_WINDOW_SECONDS) return 'Window cannot exceed 7 days.'
  return null
}

async function saveMessaging() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  messagingError.value = ''
  const validationError = validateMessagingForm()
  if (validationError) {
    messagingError.value = validationError
    return
  }

  savingMessaging.value = true
  try {
    const payload = {
      amount: Math.trunc(Number(messagingForm.amount)),
      unit: messagingForm.unit,
    }
    const { data } = await systemSettingsApi.updateMessagingConfig(payload)
    applyMessaging(data)
    showToast('Messaging edit/delete window saved.', 'success')
  } catch (e) {
    messagingError.value = apiErrorMessage(e, 'Failed to save messaging config.')
    showToast(messagingError.value, 'error')
  } finally {
    savingMessaging.value = false
  }
}

function validateSupportForm(): string | null {
  const amount = supportForm.amount
  if (amount == null || !Number.isInteger(amount) || amount < 1) {
    return 'Amount must be a positive integer.'
  }
  if (!MESSAGING_UNITS.includes(supportForm.unit)) {
    return 'Unit must be seconds, minutes, or hours.'
  }
  const seconds = supportPreviewSeconds.value
  if (seconds < 1) return 'Window must be at least 1 second.'
  if (seconds > MAX_MESSAGING_WINDOW_SECONDS) return 'Window cannot exceed 7 days.'
  return null
}

async function saveSupport() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  supportError.value = ''
  const validationError = validateSupportForm()
  if (validationError) {
    supportError.value = validationError
    return
  }

  savingSupport.value = true
  try {
    const payload = {
      amount: Math.trunc(Number(supportForm.amount)),
      unit: supportForm.unit,
    }
    const { data } = await systemSettingsApi.updateSupportReviewWindowConfig(payload)
    applySupport(data)
    showToast('Support contest window saved.', 'success')
  } catch (e) {
    supportError.value = apiErrorMessage(e, 'Failed to save support review window.')
    showToast(supportError.value, 'error')
  } finally {
    savingSupport.value = false
  }
}

function validateAdminAuthForm(): string | null {
  const threshold = adminAuthForm.failedLoginThreshold
  if (threshold == null || !Number.isInteger(threshold) || threshold < 1 || threshold > 50) {
    return 'Failed attempts must be an integer between 1 and 50.'
  }
  const amount = adminAuthForm.amount
  if (amount == null || !Number.isInteger(amount) || amount < 1) {
    return 'Lock duration amount must be a positive integer.'
  }
  if (!ADMIN_LOCK_UNITS.includes(adminAuthForm.unit)) {
    return 'Unit must be minutes or hours.'
  }
  const seconds = adminAuthPreviewSeconds.value
  if (seconds < 60) return 'Lock duration must be at least 1 minute.'
  if (seconds > MAX_ADMIN_LOCKOUT_SECONDS) return 'Lock duration cannot exceed 30 days.'
  return null
}

async function saveAdminAuth() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  adminAuthError.value = ''
  const validationError = validateAdminAuthForm()
  if (validationError) {
    adminAuthError.value = validationError
    return
  }

  savingAdminAuth.value = true
  try {
    const payload = {
      failedLoginThreshold: Math.trunc(Number(adminAuthForm.failedLoginThreshold)),
      amount: Math.trunc(Number(adminAuthForm.amount)),
      unit: adminAuthForm.unit,
    }
    const { data } = await systemSettingsApi.updateAdminAuthConfig(payload)
    applyAdminAuth(data)
    showToast('Admin login lock settings saved.', 'success')
  } catch (e) {
    adminAuthError.value = apiErrorMessage(e, 'Failed to save admin login lock settings.')
    showToast(adminAuthError.value, 'error')
  } finally {
    savingAdminAuth.value = false
  }
}

function applyRestrictedWords(data: RestrictedIdentityWordsDto) {
  restrictedWordDrafts.value = data.words.length > 0 ? [...data.words] : ['']
}

function addRestrictedWord() {
  restrictedWordDrafts.value.push('')
}

function removeRestrictedWord(index: number) {
  if (restrictedWordDrafts.value.length <= 1) {
    restrictedWordDrafts.value = ['']
    return
  }
  restrictedWordDrafts.value.splice(index, 1)
}

async function saveRestrictedWords() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  restrictedWordsError.value = ''
  const words = restrictedWordDrafts.value.map((w) => w.trim()).filter(Boolean)
  for (let i = 0; i < words.length; i++) {
    if (words[i]!.length > 100) {
      restrictedWordsError.value = `Word ${i + 1} cannot exceed 100 characters.`
      return
    }
  }

  savingRestrictedWords.value = true
  try {
    const { data } = await systemSettingsApi.updateRestrictedIdentityWords({ words })
    applyRestrictedWords(data)
    showToast('Restricted name words saved.', 'success')
  } catch (e) {
    restrictedWordsError.value = apiErrorMessage(e, 'Failed to save restricted name words.')
    showToast(restrictedWordsError.value, 'error')
  } finally {
    savingRestrictedWords.value = false
  }
}

function validateAgencyHostForm(): string | null {
  const amount = agencyHostForm.amount
  if (amount == null || !Number.isInteger(amount) || amount < 1) {
    return 'Cooldown amount must be a positive integer.'
  }
  if (!AGENCY_REJOIN_UNITS.includes(agencyHostForm.unit)) {
    return 'Unit must be hours or days.'
  }
  const seconds = agencyHostPreviewSeconds.value
  if (seconds < 3600) return 'Rejoin cooldown must be at least 1 hour.'
  if (seconds > MAX_AGENCY_REJOIN_SECONDS) return 'Rejoin cooldown cannot exceed 365 days.'
  return null
}

async function saveAgencyHost() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  agencyHostError.value = ''
  const validationError = validateAgencyHostForm()
  if (validationError) {
    agencyHostError.value = validationError
    return
  }

  savingAgencyHost.value = true
  try {
    const { data } = await systemSettingsApi.updateAgencyHostConfig({
      amount: Math.trunc(Number(agencyHostForm.amount)),
      unit: agencyHostForm.unit,
    })
    applyAgencyHost(data)
    showToast('Agency rejoin cooldown saved.', 'success')
  } catch (e) {
    agencyHostError.value = apiErrorMessage(e, 'Failed to save agency rejoin cooldown.')
    showToast(agencyHostError.value, 'error')
  } finally {
    savingAgencyHost.value = false
  }
}

function validateLivestreamRewardForm(): string | null {
  const windowDays = livestreamRewardForm.windowDays
  const pointsPerHour = livestreamRewardForm.pointsPerHour
  if (windowDays == null || !Number.isInteger(windowDays) || windowDays < 1 || windowDays > 30) {
    return 'Duration must be an integer from 1 to 30 days.'
  }
  if (
    pointsPerHour == null ||
    !Number.isInteger(pointsPerHour) ||
    pointsPerHour < 1 ||
    pointsPerHour > 1_000_000
  ) {
    return 'Per-hour reward must be an integer from 1 to 1,000,000 points.'
  }
  return null
}

async function saveLivestreamReward() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  livestreamRewardError.value = ''
  const validationError = validateLivestreamRewardForm()
  if (validationError) {
    livestreamRewardError.value = validationError
    return
  }

  savingLivestreamReward.value = true
  try {
    const { data } = await systemSettingsApi.updateLivestreamRewardConfig({
      windowDays: Math.trunc(Number(livestreamRewardForm.windowDays)),
      pointsPerHour: Math.trunc(Number(livestreamRewardForm.pointsPerHour)),
    })
    applyLivestreamReward(data)
    showToast('Platform reward settings saved.', 'success')
  } catch (e) {
    livestreamRewardError.value = apiErrorMessage(e, 'Failed to save platform reward settings.')
    showToast(livestreamRewardError.value, 'error')
  } finally {
    savingLivestreamReward.value = false
  }
}

onMounted(() => {
  void loadAll()
})
</script>
<template>
  <div class="settings-compact">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="text-lg font-semibold sm:text-xl">System Settings</h1>
        <p class="mt-0.5 text-xs text-admin-subtext">
          Coin &amp; point-level rates: host shares, call price, exchange, packages, commission,
          messaging window, support contest window, admin login lock, agency rejoin cooldown, platform livestream rewards, and payroll FX. Changes take
          effect immediately for new traffic. Click a value to edit.
        </p>
      </div>
      <button
        type="button"
        class="admin-btn-secondary text-xs"
        :disabled="loading"
        @click="loadAll"
      >
        Refresh
      </button>
    </div>

    <div
      class="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0"
      style="-webkit-overflow-scrolling: touch"
    >
      <div
        class="inline-flex min-w-full gap-0.5 rounded-md border border-admin-border bg-admin-surface p-0.5 sm:flex sm:min-w-0 sm:flex-wrap"
      >
        <button
          v-for="tab in TABS"
          :key="tab.value"
          type="button"
          :class="[
            'shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
            activeTab === tab.value
              ? 'bg-admin-accent/15 text-admin-accent'
              : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="activeTab = tab.value"
        >
          <span class="sm:hidden">{{ tab.short }}</span>
          <span class="hidden sm:inline">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="admin-card py-6 text-center text-xs text-admin-subtext">
      Loading rates…
    </div>

    <div v-else-if="loadError" class="admin-card space-y-2">
      <p class="text-xs text-admin-danger">{{ loadError }}</p>
      <button type="button" class="admin-btn-secondary text-xs" @click="loadAll">Retry</button>
    </div>

    <template v-else>
      <!-- Host shares -->
      <section v-if="activeTab === 'host'" class="admin-card max-w-3xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Host revenue shares</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            Host points as a share of buyer coins. Lowering shares reduces host points and agency
            commission base for new transactions immediately.
          </p>
        </div>

        <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="saveHostShares">
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Gift receive share</label>
            <InlineEditField
              v-model="hostForm.giftReceivePercent"
              type="number"
              :min="0.01"
              :max="100"
              step="0.01"
              suffix="%"
              :disabled="savingHost"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Subscription share</label>
            <InlineEditField
              v-model="hostForm.subscriptionPercent"
              type="number"
              :min="0.01"
              :max="100"
              step="0.01"
              suffix="%"
              :disabled="savingHost"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Guardian purchase share</label>
            <InlineEditField
              v-model="hostForm.guardianPurchasePercent"
              type="number"
              :min="0.01"
              :max="100"
              step="0.01"
              suffix="%"
              :disabled="savingHost"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Video call host share</label>
            <InlineEditField
              v-model="hostForm.videoCallHostSharePercent"
              type="number"
              :min="0.01"
              :max="100"
              step="0.01"
              suffix="%"
              :disabled="savingHost"
            />
          </div>

          <dl
            class="sm:col-span-2 grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-2"
          >
            <div>
              <dt class="text-xs text-admin-subtext">Last updated</dt>
              <dd class="font-medium text-admin-text">{{ formatDt(hostSaved?.updatedAt) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-admin-subtext">Updated by admin</dt>
              <dd class="font-medium text-admin-text break-all">
                {{ hostSaved?.updatedByAdminId || '—' }}
              </dd>
            </div>
          </dl>

          <p v-if="hostError" class="sm:col-span-2 text-xs text-admin-danger">{{ hostError }}</p>

          <div class="sm:col-span-2">
            <button type="submit" class="admin-btn-primary" :disabled="savingHost">
              {{ savingHost ? 'Saving…' : 'Save host shares' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Call Price -->
      <section v-else-if="activeTab === 'callPrice'" class="admin-card max-w-3xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Call Price</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            Allowed host <code class="text-xs">pricePerMin</code> values by livestream level.
            Hosts pick from this list in-app; they cannot set arbitrary call prices. Empty max
            level = open-ended (e.g. Lv10&nbsp;&amp;&nbsp;Above).
          </p>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table min-w-[720px]">
            <thead>
              <tr>
                <th>Stream level</th>
                <th>Min Lv</th>
                <th>Max Lv</th>
                <th>Prices (points / min)</th>
                <th class="w-20" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(band, bandIdx) in callPriceBands" :key="'cpb-' + bandIdx">
                <td>
                  <InlineEditField
                    v-model="band.label"
                    empty-label="—"
                    :disabled="savingCallPrice"
                  />
                </td>
                <td>
                  <InlineEditField
                    v-model="band.minLevel"
                    type="number"
                    :min="1"
                    step="1"
                    :disabled="savingCallPrice"
                  />
                </td>
                <td>
                  <InlineEditField
                    v-model="band.maxLevel"
                    type="number"
                    :min="1"
                    step="1"
                    nullable
                    empty-label="∞"
                    placeholder="Open-ended"
                    :disabled="savingCallPrice"
                  />
                </td>
                <td>
                  <div class="flex flex-wrap items-center gap-1.5 py-0.5">
                    <div
                      v-for="(_price, priceIdx) in band.prices"
                      :key="'cpp-' + bandIdx + '-' + priceIdx"
                      class="flex items-center gap-1 rounded-md border border-admin-border bg-admin-bg px-1.5 py-0.5"
                    >
                      <InlineEditField
                        v-model="band.prices[priceIdx]"
                        type="number"
                        :min="1"
                        step="1"
                        :disabled="savingCallPrice"
                      />
                      <button
                        type="button"
                        class="px-1 text-xs text-admin-danger disabled:opacity-40"
                        title="Remove price"
                        :disabled="savingCallPrice || band.prices.length <= 1"
                        @click="removeCallPrice(band, priceIdx)"
                      >
                        ×
                      </button>
                    </div>
                    <button
                      type="button"
                      class="text-xs font-medium text-admin-accent disabled:opacity-40"
                      :disabled="savingCallPrice"
                      @click="addCallPrice(band)"
                    >
                      + Price
                    </button>
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    class="text-xs text-admin-danger disabled:opacity-40"
                    :disabled="savingCallPrice || callPriceBands.length <= 1"
                    @click="removeCallPriceBand(bandIdx)"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="callPriceError" class="text-xs text-admin-danger">{{ callPriceError }}</p>

        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="admin-btn-secondary"
            :disabled="savingCallPrice"
            @click="addCallPriceBand"
          >
            Add band
          </button>
          <button
            type="button"
            class="admin-btn-primary"
            :disabled="savingCallPrice"
            @click="saveCallPrice"
          >
            {{ savingCallPrice ? 'Saving…' : 'Save Call Price' }}
          </button>
        </div>
      </section>

      <!-- Personal -->
      <div v-else-if="activeTab === 'personal'" class="space-y-2">
        <section class="admin-card space-y-2">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Personal point → coin exchange</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Non-agent exchange tiers. Min/max USD is USD-equivalent of points
              (<code class="text-xs">points / 10_000</code>). Last row max empty = open-ended.
            </p>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Min USD</th>
                  <th>Max USD</th>
                  <th>Coins / USD</th>
                  <th class="w-20" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in personalExchangeTiers" :key="'pe-' + idx">
                  <td>
                    <InlineEditField
                      v-model="row.minUsd"
                      type="number"
                      :min="0"
                      step="any"
                      :disabled="savingPersonalExchange"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.maxUsd"
                      type="number"
                      :min="0"
                      step="any"
                      nullable
                      empty-label="∞"
                      placeholder="Open-ended"
                      :disabled="savingPersonalExchange"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.coinsPerUsd"
                      type="number"
                      :min="1"
                      step="1"
                      :disabled="savingPersonalExchange"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="text-xs text-admin-danger disabled:opacity-40"
                      :disabled="savingPersonalExchange || personalExchangeTiers.length <= 1"
                      @click="removeTier(personalExchangeTiers, idx)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="personalExchangeError" class="text-xs text-admin-danger">
            {{ personalExchangeError }}
          </p>

          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="admin-btn-secondary"
              :disabled="savingPersonalExchange"
              @click="addTier(personalExchangeTiers)"
            >
              Add tier
            </button>
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingPersonalExchange"
              @click="savePersonalExchange"
            >
              {{ savingPersonalExchange ? 'Saving…' : 'Save exchange rates' }}
            </button>
          </div>
        </section>

        <section class="admin-card space-y-2">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Personal COIN packages</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Epay catalogue for user wallet packages. Saving replaces the active list.
            </p>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Coins</th>
                  <th>Price (USD)</th>
                  <th>Currency</th>
                  <th>Label</th>
                  <th class="w-20" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in coinPackageDrafts" :key="'cp-' + idx">
                  <td>
                    <InlineEditField
                      v-model="row.coins"
                      type="number"
                      :min="1"
                      step="1"
                      :disabled="savingCoinPackages"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.priceUsd"
                      type="number"
                      :min="0.01"
                      step="0.01"
                      :disabled="savingCoinPackages"
                    />
                  </td>
                  <td>
                    <InlineEditField v-model="row.currency" :disabled="savingCoinPackages" />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.label"
                      empty-label="—"
                      :disabled="savingCoinPackages"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="text-xs text-admin-danger disabled:opacity-40"
                      :disabled="savingCoinPackages || coinPackageDrafts.length <= 1"
                      @click="coinPackageDrafts.splice(idx, 1)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="coinPackagesError" class="text-xs text-admin-danger">{{ coinPackagesError }}</p>

          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="admin-btn-secondary"
              :disabled="savingCoinPackages"
              @click="
                coinPackageDrafts.push({ coins: 10000, priceUsd: 0.99, currency: 'USD', label: '' })
              "
            >
              Add package
            </button>
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingCoinPackages"
              @click="saveCoinPackages"
            >
              {{ savingCoinPackages ? 'Saving…' : 'Save packages' }}
            </button>
          </div>
        </section>

        <section class="admin-card space-y-2">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Wallet wealth / livestream levels</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Global XP thresholds to reach each level. Users recompute against the new ladder after
              save — this does not renumber existing levels directly.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <div class="space-y-2">
              <h3 class="text-xs font-medium text-admin-text">Wealth</h3>
              <div class="admin-table-wrap">
                <table class="admin-table min-w-[480px]">
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>Threshold XP</th>
                      <th>Label</th>
                      <th>Icon</th>
                      <th class="w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in wealthDrafts" :key="'w-' + idx">
                      <td>
                        <InlineEditField
                          v-model="row.level"
                          type="number"
                          :min="1"
                          step="1"
                          :disabled="savingWalletLevels"
                        />
                      </td>
                      <td>
                        <InlineEditField
                          v-model="row.threshold"
                          mono
                          inputmode="numeric"
                          :disabled="savingWalletLevels"
                        />
                      </td>
                      <td>
                        <InlineEditField
                          v-model="row.label"
                          empty-label="—"
                          :disabled="savingWalletLevels"
                        />
                      </td>
                      <td>
                        <InlineEditField
                          v-model="row.iconKey"
                          empty-label="—"
                          :disabled="savingWalletLevels"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          class="text-xs text-admin-danger disabled:opacity-40"
                          :disabled="savingWalletLevels || wealthDrafts.length <= 1"
                          @click="wealthDrafts.splice(idx, 1)"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                class="admin-btn-secondary text-xs"
                :disabled="savingWalletLevels"
                @click="
                  wealthDrafts.push({
                    level: (wealthDrafts[wealthDrafts.length - 1]?.level ?? 0) + 1,
                    threshold: '0',
                    label: '',
                    iconKey: '',
                  })
                "
              >
                Add wealth level
              </button>
            </div>

            <div class="space-y-2">
              <h3 class="text-xs font-medium text-admin-text">Livestream</h3>
              <div class="admin-table-wrap">
                <table class="admin-table min-w-[480px]">
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>Threshold XP</th>
                      <th>Label</th>
                      <th>Icon</th>
                      <th class="w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in livestreamDrafts" :key="'l-' + idx">
                      <td>
                        <InlineEditField
                          v-model="row.level"
                          type="number"
                          :min="1"
                          step="1"
                          :disabled="savingWalletLevels"
                        />
                      </td>
                      <td>
                        <InlineEditField
                          v-model="row.threshold"
                          mono
                          inputmode="numeric"
                          :disabled="savingWalletLevels"
                        />
                      </td>
                      <td>
                        <InlineEditField
                          v-model="row.label"
                          empty-label="—"
                          :disabled="savingWalletLevels"
                        />
                      </td>
                      <td>
                        <InlineEditField
                          v-model="row.iconKey"
                          empty-label="—"
                          :disabled="savingWalletLevels"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          class="text-xs text-admin-danger disabled:opacity-40"
                          :disabled="savingWalletLevels || livestreamDrafts.length <= 1"
                          @click="livestreamDrafts.splice(idx, 1)"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                class="admin-btn-secondary text-xs"
                :disabled="savingWalletLevels"
                @click="
                  livestreamDrafts.push({
                    level: (livestreamDrafts[livestreamDrafts.length - 1]?.level ?? 0) + 1,
                    threshold: '0',
                    label: '',
                    iconKey: '',
                  })
                "
              >
                Add livestream level
              </button>
            </div>
          </div>

          <p v-if="walletLevelsError" class="text-xs text-admin-danger">{{ walletLevelsError }}</p>

          <button
            type="button"
            class="admin-btn-primary"
            :disabled="savingWalletLevels"
            @click="saveWalletLevels"
          >
            {{ savingWalletLevels ? 'Saving…' : 'Save level thresholds' }}
          </button>
        </section>
      </div>

      <!-- Elite / Rich tier -->
      <section v-else-if="activeTab === 'elite'" class="admin-card max-w-3xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Elite tier (coins recharged)</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            Monthly recharge thresholds for RICH I–X. Used for the live badge, rollover carryover,
            and the derived <code>adminTags</code> label on user profiles. New recharges pick up
            the ladder immediately; existing badges stay until the next recharge or month rollover.
          </p>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table min-w-[480px]">
            <thead>
              <tr>
                <th>Elite level</th>
                <th>Coins recharged</th>
                <th>Display name</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in richTierDrafts" :key="'rt-' + row.tier">
                <td class="text-xs text-admin-subtext">RICH {{ row.tier }}</td>
                <td>
                  <InlineEditField
                    v-model="row.minRechargeCoins"
                    mono
                    inputmode="numeric"
                    :disabled="savingRichTier"
                  />
                </td>
                <td>
                  <InlineEditField
                    v-model="row.displayName"
                    empty-label="—"
                    :disabled="savingRichTier"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="richTierError" class="text-xs text-admin-danger">{{ richTierError }}</p>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="savingRichTier || !richTierDrafts.length"
          @click="saveRichTier"
        >
          {{ savingRichTier ? 'Saving…' : 'Save elite thresholds' }}
        </button>
      </section>

      <!-- Trading -->
      <div v-else-if="activeTab === 'trading'" class="space-y-2">
        <section class="admin-card space-y-2">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Trading topup rate tiers</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Agent Epay trading top-up bands by purchase USD. Last row max empty = open-ended.
            </p>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Min USD</th>
                  <th>Max USD</th>
                  <th>Coins / USD</th>
                  <th class="w-20" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in tradingTopupTiers" :key="'tt-' + idx">
                  <td>
                    <InlineEditField
                      v-model="row.minUsd"
                      type="number"
                      :min="0"
                      step="any"
                      :disabled="savingTradingTopup"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.maxUsd"
                      type="number"
                      :min="0"
                      step="any"
                      nullable
                      empty-label="∞"
                      placeholder="Open-ended"
                      :disabled="savingTradingTopup"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.coinsPerUsd"
                      type="number"
                      :min="1"
                      step="1"
                      :disabled="savingTradingTopup"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="text-xs text-admin-danger disabled:opacity-40"
                      :disabled="savingTradingTopup || tradingTopupTiers.length <= 1"
                      @click="removeTier(tradingTopupTiers, idx)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="tradingTopupError" class="text-xs text-admin-danger">{{ tradingTopupError }}</p>

          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="admin-btn-secondary"
              :disabled="savingTradingTopup"
              @click="addTier(tradingTopupTiers)"
            >
              Add tier
            </button>
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingTradingTopup"
              @click="saveTradingTopupRates"
            >
              {{ savingTradingTopup ? 'Saving…' : 'Save topup rates' }}
            </button>
          </div>
        </section>

        <section class="admin-card space-y-2">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Agent point → trading exchange</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Agents only. Same tier shape as personal exchange.
            </p>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Min USD</th>
                  <th>Max USD</th>
                  <th>Coins / USD</th>
                  <th class="w-20" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in agentExchangeTiers" :key="'ae-' + idx">
                  <td>
                    <InlineEditField
                      v-model="row.minUsd"
                      type="number"
                      :min="0"
                      step="any"
                      :disabled="savingAgentExchange"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.maxUsd"
                      type="number"
                      :min="0"
                      step="any"
                      nullable
                      empty-label="∞"
                      placeholder="Open-ended"
                      :disabled="savingAgentExchange"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.coinsPerUsd"
                      type="number"
                      :min="1"
                      step="1"
                      :disabled="savingAgentExchange"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="text-xs text-admin-danger disabled:opacity-40"
                      :disabled="savingAgentExchange || agentExchangeTiers.length <= 1"
                      @click="removeTier(agentExchangeTiers, idx)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="agentExchangeError" class="text-xs text-admin-danger">{{ agentExchangeError }}</p>

          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="admin-btn-secondary"
              :disabled="savingAgentExchange"
              @click="addTier(agentExchangeTiers)"
            >
              Add tier
            </button>
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingAgentExchange"
              @click="saveAgentExchange"
            >
              {{ savingAgentExchange ? 'Saving…' : 'Save agent exchange' }}
            </button>
          </div>
        </section>

        <section class="admin-card space-y-2">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Trading topup packages</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Fixed packages for agent trading top-up. Saving replaces the active catalogue.
            </p>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table min-w-[780px]">
              <thead>
                <tr>
                  <th>Trading coins</th>
                  <th>Price (USD)</th>
                  <th>Coins / USD</th>
                  <th>Currency</th>
                  <th>Label</th>
                  <th class="w-20" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in tradingPackageDrafts" :key="'tp-' + idx">
                  <td>
                    <InlineEditField
                      v-model="row.tradingCoins"
                      mono
                      inputmode="numeric"
                      :disabled="savingTradingPackages"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.priceUsd"
                      type="number"
                      :min="0.01"
                      step="0.01"
                      :disabled="savingTradingPackages"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.coinsPerUsd"
                      type="number"
                      :min="1"
                      step="1"
                      :disabled="savingTradingPackages"
                    />
                  </td>
                  <td>
                    <InlineEditField v-model="row.currency" :disabled="savingTradingPackages" />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.label"
                      empty-label="—"
                      :disabled="savingTradingPackages"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="text-xs text-admin-danger disabled:opacity-40"
                      :disabled="savingTradingPackages || tradingPackageDrafts.length <= 1"
                      @click="tradingPackageDrafts.splice(idx, 1)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="tradingPackagesError" class="text-xs text-admin-danger">
            {{ tradingPackagesError }}
          </p>

          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="admin-btn-secondary"
              :disabled="savingTradingPackages"
              @click="
                tradingPackageDrafts.push({
                  tradingCoins: '94000',
                  priceUsd: 10,
                  coinsPerUsd: 9400,
                  currency: 'USD',
                  label: '',
                })
              "
            >
              Add package
            </button>
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingTradingPackages"
              @click="saveTradingPackages"
            >
              {{ savingTradingPackages ? 'Saving…' : 'Save packages' }}
            </button>
          </div>
        </section>
      </div>

      <!-- Commission -->
      <div v-else-if="activeTab === 'commission'" class="space-y-2">
        <section class="admin-card space-y-2">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Commission level ladder</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Rates and window thresholds for agency tiers (D … SS+). Saving queues a global tier
              recompute.
            </p>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table min-w-[820px]">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Min window points</th>
                  <th>Live %</th>
                  <th>Match / chat %</th>
                  <th>Sort</th>
                  <th class="w-20" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in commissionLevelDrafts" :key="'cl-' + idx">
                  <td>
                    <InlineEditField v-model="row.level" :disabled="savingCommissionLevels" />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.minWindowPoints"
                      mono
                      inputmode="numeric"
                      :disabled="savingCommissionLevels"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.liveRatePercent"
                      type="number"
                      :min="0.01"
                      :max="100"
                      step="0.01"
                      suffix="%"
                      :disabled="savingCommissionLevels"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.matchChatRatePercent"
                      type="number"
                      :min="0.01"
                      :max="100"
                      step="0.01"
                      suffix="%"
                      :disabled="savingCommissionLevels"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.sortOrder"
                      type="number"
                      :min="1"
                      step="1"
                      :disabled="savingCommissionLevels"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="text-xs text-admin-danger disabled:opacity-40"
                      :disabled="savingCommissionLevels || commissionLevelDrafts.length <= 1"
                      @click="commissionLevelDrafts.splice(idx, 1)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="commissionLevelsError" class="text-xs text-admin-danger">
            {{ commissionLevelsError }}
          </p>

          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="admin-btn-secondary"
              :disabled="savingCommissionLevels"
              @click="
                commissionLevelDrafts.push({
                  level: '',
                  minWindowPoints: '0',
                  liveRatePercent: 5,
                  matchChatRatePercent: 5,
                  sortOrder:
                    (commissionLevelDrafts[commissionLevelDrafts.length - 1]?.sortOrder ?? 0) + 1,
                })
              "
            >
              Add level
            </button>
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingCommissionLevels"
              @click="saveCommissionLevels"
            >
              {{ savingCommissionLevels ? 'Saving…' : 'Save commission levels' }}
            </button>
          </div>
        </section>

        <section class="admin-card max-w-2xl space-y-3">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Agency tier window</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              How far back host earnings count toward agency tier
              <code class="text-xs">currentLevel</code>. UTC calendar-day buckets from agency daily
              earnings.
            </p>
          </div>

          <form class="space-y-3" @submit.prevent="saveCommissionWindow">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label class="mb-0.5 block text-[11px] text-admin-subtext">Days (0–365)</label>
                <InlineEditField
                  v-model="commissionWindowForm.windowDays"
                  type="number"
                  :min="0"
                  :max="365"
                  step="1"
                  :disabled="savingCommissionWindow"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-admin-subtext">Hours (0–23)</label>
                <InlineEditField
                  v-model="commissionWindowForm.windowHours"
                  type="number"
                  :min="0"
                  :max="23"
                  step="1"
                  :disabled="savingCommissionWindow"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-admin-subtext">Minutes (0–59)</label>
                <InlineEditField
                  v-model="commissionWindowForm.windowMinutes"
                  type="number"
                  :min="0"
                  :max="59"
                  step="1"
                  :disabled="savingCommissionWindow"
                />
              </div>
            </div>

            <dl
              class="grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-2"
            >
              <div>
                <dt class="text-xs text-admin-subtext">Total duration</dt>
                <dd class="font-medium text-admin-text">
                  {{ formatDuration(windowTotalMinutes) }}
                  <span class="ml-1 text-xs font-normal text-admin-subtext">
                    ({{ windowTotalMinutes }} min)
                  </span>
                </dd>
              </div>
              <div>
                <dt class="text-xs text-admin-subtext">Last updated</dt>
                <dd class="font-medium text-admin-text">
                  {{ formatDt(commissionWindowSaved?.updatedAt ?? null) }}
                </dd>
              </div>
            </dl>

            <p class="text-xs text-admin-subtext">
              Days only (hours and minutes at 0): inclusive UTC days
              <code class="text-[11px]">today − (days − 1)</code> …
              <code class="text-[11px]">today</code>. With hours/minutes, every calendar day
              overlapping <code class="text-[11px]">[now − duration, now]</code> is included. Saving
              queues a global tier recompute.
            </p>

            <p v-if="commissionWindowError" class="text-xs text-admin-danger">
              {{ commissionWindowError }}
            </p>

            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingCommissionWindow"
              @mousedown.prevent="saveCommissionWindow"
            >
              {{ savingCommissionWindow ? 'Saving…' : 'Save window' }}
            </button>
          </form>
        </section>
      </div>

      <!-- Messaging -->
      <section v-else-if="activeTab === 'messaging'" class="admin-card max-w-xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Message edit / delete window</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            How long a sender may edit or soft-delete their own message after sending. Edit and
            delete share one window (default 1 hour). Range: 1 second – 7 days.
          </p>
        </div>

        <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="saveMessaging">
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Amount</label>
            <InlineEditField
              v-model="messagingForm.amount"
              type="number"
              :min="1"
              step="1"
              :disabled="savingMessaging"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Unit</label>
            <select
              v-model="messagingForm.unit"
              class="admin-input"
              :disabled="savingMessaging"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>

          <dl
            class="sm:col-span-2 grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-2"
          >
            <div>
              <dt class="text-xs text-admin-subtext">Preview</dt>
              <dd class="font-medium text-admin-text">
                {{
                  messagingPreviewSeconds > 0
                    ? formatDurationFromSeconds(messagingPreviewSeconds)
                    : '—'
                }}
                <span
                  v-if="messagingPreviewSeconds > 0"
                  class="ml-1 text-xs font-normal text-admin-subtext"
                >
                  ({{ messagingPreviewSeconds }}s)
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-admin-subtext">Last updated</dt>
              <dd class="font-medium text-admin-text">
                {{ formatDt(messagingSaved?.updatedAt ?? null) }}
              </dd>
            </div>
          </dl>

          <p
            v-if="messagingNearMax"
            class="sm:col-span-2 text-xs text-admin-warn"
          >
            Window is near the 7-day maximum.
          </p>

          <p v-if="messagingError" class="sm:col-span-2 text-xs text-admin-danger">
            {{ messagingError }}
          </p>

          <div class="sm:col-span-2">
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingMessaging"
              @mousedown.prevent="saveMessaging"
            >
              {{ savingMessaging ? 'Saving…' : 'Save messaging window' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Support tickets -->
      <section v-else-if="activeTab === 'support'" class="admin-card max-w-xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Support contest / revert window</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            How long a user may contest or revert after a ticket is resolved or rejected
            (<code class="text-[10px]">PENDING_REVIEW</code>). After this window the ticket
            auto-closes. Default 24 hours. Range: 1 second – 7 days. Applies to new resolve/reject
            actions only.
          </p>
        </div>

        <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="saveSupport">
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Amount</label>
            <InlineEditField
              v-model="supportForm.amount"
              type="number"
              :min="1"
              step="1"
              :disabled="savingSupport"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Unit</label>
            <select
              v-model="supportForm.unit"
              class="admin-input"
              :disabled="savingSupport"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>

          <dl
            class="sm:col-span-2 grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-2"
          >
            <div>
              <dt class="text-xs text-admin-subtext">Preview</dt>
              <dd class="font-medium text-admin-text">
                {{
                  supportPreviewSeconds > 0
                    ? formatDurationFromSeconds(supportPreviewSeconds)
                    : '—'
                }}
                <span
                  v-if="supportPreviewSeconds > 0"
                  class="ml-1 text-xs font-normal text-admin-subtext"
                >
                  ({{ supportPreviewSeconds }}s)
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-admin-subtext">Last updated</dt>
              <dd class="font-medium text-admin-text">
                {{ formatDt(supportSaved?.updatedAt ?? null) }}
              </dd>
            </div>
          </dl>

          <p
            v-if="supportNearMax"
            class="sm:col-span-2 text-xs text-admin-warn"
          >
            Window is near the 7-day maximum.
          </p>

          <p v-if="supportError" class="sm:col-span-2 text-xs text-admin-danger">
            {{ supportError }}
          </p>

          <div class="sm:col-span-2">
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingSupport"
              @mousedown.prevent="saveSupport"
            >
              {{ savingSupport ? 'Saving…' : 'Save support window' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Admin login lock -->
      <section v-else-if="activeTab === 'adminLogin'" class="admin-card max-w-xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Admin / CSA login lock</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            After this many consecutive wrong passwords, the account is locked for the duration
            below. Login then returns
            <code class="text-[10px]">423 ADMIN_ACCOUNT_LOCKED</code>. Default 5 attempts and 24
            hours. Range: 1–50 attempts, 1 minute – 30 days. Applies to the next lock only (already
            locked accounts keep their existing
            <code class="text-[10px]">lockedUntil</code>).
          </p>
        </div>

        <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="saveAdminAuth">
          <div class="sm:col-span-2">
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Failed attempts before lock</label>
            <InlineEditField
              v-model="adminAuthForm.failedLoginThreshold"
              type="number"
              :min="1"
              :max="50"
              step="1"
              :disabled="savingAdminAuth"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Lock duration</label>
            <InlineEditField
              v-model="adminAuthForm.amount"
              type="number"
              :min="1"
              step="1"
              :disabled="savingAdminAuth"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Unit</label>
            <select
              v-model="adminAuthForm.unit"
              class="admin-input"
              :disabled="savingAdminAuth"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>

          <dl
            class="sm:col-span-2 grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-2"
          >
            <div>
              <dt class="text-xs text-admin-subtext">Preview</dt>
              <dd class="font-medium text-admin-text">
                {{
                  adminAuthPreviewSeconds > 0
                    ? formatDurationFromSeconds(adminAuthPreviewSeconds)
                    : '—'
                }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-admin-subtext">Last updated</dt>
              <dd class="font-medium text-admin-text">
                {{ formatDt(adminAuthSaved?.updatedAt ?? null) }}
              </dd>
            </div>
          </dl>

          <p v-if="adminAuthError" class="sm:col-span-2 text-xs text-admin-danger">
            {{ adminAuthError }}
          </p>

          <div class="sm:col-span-2">
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingAdminAuth"
              @mousedown.prevent="saveAdminAuth"
            >
              {{ savingAdminAuth ? 'Saving…' : 'Save login lock' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Restricted identity words -->
      <section v-else-if="activeTab === 'restrictedNames'" class="admin-card max-w-xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Restricted names</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            Case-insensitive substring list. If
            <code class="text-[10px]">admin</code> is listed, first name, last name, and username
            cannot contain it (e.g.
            <code class="text-[10px]">Administrator</code>). Super-admin user PATCH may still set
            those names. Saving replaces the whole list.
          </p>
        </div>

        <div class="space-y-1.5">
          <div
            v-for="(word, idx) in restrictedWordDrafts"
            :key="'rw-' + idx"
            class="flex items-center gap-1.5"
          >
            <InlineEditField
              v-model="restrictedWordDrafts[idx]"
              empty-label="word"
              :disabled="savingRestrictedWords"
            />
            <button
              type="button"
              class="text-xs text-admin-danger disabled:opacity-40"
              :disabled="savingRestrictedWords"
              @click="removeRestrictedWord(idx)"
            >
              Remove
            </button>
          </div>
        </div>

        <p v-if="restrictedWordsError" class="text-xs text-admin-danger">
          {{ restrictedWordsError }}
        </p>

        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="admin-btn-secondary"
            :disabled="savingRestrictedWords"
            @click="addRestrictedWord"
          >
            Add word
          </button>
          <button
            type="button"
            class="admin-btn-primary"
            :disabled="savingRestrictedWords"
            @mousedown.prevent="saveRestrictedWords"
          >
            {{ savingRestrictedWords ? 'Saving…' : 'Save words' }}
          </button>
        </div>
      </section>

      <!-- Agency rejoin cooldown -->
      <section v-else-if="activeTab === 'agency'" class="admin-card max-w-xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Agency rejoin cooldown</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            After a host leaves an agency or a join application is rejected, they must wait this
            long before applying to any agency again. Returns
            <code class="text-[10px]">429 AGENCY_APPLICATION_COOLDOWN</code> with
            <code class="text-[10px]">nextAllowedAt</code>. Default 24 hours. Range: 1 hour – 365
            days. Admin add-host bypasses this gate.
          </p>
        </div>

        <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="saveAgencyHost">
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Cooldown</label>
            <InlineEditField
              v-model="agencyHostForm.amount"
              type="number"
              :min="1"
              step="1"
              :disabled="savingAgencyHost"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Unit</label>
            <select
              v-model="agencyHostForm.unit"
              class="admin-input"
              :disabled="savingAgencyHost"
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>

          <dl
            class="sm:col-span-2 grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-2"
          >
            <div>
              <dt class="text-xs text-admin-subtext">Preview</dt>
              <dd class="font-medium text-admin-text">
                {{
                  agencyHostPreviewSeconds > 0
                    ? formatDurationFromSeconds(agencyHostPreviewSeconds)
                    : '—'
                }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-admin-subtext">Last updated</dt>
              <dd class="font-medium text-admin-text">
                {{ formatDt(agencyHostSaved?.updatedAt ?? null) }}
              </dd>
            </div>
          </dl>

          <p v-if="agencyHostError" class="sm:col-span-2 text-xs text-admin-danger">
            {{ agencyHostError }}
          </p>

          <div class="sm:col-span-2">
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingAgencyHost"
              @mousedown.prevent="saveAgencyHost"
            >
              {{ savingAgencyHost ? 'Saving…' : 'Save rejoin cooldown' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Platform livestream reward -->
      <section v-else-if="activeTab === 'platformReward'" class="admin-card max-w-xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Platform livestream reward</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            New members can claim points for streaming each UTC day during their first N membership
            days. Two parts per day unlock at 1 hour and 2 hours streamed; each part pays the
            configured per-hour amount. Existing claims keep the points amount recorded at claim
            time.
          </p>
        </div>

        <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="saveLivestreamReward">
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Duration (days)</label>
            <InlineEditField
              v-model="livestreamRewardForm.windowDays"
              type="number"
              :min="1"
              :max="30"
              step="1"
              :disabled="savingLivestreamReward"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Points per hour</label>
            <InlineEditField
              v-model="livestreamRewardForm.pointsPerHour"
              type="number"
              :min="1"
              :max="1000000"
              step="1"
              :disabled="savingLivestreamReward"
            />
          </div>

          <dl
            class="sm:col-span-2 grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-2"
          >
            <div>
              <dt class="text-xs text-admin-subtext">Daily max (2 parts)</dt>
              <dd class="font-medium text-admin-text">
                {{
                  livestreamRewardForm.pointsPerHour != null
                    ? `${(Number(livestreamRewardForm.pointsPerHour) * 2).toLocaleString()} pts`
                    : '—'
                }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-admin-subtext">Last updated</dt>
              <dd class="font-medium text-admin-text">
                {{ formatDt(livestreamRewardSaved?.updatedAt ?? null) }}
              </dd>
            </div>
          </dl>

          <p v-if="livestreamRewardError" class="sm:col-span-2 text-xs text-admin-danger">
            {{ livestreamRewardError }}
          </p>

          <div class="sm:col-span-2">
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="savingLivestreamReward"
              @mousedown.prevent="saveLivestreamReward"
            >
              {{ savingLivestreamReward ? 'Saving…' : 'Save platform rewards' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Payroll -->
      <div v-else-if="activeTab === 'payroll'" class="max-w-5xl space-y-2">
        <section class="admin-card space-y-3">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Payroll / FX</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Withdrawal limits, SLA, country FX, and BANK fee bands by requested amount.
              EPAY takes the service fee only (no tiers, paid by super admin). BANK has no
              service fee; platform fee and agent reward apply to full gross. Agent reward is
              a percent of the platform fee. Last fee-band max empty = open-ended.
              10,000 points = $1. Unknown user country falls back to INR.
            </p>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Min USD</th>
                  <th>Max USD</th>
                  <th>Platform fee</th>
                  <th>Agent reward</th>
                  <th class="w-20" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in payrollFeeTiers" :key="'pf-' + idx">
                  <td>
                    <InlineEditField
                      v-model="row.minUsd"
                      type="number"
                      :min="0"
                      step="any"
                      :disabled="savingPayroll"
                    />
                    <p v-if="row.minUsd != null" class="mt-0.5 text-[10px] text-admin-muted">
                      {{ usdToPointsLabel(row.minUsd) }}
                    </p>
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.maxUsd"
                      type="number"
                      :min="0"
                      step="any"
                      nullable
                      empty-label="∞"
                      placeholder="Open-ended"
                      :disabled="savingPayroll"
                    />
                    <p v-if="row.maxUsd != null" class="mt-0.5 text-[10px] text-admin-muted">
                      {{ usdToPointsLabel(row.maxUsd) }}
                    </p>
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.platformFeeRatePercent"
                      type="number"
                      :min="0"
                      :max="100"
                      step="0.01"
                      suffix="%"
                      :disabled="savingPayroll"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.agentRewardRatePercent"
                      type="number"
                      :min="0"
                      :max="100"
                      step="0.01"
                      suffix="%"
                      :disabled="savingPayroll"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="text-xs text-admin-danger disabled:opacity-40"
                      :disabled="savingPayroll || payrollFeeTiers.length <= 1"
                      @click="removePayrollFeeTier(idx)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="savingPayroll"
            @click="addPayrollFeeTier"
          >
            Add fee band
          </button>

          <div>
            <h3 class="text-xs font-semibold text-admin-text">Country FX rates</h3>
            <p class="mt-0.5 text-[11px] text-admin-muted">
              Shown on withdraw requests, withdraw history, and agency point transfers. Match
              the user’s country name or ISO code.
            </p>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Code</th>
                  <th>Currency</th>
                  <th>Rate / USD</th>
                  <th class="w-20" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in payrollCountryRates" :key="'px-' + idx">
                  <td>
                    <InlineEditField
                      v-model="row.country"
                      placeholder="India"
                      :disabled="savingPayroll"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.countryCode"
                      placeholder="IN"
                      :disabled="savingPayroll"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.currencyCode"
                      placeholder="INR"
                      :disabled="savingPayroll"
                    />
                  </td>
                  <td>
                    <InlineEditField
                      v-model="row.ratePerUsd"
                      type="number"
                      :min="0"
                      step="0.0001"
                      :disabled="savingPayroll"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="text-xs text-admin-danger disabled:opacity-40"
                      :disabled="savingPayroll || payrollCountryRates.length <= 1"
                      @click="removePayrollCountryRate(idx)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="savingPayroll"
            @click="addPayrollCountryRate"
          >
            Add country
          </button>

          <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="savePayroll">
            <div>
              <label class="mb-0.5 block text-[11px] text-admin-subtext">Service fee (USD)</label>
              <InlineEditField
                v-model="payrollForm.serviceFeeUsd"
                type="number"
                :min="0"
                step="0.01"
                :disabled="savingPayroll"
              />
              <p class="mt-0.5 text-[10px] text-admin-muted">
                EPAY only. $10 request − $1 fee = $9 host fiat. BANK service fee is 0.
              </p>
            </div>
            <div>
              <label class="mb-0.5 block text-[11px] text-admin-subtext">Min withdrawal (USD)</label>
              <InlineEditField
                v-model="payrollForm.minWithdrawalUsd"
                type="number"
                :min="0"
                step="0.01"
                :disabled="savingPayroll"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[11px] text-admin-subtext">Max withdrawal (USD)</label>
              <InlineEditField
                v-model="payrollForm.maxWithdrawalUsd"
                type="number"
                :min="0"
                step="0.01"
                :disabled="savingPayroll"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[11px] text-admin-subtext">SLA hours</label>
              <InlineEditField
                v-model="payrollForm.slaHours"
                type="number"
                :min="0"
                step="1"
                :disabled="savingPayroll"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[11px] text-admin-subtext">Waiting hours</label>
              <InlineEditField
                v-model="payrollForm.waitingHours"
                type="number"
                :min="0"
                step="1"
                :disabled="savingPayroll"
              />
            </div>
            <div class="sm:col-span-2 max-w-xs">
              <label class="mb-0.5 block text-[11px] text-admin-subtext">Max assignment attempts</label>
              <InlineEditField
                v-model="payrollForm.maxAssignmentAttempts"
                type="number"
                :min="0"
                step="1"
                :disabled="savingPayroll"
              />
            </div>

            <p v-if="payrollError" class="sm:col-span-2 text-xs text-admin-danger">{{ payrollError }}</p>

            <div class="sm:col-span-2">
              <button type="submit" class="admin-btn-primary" :disabled="savingPayroll">
                {{ savingPayroll ? 'Saving…' : 'Save payroll config' }}
              </button>
            </div>
          </form>
        </section>

        <section class="admin-card space-y-3">
          <div>
            <h2 class="text-sm font-semibold text-admin-text">Payout methods</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Enable or disable host withdraw rails (EPAY / BANK) and edit display fee % and arrival
              copy. Display fee does not change payroll math. Disabling blocks new binds and
              withdrawals; in-flight withdrawals are not cancelled.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div
              v-for="railKey in PAYOUT_RAIL_KEYS"
              :key="railKey"
              class="space-y-2 rounded-md border border-admin-border bg-admin-bg/40 p-2.5"
            >
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-admin-text">
                  {{ railKey === 'epay' ? 'EPAY' : 'BANK' }}
                </h3>
                <label class="flex items-center gap-1.5 text-xs text-admin-text">
                  <input
                    v-model="payoutRailsForm[railKey].enabled"
                    type="checkbox"
                    class="rounded border-admin-border"
                    :disabled="savingPayoutRails"
                  />
                  Enabled
                </label>
              </div>

              <div>
                <label class="mb-0.5 block text-[11px] text-admin-subtext">Display fee</label>
                <InlineEditField
                  v-model="payoutRailsForm[railKey].feePercent"
                  type="number"
                  :min="0"
                  :max="100"
                  step="0.01"
                  suffix="%"
                  :disabled="savingPayoutRails"
                />
              </div>

              <div>
                <label class="mb-0.5 block text-[11px] text-admin-subtext">Arrival copy</label>
                <InlineEditField
                  v-model="payoutRailsForm[railKey].arrivalTime"
                  empty-label="—"
                  :disabled="savingPayoutRails"
                />
              </div>

              <p
                v-if="!payoutRailsForm[railKey].enabled"
                class="text-[11px] text-admin-warn"
              >
                Hosts cannot bind or start new withdrawals with this method until re-enabled.
              </p>
            </div>
          </div>

          <dl class="grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-2">
            <div>
              <dt class="text-xs text-admin-subtext">Last updated</dt>
              <dd class="font-medium text-admin-text">
                {{ formatDt(payoutRailsSaved?.updatedAt ?? null) }}
              </dd>
            </div>
          </dl>

          <p
            v-if="!payoutRailsForm.epay.enabled && !payoutRailsForm.bank.enabled"
            class="text-xs text-admin-danger"
          >
            Both rails are off — hosts cannot withdraw by any method.
          </p>

          <p v-if="payoutRailsError" class="text-xs text-admin-danger">{{ payoutRailsError }}</p>

          <button
            type="button"
            class="admin-btn-primary"
            :disabled="savingPayoutRails || !payoutRailsSaved"
            @mousedown.prevent="savePayoutRails"
          >
            {{ savingPayoutRails ? 'Saving…' : 'Save payout methods' }}
          </button>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.settings-compact {
  @apply mx-auto max-w-[1600px] space-y-2.5 px-3 py-3 sm:px-4 sm:py-4 lg:px-6;
}

.settings-compact :deep(.admin-card) {
  @apply rounded-md p-3;
}

.settings-compact :deep(.admin-table) {
  @apply text-xs;
}

.settings-compact :deep(.admin-table th) {
  @apply px-2 py-1.5 text-[10px] tracking-wide sm:px-2 sm:py-1.5;
}

.settings-compact :deep(.admin-table td) {
  @apply px-2 py-1 sm:px-2 sm:py-1;
}

.settings-compact :deep(.admin-btn) {
  @apply gap-1.5 px-2.5 py-1.5 text-xs;
}

.settings-compact :deep(.admin-input) {
  @apply px-2 py-1 text-xs;
}

/* Compact click-to-edit controls on this page only */
.settings-compact :deep(button.min-h-\[2\.25rem\]) {
  min-height: 1.75rem;
  @apply px-2 py-1 text-xs;
}
</style>
