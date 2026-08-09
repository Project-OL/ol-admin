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
  PayrollConfigSnapshot,
  RateTier,
  RateTierDraft,
  TradingPackage,
  TradingPackageDraft,
  VideoCallPriceCapTier,
} from '@/types/systemRates'
import { showToast } from '@/utils/toast'

type SettingsTab = 'host' | 'callPrice' | 'personal' | 'trading' | 'commission' | 'payroll'

const TABS: { value: SettingsTab; label: string; short: string }[] = [
  { value: 'host', label: 'Host shares', short: 'Host' },
  { value: 'callPrice', label: 'Call Price', short: 'Call' },
  { value: 'personal', label: 'Personal', short: 'Personal' },
  { value: 'trading', label: 'Trading', short: 'Trading' },
  { value: 'commission', label: 'Commission', short: 'Comm' },
  { value: 'payroll', label: 'Payroll / FX', short: 'Payroll' },
]

const MAX_WINDOW_MINUTES = 365 * 24 * 60

const activeTab = ref<SettingsTab>('host')
const loading = ref(false)
const loadError = ref('')

const savingHost = ref(false)
const savingCallPrice = ref(false)
const savingPersonalExchange = ref(false)
const savingCoinPackages = ref(false)
const savingWalletLevels = ref(false)
const savingTradingTopup = ref(false)
const savingAgentExchange = ref(false)
const savingTradingPackages = ref(false)
const savingCommissionLevels = ref(false)
const savingCommissionWindow = ref(false)
const savingPayroll = ref(false)

const hostError = ref('')
const callPriceError = ref('')
const personalExchangeError = ref('')
const coinPackagesError = ref('')
const walletLevelsError = ref('')
const tradingTopupError = ref('')
const agentExchangeError = ref('')
const tradingPackagesError = ref('')
const commissionLevelsError = ref('')
const commissionWindowError = ref('')
const payrollError = ref('')

const hostSaved = ref<HostRevenueShares | null>(null)
const hostForm = reactive({
  giftReceivePercent: 60,
  subscriptionPercent: 75,
  guardianPurchasePercent: 75,
  videoCallHostSharePercent: 60,
})

const personalExchangeTiers = ref<RateTierDraft[]>([])
const coinPackageDrafts = ref<CoinPackageDraft[]>([])
const wealthDrafts = ref<LevelThresholdDraft[]>([])
const livestreamDrafts = ref<LevelThresholdDraft[]>([])

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
  platformFeeRatePercent: 0,
  agentRewardRatePercent: 0,
  serviceFeeUsd: 0,
  minWithdrawalUsd: 0,
  maxWithdrawalUsd: 0,
  slaHours: 0,
  waitingHours: 0,
  maxAssignmentAttempts: 0,
  inrPerUsd: 0,
})

const callPriceBands = ref<CallPriceBandDraft[]>([])

const windowTotalMinutes = computed(
  () =>
    commissionWindowForm.windowDays * 24 * 60 +
    commissionWindowForm.windowHours * 60 +
    commissionWindowForm.windowMinutes,
)

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

function applyPayroll(cfg: PayrollConfigSnapshot) {
  payrollSaved.value = cfg
  payrollForm.platformFeeRatePercent = bpToPercent(cfg.platformFeeRateBp)
  payrollForm.agentRewardRatePercent = bpToPercent(cfg.agentRewardRateBp)
  payrollForm.serviceFeeUsd = cfg.serviceFeeUsd
  payrollForm.minWithdrawalUsd = cfg.minWithdrawalUsd
  payrollForm.maxWithdrawalUsd = cfg.maxWithdrawalUsd
  payrollForm.slaHours = cfg.slaHours
  payrollForm.waitingHours = cfg.waitingHours
  payrollForm.maxAssignmentAttempts = cfg.maxAssignmentAttempts
  payrollForm.inrPerUsd = cfg.inrPerUsd
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
  tradingTopupTiers.value = toTierDrafts(data.tradingTopupRates.tiers)
  agentExchangeTiers.value = toTierDrafts(data.agentExchangeRates.tiers)
  tradingPackageDrafts.value = toTradingDrafts(data.tradingTopupPackages.packages)
  commissionLevelDrafts.value = toCommissionDrafts(data.commissionLevels.levels)
  applyCommissionWindow(data.commissionWindow)
  applyPayroll(data.payroll)
  if (data.videoCallPriceCaps) {
    applyCallPriceTiers(data.videoCallPriceCaps.tiers)
  }
}

async function loadAll() {
  loading.value = true
  loadError.value = ''
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
  const agentErr = validatePercent0to100('Agent reward rate', payrollForm.agentRewardRatePercent)
  if (agentErr) {
    payrollError.value = agentErr
    return
  }
  const platformErr = validatePercent0to100(
    'Platform fee rate',
    payrollForm.platformFeeRatePercent,
  )
  if (platformErr) {
    payrollError.value = platformErr
    return
  }
  for (const [label, value] of [
    ['Service fee USD', payrollForm.serviceFeeUsd],
    ['Min withdrawal USD', payrollForm.minWithdrawalUsd],
    ['Max withdrawal USD', payrollForm.maxWithdrawalUsd],
    ['INR per USD', payrollForm.inrPerUsd],
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
      platformFeeRateBp: percentToBp(payrollForm.platformFeeRatePercent),
      agentRewardRateBp: percentToBp(payrollForm.agentRewardRatePercent),
      serviceFeeUsd: payrollForm.serviceFeeUsd,
      minWithdrawalUsd: payrollForm.minWithdrawalUsd,
      maxWithdrawalUsd: payrollForm.maxWithdrawalUsd,
      slaHours: payrollForm.slaHours,
      waitingHours: payrollForm.waitingHours,
      maxAssignmentAttempts: payrollForm.maxAssignmentAttempts,
      inrPerUsd: payrollForm.inrPerUsd,
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
          Coin &amp; point-level rates: host shares, call price caps, exchange, packages, commission,
          and payroll FX. Changes take effect immediately for new transactions. Click a value to
          edit.
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

      <!-- Payroll -->
      <section v-else class="admin-card max-w-3xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Payroll / FX</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            Withdrawal limits, SLA, agent reward share, and INR display FX.
            <code class="text-xs">platformFeeRateBp</code> is stored for admin display; runtime host
            fee tiers are code-based.
          </p>
        </div>

        <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="savePayroll">
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Platform fee (display)</label>
            <InlineEditField
              v-model="payrollForm.platformFeeRatePercent"
              type="number"
              :min="0"
              :max="100"
              step="0.01"
              suffix="%"
              :disabled="savingPayroll"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Agent reward share</label>
            <InlineEditField
              v-model="payrollForm.agentRewardRatePercent"
              type="number"
              :min="0"
              :max="100"
              step="0.01"
              suffix="%"
              :disabled="savingPayroll"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Service fee (USD)</label>
            <InlineEditField
              v-model="payrollForm.serviceFeeUsd"
              type="number"
              :min="0"
              step="0.01"
              :disabled="savingPayroll"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">INR per USD</label>
            <InlineEditField
              v-model="payrollForm.inrPerUsd"
              type="number"
              :min="0"
              step="0.01"
              :disabled="savingPayroll"
            />
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
