<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { format, parseISO } from 'date-fns'
import { currencyApi } from '@/api/currency'
import { userAdminApi } from '@/api/userAdmin'
import type {
  AdminCurrencyAdjustmentEntry,
  AdminCurrencyKind,
  AdminCurrencySupplySummary,
  CompanyCashCreateBody,
  CompanyCashEntry,
  CompanyCashReason,
  HouseAccountEntry,
  LedgerAccountRoleType,
  LedgerGrain,
  LedgerLine,
  MasterLedgerDashboard,
  TreasuryFlowEntry,
} from '@/types/currency'
import type { UserSearchItem } from '@/types/api'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import { formatCoins, formatPoints, formatUsd } from '@/utils/format'
import { showToast } from '@/utils/toast'

const dashboard = ref<MasterLedgerDashboard | null>(null)
const loading = ref(false)

const grain = ref<LedgerGrain>('month')
const customFrom = ref('')
const customTo = ref('')

const cashEntries = ref<CompanyCashEntry[]>([])
const cashCursor = ref<string | null>(null)
const cashHasMore = ref(false)
const cashLoading = ref(false)

const adjustments = ref<AdminCurrencyAdjustmentEntry[]>([])
const adjCursor = ref<string | null>(null)
const adjHasMore = ref(false)
const adjLoading = ref(false)

const houseAccounts = ref<HouseAccountEntry[]>([])
const houseLoading = ref(false)
const treasuryFlows = ref<TreasuryFlowEntry[]>([])
const treasuryCursor = ref<string | null>(null)
const treasuryHasMore = ref(false)
const treasuryLoading = ref(false)
const classifySubmitting = ref<string | null>(null)

const form = reactive({
  userQuery: '',
  userId: '',
  userLabel: '',
  currency: 'COIN' as AdminCurrencyKind,
  direction: 'credit' as 'credit' | 'debit',
  amount: '',
  promotional: false,
  description: '',
  forceTradingCredit: false,
})

const houseForm = reactive({
  userQuery: '',
  userId: '',
  userLabel: '',
  role: 'TREASURY' as LedgerAccountRoleType,
  label: '',
  note: '',
})
const houseSearchHits = ref<UserSearchItem[]>([])
const houseSearching = ref(false)
const houseSubmitting = ref(false)

const searchHits = ref<UserSearchItem[]>([])
const searching = ref(false)
const submitting = ref(false)

/** Mint/adjust: treasury dropdown by default; optional search for other users. */
const includeNonTreasuryUsers = ref(false)
const selectedTreasuryUserId = ref('')

const treasuryHouseAccounts = computed(() =>
  houseAccounts.value.filter((a) => a.role === 'TREASURY' && a.isActive),
)

const cashForm = reactive<CompanyCashCreateBody>({
  direction: 'IN',
  reason: 'AGENCY_TRADING_PURCHASE',
  amountUsd: '',
  description: '',
})
const cashSubmitting = ref(false)

type HelpTopic =
  | 'grossSales'
  | 'companyPayouts'
  | 'netSalesMargin'
  | 'operatingProfit'
  | 'booksBalanced'
  | 'salesVsUsage'

const METRIC_HELP: Record<
  HelpTopic,
  {
    title: string
    cardLabel: string
    summary: string
    formula: string
    includes: string[]
    excludes: string[]
  }
> = {
  grossSales: {
    title: 'Gross unit sales',
    cardLabel: 'Gross unit sales',
    summary:
      'Units the company counts as sold to customers in this period. Shown in USD using 10,000 units = $1.',
    formula: 'Treasury sales − sale reversals − returns to house + Epay top-ups + direct admin credits to customers',
    includes: [
      'Treasury trading-coin transfers to customers (default: counted as a sale)',
      'Treasury point transfers to customers (default: counted as a sale)',
      'Minus: sales reversed inside this period',
      'Minus: units sent back from customers to a registered house account',
      'Epay personal coin top-ups (TOPUP)',
      'Epay trading-coin top-ups (TRADING_TOPUP)',
      'Admin Adjust credits to customers — coins, trading coins, or points — when not marked promotional',
    ],
    excludes: [
      'Transfers between house accounts (internal moves)',
      'Treasury outflows tagged Promo or Write-off',
      'Promotional admin Adjust credits',
      'Cash journal “money in” rows (audit only — they do not add sales here)',
      'Per-mint cash USD fields on Adjust (ignored for this number)',
    ],
  },
  companyPayouts: {
    title: 'Company payouts',
    cardLabel: 'Company payouts',
    summary:
      'Real money the company paid from its own account, converted to units at 10,000 units = $1.',
    formula: 'Sum of non-promotional Cash journal “money out” rows in this period',
    includes: [
      'EPAY host payouts — company paid the host via Epay (EPAY_PAYOUT)',
      'Bank payroll takeovers — company stepped in and paid fiat when an agent could not (PAYROLL_TAKEOVER_PAYOUT)',
    ],
    excludes: [
      'Bank payroll paid by the agency agent from their own balance',
      'Promotional cash journal rows',
      'Cash journal “money in” rows (agency trading purchases, manual deposits — audit only)',
    ],
  },
  netSalesMargin: {
    title: 'Net sales margin',
    cardLabel: 'Net sales margin',
    summary:
      'What is left after subtracting company payouts and free units given away from gross unit sales.',
    formula: 'Gross unit sales − company payouts − treasury promo/write-off grants − promotional admin mints',
    includes: [
      'Starts from Gross unit sales (all revenue lines above)',
      'Minus Company payouts',
      'Minus treasury transfers classified Promo or Write-off',
      'Minus admin Adjust credits marked promotional (coins, trading coins, or points)',
    ],
    excludes: [
      'In-app spending profit (that is Operating profit)',
      'Agency-paid payroll',
    ],
  },
  operatingProfit: {
    title: 'Operating profit',
    cardLabel: 'Operating profit',
    summary:
      'Profit from how customers used units inside the app — gifts, calls, store, withdrawals, and similar — not from selling new units.',
    formula: 'Sum of consumption revenue lines − rewards/promos/treasury giveaways',
    includes: [
      'Revenue — margin kept when coins are spent:',
      '• Gifts net of refunds (GIFT_SEND / GIFT_REFUND; host points + agency commission reduce the margin)',
      '• Video calls (VIDEO_CALL)',
      '• Creator subscriptions (CREATOR_SUBSCRIPTION / SUBSCRIPTION)',
      '• Guardian purchases (GUARDIAN_PURCHASE / GUARDIAN_PURCHASE points)',
      '• Store item purchases',
      '• VIP membership purchases',
      '• Rare public-ID purchases (VIP_PURCHASE coin debits)',
      '• Username changes (USERNAME_CHANGE)',
      '• Global messages (GLOBAL_MESSAGE)',
      '• Custom gift requests net of refunds (CUSTOM_GIFT_REQUEST / CUSTOM_GIFT_REFUND)',
      '• Point→coin conversion spread (points debited for exchange minus coins/trading coins credited)',
      '• Withdrawal retention net of company payouts (WITHDRAWAL, WITHDRAWAL_ESCROW_SETTLED minus host payroll credits, takeover inventory, processing rewards, and withdrawal refunds)',
      '• Expired coins (EXPIRE)',
      '• Agency force-exit penalties (AGENCY_FORCE_EXIT_PENALTY)',
      '• Admin clawbacks from customers (Adjust debits on coins, trading coins, or points)',
      'Costs subtracted:',
      '• Login / weekly / platform coin rewards (DAILY_LOGIN, WEEKLY_TOPUP, PLATFORM_REWARD coins, VIP_REWARD)',
      '• Livestream streak + platform point rewards (LIVESTREAM_STREAK_REWARD, PLATFORM_REWARD points)',
      '• Promotional admin Adjust credits',
      '• Treasury promo / write-off grants',
    ],
    excludes: [
      'New unit sales from treasury or Epay (those are in Gross unit sales)',
      'Company fiat payouts (subtracted in Net sales margin, and again inside withdrawal retention here)',
    ],
  },
  booksBalanced: {
    title: 'Books balanced',
    cardLabel: 'Books balanced',
    summary:
      'Checks that every wallet balance matches the master ledger. Fix breakage before trusting other numbers.',
    formula: '(Customer units held + house inventory) − (ledger credits − ledger debits) = 0',
    includes: [
      'Customer units held = user coins + agency trading coins + host points + agency points',
      'House inventory = house personal coins + house trading coins + house points (unsold stock, not owed to users)',
      'Ledger net = all-time coin, trading-coin, and point credits minus debits',
    ],
    excludes: [
      'Does not measure sales or profit — only whether wallets and ledger entries agree',
    ],
  },
  salesVsUsage: {
    title: 'Sales vs usage check',
    cardLabel: 'Sales vs usage check',
    summary:
      'Checks that sales and payouts line up with the change in customer balances plus in-app usage profit.',
    formula: 'Gross unit sales − company payouts = change in customer units held + operating profit',
    includes: [
      'Gross unit sales (left side)',
      'Company payouts (subtracted on left side)',
      'Change in customer units held = closing total − opening total at period start',
      'Operating profit (right side)',
      'Opening customer total comes from the daily snapshot when available, otherwise a live wallet scan',
    ],
    excludes: [
      'House inventory changes (unsold stock does not affect this equation)',
      'Promotional grants cancel inside the equation — they raise customer balances and lower operating profit by the same amount',
    ],
  },
}

const HELP_TOPICS: HelpTopic[] = [
  'grossSales',
  'companyPayouts',
  'netSalesMargin',
  'operatingProfit',
  'booksBalanced',
  'salesVsUsage',
]

type GlossaryTermId =
  | 'mint'
  | 'adjust'
  | 'units'
  | 'treasury'
  | 'companyAgency'
  | 'houseInventory'
  | 'float'
  | 'customerFloat'
  | 'imputed'
  | 'companyFiatPayouts'
  | 'writeOffGrants'
  | 'promotionalAdminMints'
  | 'breakage'
  | 'delta'
  | 'operatingProfit'
  | 'cashJournal'

type GlossaryTerm = {
  title: string
  literal: string
  inSystem: string
  onThisPage: string
  scrollTarget?: string
  relatedMetric?: HelpTopic
}

const GLOSSARY: Record<GlossaryTermId, GlossaryTerm> = {
  mint: {
    title: 'Mint',
    literal:
      'To create new money or tokens that did not exist before — like a government printing currency or a casino printing new chips.',
    inSystem:
      'When an admin credits coins, trading coins, or points through Adjust, the platform increases total supply. Those units are written to the ledger as ADJUSTMENT credits. Minting into a registered treasury account grows house inventory (unsold stock). Minting directly to a normal user grows customer float (what we owe them). Minting does not automatically mean a “sale” — only non-promotional credits to customers (or treasury transfers out) count toward imputed revenue.',
    onThisPage:
      'Use Mint / adjust → credit TRADING_COIN on a treasury agent account to stock inventory before selling. Customer-facing mints use the same form with COIN, POINT, or TRADING_COIN.',
    scrollTarget: 'currency-assign',
  },
  adjust: {
    title: 'Adjust (mint / burn)',
    literal:
      'A manual correction or change to a balance — increase (credit) or decrease (debit) — usually done by an operator rather than through normal user activity.',
    inSystem:
      'The admin POST /currency/adjust action. Credit = mint units into a user wallet; debit = claw back units. Supports COIN, TRADING_COIN, and POINT. Optional promotional flag marks free grants as cost, not revenue. The deprecated cashUsd field is ignored — revenue is derived from unit flow, not from typing a dollar amount here.',
    onThisPage:
      'The “Mint / adjust” section and top shortcut button. Every row also appears in Admin adjustments history below.',
    scrollTarget: 'currency-assign',
  },
  units: {
    title: 'Units',
    literal:
      'The smallest countable pieces of value in the system — like chips, points, or coins — before converting to dollars.',
    inSystem:
      'All ledger math is done in integer units: personal coins, agency trading coins, host points, and agency points. The Currency page displays USD using a fixed display rate of 10,000 units = $1. That rate is for reporting consistency; Epay package prices or trading top-up rates may differ from 10,000:1 in the real world.',
    onThisPage: 'Every summary card, table column, and CSV export shows both units and USD.',
  },
  treasury: {
    title: 'Treasury',
    literal:
      'The organization’s central store of unsold product — the vault where inventory sits before it is sold to customers.',
    inSystem:
      'A house account with role TREASURY in ledger_account_roles. It must be an agency agent user (is_agent + Agency row) holding TRADING_COIN inventory. When treasury sends units to a customer via the normal coin-trading transfer flow, that outflow defaults to a SALE for imputed revenue. Transfers can be reclassified as Promo or Write-off. Treasury-to-treasury or treasury-to-company-agency moves are INTERNAL and do not count as sales.',
    onThisPage:
      'Treasury house accounts table, treasury outflows list, and the warning banner when no treasury is registered. Register users here before minting trading coins into them.',
    scrollTarget: 'currency-treasury',
  },
  companyAgency: {
    title: 'Company agency',
    literal:
      'An internal company-owned account that acts like an agency in the product — not an independent third-party agent.',
    inSystem:
      'A house account with role COMPANY_AGENCY. It absorbs BANK payroll takeover inventory when the platform steps in and pays a host because an agent could not. Its balances are house inventory (unsold / internal stock), not customer liability. Outflows to real customers can still count as sales; transfers between house accounts do not.',
    onThisPage:
      'Registered alongside treasury under Treasury house accounts with role “Company agency (payroll takeover)”.',
    scrollTarget: 'currency-treasury',
  },
  houseInventory: {
    title: 'House inventory',
    literal:
      'Stock the company still owns and has not yet sold or given away — assets on your shelf, not debts to customers.',
    inSystem:
      'Sum of coins, trading coins, and points held on all registered house accounts (treasury + company agency). This is unsold inventory. It is excluded from customer float and is not treated as money owed to users.',
    onThisPage:
      'Float at period end → House inventory table, and the hero context under customer float vs house split.',
    scrollTarget: 'currency-inventory',
  },
  float: {
    title: 'Float',
    literal:
      'Money or value sitting in circulation — held by customers but not yet spent, withdrawn, or returned to the issuer. Like unused gift-card balances industry-wide.',
    inSystem:
      'On this page “float” almost always means units currently stored in user wallets across the platform. We split it into customer float (liability to users) and house inventory (our stock). Total economic float in customer hands can rise when users buy or receive rewards faster than they spend, and fall when they spend or cash out.',
    onThisPage:
      'Section “Float at period end” and the sales vs usage check (change in customer units held).',
    scrollTarget: 'currency-inventory',
  },
  customerFloat: {
    title: 'Customer float',
    literal:
      'The total value the platform is still holding on behalf of users — what you would conceptually owe if everyone tried to use their balances at once.',
    inSystem:
      'Sum of personal coins, agency trading coins, host points, and agency points on every user who is not a registered house account. This is a liability, not profit. When customer float increases over a period, users accumulated more units than they consumed or withdrew. It appears on the right side of the sales vs usage reconciliation equation as “change in customer units held”.',
    onThisPage:
      'Float at period end → Customer float (liability) breakdown, hero cards, and reconciliation details in the sales vs usage help.',
    scrollTarget: 'currency-inventory',
    relatedMetric: 'salesVsUsage',
  },
  imputed: {
    title: 'Imputed (revenue / margin)',
    literal:
      'Estimated or assigned by rule rather than measured from an exact cash receipt — “we impute $X because Y units moved, at our standard rate.”',
    inSystem:
      'Revenue is imputed at 10,000 units = $1 from unit flow: treasury sales (default), Epay top-ups, and direct non-promo admin credits to customers. We no longer treat typed cashUsd on mint or cash-journal “money in” rows as revenue (that would double-count). Net imputed margin = gross imputed sales − company fiat payouts − treasury promo/write-off − promotional admin mints.',
    onThisPage:
      'Hero cards Gross unit sales, Company payouts, Net sales margin, and the Imputed unit sales table with revenue and cost lines.',
    scrollTarget: 'currency-imputed',
    relatedMetric: 'grossSales',
  },
  companyFiatPayouts: {
    title: 'Company fiat payouts',
    literal:
      'Real government currency (USD, etc.) that left the company’s bank or payment account — actual cash out the door.',
    inSystem:
      'Recorded as company_cash_entries with direction OUT: EPAY_PAYOUT (platform paid a host via Epay) and PAYROLL_TAKEOVER_PAYOUT (platform paid fiat on a bank payroll when an agent could not). Converted to units at 10,000 = $1 for reporting. Agency-paid bank payroll from an agent’s own balance is not a company payout. These reduce net imputed margin and appear in imputed cost lines.',
    onThisPage:
      'Hero card Company payouts, imputed costs table, and Cash journal (audit) for payout rows. Manual OUT rows can still be recorded in the cash journal.',
    relatedMetric: 'companyPayouts',
  },
  writeOffGrants: {
    title: 'Write-off grants',
    literal:
      'Giving something away with no expectation of payment — writing it off as a loss or marketing expense, like free samples.',
    inSystem:
      'Treasury outflows manually classified as WRITE_OFF (or PROMO for similar free grants). They reduce net imputed margin and operating profit but are not counted as gross sales. Use when units left treasury but were never sold for real consideration.',
    onThisPage:
      'Treasury outflows table → Write-off button on each row. Also aggregated in imputed costs as “Treasury promo / write-off grants”.',
    scrollTarget: 'currency-treasury',
    relatedMetric: 'netSalesMargin',
  },
  promotionalAdminMints: {
    title: 'Promotional admin mints',
    literal:
      'Free credits an operator gives users on purpose — compensation, campaigns, or goodwill — not tied to a purchase.',
    inSystem:
      'Admin Adjust credits with promotional checked (metadata.promotional = true). They increase customer float and count as operating cost. They are excluded from gross unit sales and subtracted in net imputed margin. They partially offset inside the sales vs usage equation because they raise float and lower operating profit by the same amount.',
    onThisPage:
      'Mint / adjust form → “Promotional (operating cost, not a sale)” checkbox. Listed in imputed costs and operating profit help.',
    scrollTarget: 'currency-assign',
    relatedMetric: 'netSalesMargin',
  },
  breakage: {
    title: 'Breakage',
    literal:
      'In accounting, a gap or leak where recorded balances do not match — something is missing, duplicated, or miscounted.',
    inSystem:
      'When Books balanced shows BREAKAGE, wallet balances do not match the master ledger net (identityDelta ≠ 0). This is a data-integrity problem, not a business loss metric. Fix breakage before trusting sales or profit numbers — it usually means a ledger entry failed, a wallet was updated without a matching ledger row, or a manual correction is needed.',
    onThisPage:
      'Hero card Books balanced → OK vs BREAKAGE with Δ units gap. Detailed formula in the card’s (i) help.',
    relatedMetric: 'booksBalanced',
  },
  delta: {
    title: 'Delta (Δ)',
    literal:
      'The difference between two measurements — “how much changed” or “how far off” two numbers are.',
    inSystem:
      'Two deltas appear on this page: (1) identityDelta — wallet vs ledger gap when books are not balanced; (2) reconciliationDelta — leftover imbalance in the sales vs usage equation (gross sales − payouts vs change in customer float + operating profit). A non-zero reconciliation delta often means a treasury account was not registered, a house account was used like a normal user, or classifications are wrong.',
    onThisPage:
      'Subtext under Books balanced and Sales vs usage check hero cards (Δ … units). Full breakdown in sales vs usage help when loaded.',
    relatedMetric: 'salesVsUsage',
  },
  operatingProfit: {
    title: 'Operating profit',
    literal:
      'Profit from running the core business day-to-day — here, from users actually using the product — as opposed to one-time financing or inventory purchases.',
    inSystem:
      'Margin retained when customers spend units inside the app: gifts, calls, subscriptions, store, conversion spread, withdrawal fees, expired coins, etc., minus reward mints, promos, and treasury giveaways. Recognized at consumption time, not when units are first sold. Differs from net imputed margin, which measures sales minus cash out and free grants.',
    onThisPage: 'Hero card Operating profit and the Operating P&L section in the dashboard payload (tables below cards).',
    relatedMetric: 'operatingProfit',
  },
  cashJournal: {
    title: 'Cash journal (audit only)',
    literal:
      'A chronological record of real-world cash moving in or out of the company’s accounts — like a bank statement log.',
    inSystem:
      'company_cash_entries for operator visibility. Under pure imputation, IN rows (agency trading purchase, manual deposits) do not add revenue on this dashboard — revenue comes from unit flow. OUT rows for EPAY and takeover payouts still drive company fiat payout costs. Use the journal to reconcile against bank statements, not as the primary sales figure.',
    onThisPage:
      'Cash journal section at the bottom — list and manual create form. Dashboard cash block is marked recordedOnly in the API.',
    scrollTarget: 'currency-cash',
  },
}

const GLOSSARY_GROUPS: { label: string; terms: GlossaryTermId[] }[] = [
  {
    label: 'Day-to-day operations',
    terms: ['mint', 'adjust', 'treasury', 'companyAgency', 'units'],
  },
  {
    label: 'Balances & inventory',
    terms: ['float', 'customerFloat', 'houseInventory', 'breakage', 'delta'],
  },
  {
    label: 'Revenue & costs',
    terms: [
      'imputed',
      'companyFiatPayouts',
      'writeOffGrants',
      'promotionalAdminMints',
      'operatingProfit',
      'cashJournal',
    ],
  },
]

const glossaryOpen = ref(false)
const activeGlossaryId = ref<GlossaryTermId>('mint')

function openGlossary(term: GlossaryTermId = 'mint') {
  activeGlossaryId.value = term
  glossaryOpen.value = true
}

function openMetricFromGlossary(topic: HelpTopic) {
  glossaryOpen.value = false
  openHelp(topic)
}

const activeGlossary = computed(() => GLOSSARY[activeGlossaryId.value])

const helpOpen = ref(false)
const activeHelpTopic = ref<HelpTopic>('grossSales')

function openHelp(topic: HelpTopic) {
  activeHelpTopic.value = topic
  helpOpen.value = true
}

const activeHelp = computed(() => METRIC_HELP[activeHelpTopic.value])

const supply = ref<AdminCurrencySupplySummary | null>(null)
const supplyLoading = ref(false)
const adjFilters = reactive({
  currency: '' as '' | AdminCurrencyKind,
  direction: '' as '' | 'credit' | 'debit',
})

const periodParams = computed(() => {
  if (grain.value === 'custom') {
    return {
      grain: 'custom' as const,
      from: customFrom.value ? new Date(customFrom.value).toISOString() : undefined,
      to: customTo.value ? new Date(`${customTo.value}T23:59:59.999`).toISOString() : undefined,
    }
  }
  return { grain: grain.value }
})

function formatDt(iso: string) {
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function formatUnits(units: string, id?: string) {
  const n = Number(units)
  if (
    id === 'hostPoints' ||
    id === 'agencyPoints' ||
    id === 'customerHostPoints' ||
    id === 'customerAgencyPoints' ||
    id === 'housePoints'
  ) {
    return formatPoints(n)
  }
  return formatCoins(n)
}

function usdLabel(usd: string) {
  const n = Number(usd)
  return Number.isFinite(n) ? formatUsd(n) : `$${usd}`
}

function formatBucket(kind: 'coins' | 'points' | 'tradingCoins', value: string | undefined) {
  const n = Number(value ?? 0)
  if (kind === 'points') return formatPoints(n)
  return formatCoins(n)
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function exportCsv() {
  const d = dashboard.value
  if (!d) return
  const rows: string[][] = [
    ['Section', 'Line', 'Units', 'USD'],
    ['Period', `${d.period.grain} ${d.period.from} → ${d.period.to}`, '', ''],
    ['1 Imputed', 'Gross unit sales', d.hero.grossSaleUnits, d.hero.grossSaleUsd],
    ['1 Imputed', 'Company payouts', d.hero.companyPayoutUnits, d.hero.companyPayoutUsd],
    ['1 Imputed', 'Net sales margin', d.hero.netImputedMarginUnits, d.hero.netImputedMarginUsd],
    ['1 Imputed', 'Operating profit', d.hero.operatingProfitUnits, d.hero.operatingProfitUsd],
    [
      '1 Checks',
      'Books balanced',
      d.hero.identityOk ? 'OK' : 'BREAKAGE',
      d.hero.identityDelta,
    ],
    [
      '1 Checks',
      'Sales vs usage check',
      d.hero.reconciliationOk ? 'OK' : 'DELTA',
      d.reconciliation.delta,
    ],
    ['2 Customer float', 'Total liability', d.stock.customerFloatUnits, d.stock.customerFloatUsd],
    ['2 House inventory', 'Unsold stock', d.stock.houseInventoryUnits, d.stock.houseInventoryUsd],
  ]
  for (const line of d.stock.customerFloat) {
    rows.push(['2 Customer float', line.label, line.units, line.usd])
  }
  for (const line of d.stock.houseInventory) {
    rows.push(['2 House inventory', line.label, line.units, line.usd])
  }
  for (const line of d.imputed.revenue) {
    rows.push(['3 Imputed revenue', line.label, line.units, line.usd])
  }
  for (const line of d.imputed.costs) {
    rows.push(['3 Imputed cost', line.label, line.units, line.usd])
  }
  for (const line of d.pnl.revenue) {
    rows.push(['4 Operating revenue', line.label, line.units, line.usd])
  }
  for (const line of d.pnl.costs) {
    rows.push(['4 Operating cost', line.label, line.units, line.usd])
  }
  rows.push([
    '4 Operating P&L',
    'Net operating profit',
    d.pnl.operatingProfitUnits,
    d.pnl.operatingProfitUsd,
  ])
  for (const line of d.unitFlow) {
    rows.push(['5 Unit flow memo', line.label, line.units, line.usd])
  }
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `master-ledger-${d.period.grain}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function loadDashboard() {
  loading.value = true
  try {
    const { data } = await currencyApi.ledgerPnl(periodParams.value)
    dashboard.value = data
  } catch (err) {
    dashboard.value = null
    showToast(
      axios.isAxiosError(err) ? err.response?.data?.message || 'Failed to load ledger' : 'Failed to load ledger',
      'error',
    )
  } finally {
    loading.value = false
  }
}

async function loadHouseAccounts() {
  houseLoading.value = true
  try {
    const { data } = await currencyApi.listHouseAccounts({ includeInactive: false })
    houseAccounts.value = data.accounts ?? []
  } catch (err) {
    houseAccounts.value = []
    showToast(
      axios.isAxiosError(err)
        ? err.response?.data?.message || 'Failed to load house accounts'
        : 'Failed to load house accounts',
      'error',
    )
  } finally {
    houseLoading.value = false
  }
}

async function loadTreasuryFlows(append = false) {
  if (append && (!treasuryHasMore.value || !treasuryCursor.value)) return
  treasuryLoading.value = true
  try {
    const { data } = await currencyApi.listTreasuryFlows({
      ...windowParams(),
      cursor: append ? treasuryCursor.value ?? undefined : undefined,
      limit: 20,
    })
    treasuryFlows.value = append
      ? [...treasuryFlows.value, ...(data.entries ?? [])]
      : data.entries ?? []
    treasuryCursor.value = data.nextCursor
    treasuryHasMore.value = Boolean(data.hasMore)
  } catch (err) {
    if (!append) treasuryFlows.value = []
    showToast(
      axios.isAxiosError(err)
        ? err.response?.data?.message || 'Failed to load treasury flows'
        : 'Failed to load treasury flows',
      'error',
    )
  } finally {
    treasuryLoading.value = false
  }
}

async function loadCash(append = false) {
  if (append && (!cashHasMore.value || !cashCursor.value)) return
  cashLoading.value = true
  try {
    const { data } = await currencyApi.listCashJournal({
      ...windowParams(),
      cursor: append ? cashCursor.value ?? undefined : undefined,
      limit: 20,
    })
    cashEntries.value = append ? [...cashEntries.value, ...(data.entries ?? [])] : data.entries ?? []
    cashCursor.value = data.nextCursor
    cashHasMore.value = Boolean(data.hasMore)
  } catch (err) {
    if (!append) cashEntries.value = []
    showToast(
      axios.isAxiosError(err)
        ? err.response?.data?.message || 'Failed to load cash journal'
        : 'Failed to load cash journal',
      'error',
    )
  } finally {
    cashLoading.value = false
  }
}

async function loadAdjustments(append = false) {
  if (append && (!adjHasMore.value || !adjCursor.value)) return
  adjLoading.value = true
  try {
    const { data } = await currencyApi.listAdjustments({
      ...windowParams(),
      currency: adjFilters.currency || undefined,
      direction: adjFilters.direction || undefined,
      userId: form.userId || undefined,
      cursor: append ? adjCursor.value ?? undefined : undefined,
      limit: 20,
    })
    adjustments.value = append ? [...adjustments.value, ...(data.entries ?? [])] : data.entries ?? []
    adjCursor.value = data.nextCursor
    adjHasMore.value = Boolean(data.hasMore)
  } catch (err) {
    if (!append) adjustments.value = []
    showToast(
      axios.isAxiosError(err)
        ? err.response?.data?.message || 'Failed to load adjustments'
        : 'Failed to load adjustments',
      'error',
    )
  } finally {
    adjLoading.value = false
  }
}

async function loadSupply() {
  supplyLoading.value = true
  try {
    const { data } = await currencyApi.supplySummary(windowParams())
    supply.value = data
  } catch (err) {
    supply.value = null
    showToast(
      axios.isAxiosError(err) ? err.response?.data?.message || 'Failed to load supply' : 'Failed to load supply',
      'error',
    )
  } finally {
    supplyLoading.value = false
  }
}

async function refreshAll() {
  await loadDashboard()
  await Promise.all([
    loadCash(false),
    loadAdjustments(false),
    loadSupply(),
    loadHouseAccounts(),
    loadTreasuryFlows(false),
  ])
}

function windowParams() {
  const p = dashboard.value?.period
  if (p) return { from: p.from, to: p.to }
  return periodParams.value
}

async function searchUsers() {
  if (!includeNonTreasuryUsers.value) return
  const q = form.userQuery.trim()
  if (!q) {
    searchHits.value = []
    return
  }
  searching.value = true
  try {
    const { data } = await userAdminApi.searchUsers(q, 'auto', 10)
    searchHits.value = data.users ?? []
  } catch {
    searchHits.value = []
  } finally {
    searching.value = false
  }
}

function treasuryAccountLabel(acc: HouseAccountEntry): string {
  const name = acc.user.name || acc.user.displayName || acc.user.username
  const tag = acc.label ? `${acc.label} · ` : ''
  return `${tag}${name} (#${acc.user.publicId})`
}

function applyTreasurySelection(userId: string) {
  const acc = treasuryHouseAccounts.value.find((a) => a.userId === userId)
  if (!acc) return
  form.userId = acc.userId
  form.userLabel = treasuryAccountLabel(acc)
  selectedTreasuryUserId.value = userId
  form.userQuery = ''
  searchHits.value = []
  if (form.direction === 'credit') {
    form.currency = 'TRADING_COIN'
  }
  void loadAdjustments(false)
}

function onTreasuryDropdownChange() {
  if (!selectedTreasuryUserId.value) {
    clearSelectedUser()
    return
  }
  applyTreasurySelection(selectedTreasuryUserId.value)
}

function onIncludeNonTreasuryChange() {
  if (includeNonTreasuryUsers.value) return
  form.userQuery = ''
  searchHits.value = []
  if (treasuryHouseAccounts.value.length) {
    const id =
      selectedTreasuryUserId.value &&
      treasuryHouseAccounts.value.some((a) => a.userId === selectedTreasuryUserId.value)
        ? selectedTreasuryUserId.value
        : treasuryHouseAccounts.value[0]!.userId
    applyTreasurySelection(id)
  } else {
    clearSelectedUser()
  }
}

async function searchHouseUsers() {
  const q = houseForm.userQuery.trim()
  if (!q) {
    houseSearchHits.value = []
    return
  }
  houseSearching.value = true
  try {
    const { data } = await userAdminApi.searchUsers(q, 'auto', 10)
    houseSearchHits.value = data.users ?? []
  } catch {
    houseSearchHits.value = []
  } finally {
    houseSearching.value = false
  }
}

function pickUser(hit: UserSearchItem) {
  const id = hit.userId
  if (!id) return
  form.userId = id
  form.userLabel = [hit.name, hit.username, hit.publicId].filter(Boolean).join(' · ')
  form.userQuery = form.userLabel
  searchHits.value = []
  selectedTreasuryUserId.value = treasuryHouseAccounts.value.some((a) => a.userId === id) ? id : ''
  void loadAdjustments(false)
}

function pickHouseUser(hit: UserSearchItem) {
  const id = hit.userId
  if (!id) return
  houseForm.userId = id
  houseForm.userLabel = [hit.name, hit.username, hit.publicId].filter(Boolean).join(' · ')
  houseForm.userQuery = houseForm.userLabel
  houseSearchHits.value = []
}

function clearSelectedUser() {
  form.userId = ''
  form.userLabel = ''
  form.userQuery = ''
  searchHits.value = []
  selectedTreasuryUserId.value = ''
  void loadAdjustments(false)
}

async function submitAdjust() {
  if (!form.userId) {
    showToast('Select a user first', 'error')
    return
  }
  if (!/^\d+$/.test(form.amount) || BigInt(form.amount) <= 0n) {
    showToast('Enter a positive integer amount', 'error')
    return
  }
  submitting.value = true
  try {
    await currencyApi.adjust({
      userId: form.userId,
      currency: form.currency,
      direction: form.direction,
      amount: form.amount,
      description: form.description.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
      forceTradingCredit:
        form.currency === 'TRADING_COIN' && form.direction === 'credit'
          ? form.forceTradingCredit
          : undefined,
      promotional: form.promotional || undefined,
    })
    showToast(
      `${form.direction === 'credit' ? 'Issued' : 'Returned'} ${form.amount} ${form.currency}`,
      'success',
    )
    form.amount = ''
    form.description = ''
    await refreshAll()
  } catch (err) {
    showToast(
      axios.isAxiosError(err) ? err.response?.data?.message || 'Adjust failed' : 'Adjust failed',
      'error',
    )
  } finally {
    submitting.value = false
  }
}

async function submitHouseAccount() {
  if (!houseForm.userId) {
    showToast('Select a user for the house account', 'error')
    return
  }
  houseSubmitting.value = true
  try {
    await currencyApi.upsertHouseAccount({
      userId: houseForm.userId,
      role: houseForm.role,
      label: houseForm.label.trim() || undefined,
      note: houseForm.note.trim() || undefined,
    })
    showToast('House account registered', 'success')
    houseForm.label = ''
    houseForm.note = ''
    await refreshAll()
  } catch (err) {
    showToast(
      axios.isAxiosError(err)
        ? err.response?.data?.message || 'Failed to register house account'
        : 'Failed to register house account',
      'error',
    )
  } finally {
    houseSubmitting.value = false
  }
}

async function classifyFlow(
  flow: TreasuryFlowEntry,
  classification: 'SALE' | 'PROMO' | 'WRITE_OFF',
) {
  if (flow.locked) return
  classifySubmitting.value = flow.flowId
  try {
    await currencyApi.classifyTreasuryFlow({
      flowKind: flow.flowKind,
      flowId: flow.flowId,
      classification,
    })
    showToast(`Flow marked ${classification}`, 'success')
    await Promise.all([loadDashboard(), loadTreasuryFlows(false)])
  } catch (err) {
    showToast(
      axios.isAxiosError(err) ? err.response?.data?.message || 'Classify failed' : 'Classify failed',
      'error',
    )
  } finally {
    classifySubmitting.value = null
  }
}

async function submitCash() {
  if (!cashForm.amountUsd || Number(cashForm.amountUsd) <= 0) {
    showToast('Enter a positive USD amount', 'error')
    return
  }
  cashSubmitting.value = true
  try {
    await currencyApi.createCashJournal({
      direction: cashForm.direction,
      reason: cashForm.reason,
      amountUsd: cashForm.amountUsd,
      description: cashForm.description?.trim() || undefined,
    })
    showToast('Cash journal row saved', 'success')
    cashForm.amountUsd = ''
    cashForm.description = ''
    await refreshAll()
  } catch (err) {
    showToast(
      axios.isAxiosError(err) ? err.response?.data?.message || 'Cash journal failed' : 'Cash journal failed',
      'error',
    )
  } finally {
    cashSubmitting.value = false
  }
}

watch(grain, () => {
  void refreshAll()
})

watch(treasuryHouseAccounts, (list) => {
  if (includeNonTreasuryUsers.value || !list.length) return
  if (!form.userId || !list.some((a) => a.userId === form.userId)) {
    applyTreasurySelection(list[0]!.userId)
  } else if (!selectedTreasuryUserId.value) {
    selectedTreasuryUserId.value = form.userId
  }
})

onMounted(() => {
  void refreshAll()
})

const hero = computed(() => dashboard.value?.hero ?? null)
const customerFloat = computed<LedgerLine[]>(() => dashboard.value?.stock.customerFloat ?? [])
const houseInventory = computed<LedgerLine[]>(() => dashboard.value?.stock.houseInventory ?? [])
const imputedRevenue = computed<LedgerLine[]>(() => dashboard.value?.imputed.revenue ?? [])
const imputedCosts = computed<LedgerLine[]>(() => dashboard.value?.imputed.costs ?? [])
const revenue = computed<LedgerLine[]>(() => dashboard.value?.pnl.revenue ?? [])
const costs = computed<LedgerLine[]>(() => dashboard.value?.pnl.costs ?? [])
const unitFlow = computed<LedgerLine[]>(() => dashboard.value?.unitFlow ?? [])
const reconciliation = computed(() => dashboard.value?.reconciliation ?? null)

const treasuryNotConfigured = computed(() => {
  if (loading.value) return false
  return hero.value?.treasuryConfigured === false
})

async function scrollToSection(id: string) {
  helpOpen.value = false
  glossaryOpen.value = false
  await nextTick()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function jumpFromGlossary(target: string) {
  glossaryOpen.value = false
  await scrollToSection(target)
}

const CASH_REASONS: { value: CompanyCashReason; label: string }[] = [
  { value: 'AGENCY_TRADING_PURCHASE', label: 'Agency trading purchase' },
  { value: 'EPAY_PAYOUT', label: 'EPAY payout' },
  { value: 'PAYROLL_TAKEOVER_PAYOUT', label: 'Payroll takeover payout' },
]
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-semibold sm:text-2xl">Currency</h1>
          <button
            type="button"
            class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-admin-border text-xs font-semibold text-admin-subtext hover:border-admin-accent hover:text-admin-accent"
            aria-label="Currency concepts glossary"
            title="Currency concepts glossary — mint, float, imputed revenue, and more"
            @click="openGlossary('mint')"
          >
            i
          </button>
        </div>
        <p class="mt-1 text-sm text-admin-subtext">
          Mint into registered treasury accounts, then sell via normal trading transfers. Revenue is
          imputed at 10,000 units = $1. Customer float is a liability; house inventory is not.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="admin-btn-primary text-sm" @click="scrollToSection('currency-assign')">
          Mint / adjust
        </button>
        <button type="button" class="admin-btn-secondary text-sm" :disabled="!dashboard" @click="exportCsv">
          Export CSV
        </button>
        <button type="button" class="admin-btn-secondary text-sm" :disabled="loading" @click="refreshAll">
          Refresh
        </button>
      </div>
    </div>

    <div class="admin-filter-bar">
      <button
        v-for="g in (['month', 'quarter', 'year', 'custom'] as LedgerGrain[])"
        :key="g"
        type="button"
        class="admin-btn-secondary text-sm capitalize"
        :class="grain === g ? '!border-admin-accent text-admin-accent' : ''"
        @click="grain = g"
      >
        {{ g === 'custom' ? 'Custom' : `This ${g}` }}
      </button>
      <template v-if="grain === 'custom'">
        <input v-model="customFrom" type="date" class="admin-input" title="From" />
        <input v-model="customTo" type="date" class="admin-input" title="To" />
        <button type="button" class="admin-btn-primary text-sm" @click="refreshAll">Apply</button>
      </template>
      <p v-if="dashboard" class="text-xs text-admin-subtext">
        {{ formatDt(dashboard.period.from) }} → {{ formatDt(dashboard.period.to) }}
      </p>
    </div>

    <div class="admin-stats-grid">
      <div class="admin-card !p-3 text-left">
        <p class="flex items-center justify-between text-xs text-admin-subtext">
          Gross unit sales
          <button
            type="button"
            class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-admin-border text-[10px] font-semibold hover:border-admin-accent hover:text-admin-accent"
            aria-label="What is gross unit sales?"
            @click="openHelp('grossSales')"
          >
            i
          </button>
        </p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ loading ? '…' : usdLabel(hero?.grossSaleUsd ?? hero?.capitalInUsd ?? '0') }}
        </p>
        <p class="text-xs text-admin-muted tabular-nums">
          {{ loading ? '' : formatCoins(Number(hero?.grossSaleUnits ?? 0)) }} units
        </p>
      </div>
      <div class="admin-card !p-3 text-left">
        <p class="flex items-center justify-between text-xs text-admin-subtext">
          Company payouts
          <button
            type="button"
            class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-admin-border text-[10px] font-semibold hover:border-admin-accent hover:text-admin-accent"
            aria-label="What are company payouts?"
            @click="openHelp('companyPayouts')"
          >
            i
          </button>
        </p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ loading ? '…' : usdLabel(hero?.companyPayoutUsd ?? hero?.cashOutUsd ?? '0') }}
        </p>
      </div>
      <div class="admin-card !p-3 text-left">
        <p class="flex items-center justify-between text-xs text-admin-subtext">
          Net sales margin
          <button
            type="button"
            class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-admin-border text-[10px] font-semibold hover:border-admin-accent hover:text-admin-accent"
            aria-label="What is net sales margin?"
            @click="openHelp('netSalesMargin')"
          >
            i
          </button>
        </p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ loading ? '…' : usdLabel(hero?.netImputedMarginUsd ?? hero?.cashProfitUsd ?? '0') }}
        </p>
      </div>
      <div class="admin-card !p-3 text-left">
        <p class="flex items-center justify-between text-xs text-admin-subtext">
          Operating profit
          <button
            type="button"
            class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-admin-border text-[10px] font-semibold hover:border-admin-accent hover:text-admin-accent"
            aria-label="What is operating profit?"
            @click="openHelp('operatingProfit')"
          >
            i
          </button>
        </p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ loading ? '…' : usdLabel(hero?.operatingProfitUsd ?? '0') }}
        </p>
        <p class="text-xs text-admin-muted tabular-nums">
          {{ loading ? '' : formatCoins(Number(hero?.operatingProfitUnits ?? 0)) }} units
        </p>
      </div>
      <div class="admin-card !p-3 text-left">
        <p class="flex items-center justify-between text-xs text-admin-subtext">
          Books balanced
          <button
            type="button"
            class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-admin-border text-[10px] font-semibold hover:border-admin-accent hover:text-admin-accent"
            aria-label="What does books balanced mean?"
            @click="openHelp('booksBalanced')"
          >
            i
          </button>
        </p>
        <p
          class="mt-1 text-xl font-semibold"
          :class="hero?.identityOk === false ? 'text-admin-warn' : 'text-admin-success'"
        >
          {{ loading ? '…' : hero?.identityOk ? 'OK' : 'BREAKAGE' }}
        </p>
        <p class="text-xs text-admin-muted tabular-nums">
          Δ {{ loading || !hero ? '…' : hero.identityDelta }} units
        </p>
      </div>
      <div class="admin-card !p-3 text-left">
        <p class="flex items-center justify-between text-xs text-admin-subtext">
          Sales vs usage check
          <button
            type="button"
            class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-admin-border text-[10px] font-semibold hover:border-admin-accent hover:text-admin-accent"
            aria-label="What is the sales vs usage check?"
            @click="openHelp('salesVsUsage')"
          >
            i
          </button>
        </p>
        <p
          class="mt-1 text-xl font-semibold"
          :class="hero?.reconciliationOk === false ? 'text-admin-warn' : 'text-admin-success'"
        >
          {{ loading ? '…' : hero?.reconciliationOk ? 'OK' : 'DELTA' }}
        </p>
        <p class="text-xs text-admin-muted tabular-nums">
          Δ {{ loading || !hero ? '…' : hero.reconciliationDelta }} units
        </p>
      </div>
    </div>

    <p
      v-if="treasuryNotConfigured"
      class="rounded-md border border-admin-warn/40 bg-admin-warn/10 px-3 py-2 text-sm text-admin-subtext"
    >
      No treasury accounts are registered yet. Gross unit sales will be
      <span class="font-medium text-admin-text">$0</span> until you register management app accounts
      below and mint trading coins into them. Sales are counted when those accounts transfer units to
      customers.
    </p>

    <section id="currency-treasury" class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Treasury house accounts</h2>
      <p class="text-xs text-admin-subtext">
        Register agency app accounts that hold unsold inventory. Mint trading coins into them via
        Adjust below, then sell to users through the normal coin-trading transfer flow in the app.
      </p>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Label</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="acc in houseAccounts" :key="acc.id">
              <td>
                <p class="text-sm">{{ acc.user.name || acc.user.displayName }}</p>
                <p class="text-xs text-admin-muted">#{{ acc.user.publicId }}</p>
              </td>
              <td>{{ acc.role }}</td>
              <td class="text-xs">{{ acc.label || '—' }}</td>
              <td class="whitespace-nowrap text-xs">{{ formatDt(acc.effectiveFrom) }}</td>
            </tr>
            <tr v-if="houseLoading && !houseAccounts.length">
              <td colspan="4" class="py-6 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!houseAccounts.length">
              <td colspan="4" class="py-6 text-center text-admin-muted">No house accounts registered</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="relative">
        <input
          v-model="houseForm.userQuery"
          type="search"
          class="admin-input w-full"
          placeholder="Search user to register as house account…"
          @keydown.enter.prevent="searchHouseUsers"
          @input="searchHouseUsers"
        />
        <div
          v-if="houseSearchHits.length"
          class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-admin-border bg-admin-surface shadow-lg"
        >
          <button
            v-for="hit in houseSearchHits"
            :key="hit.userId"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-admin-bg"
            @click="pickHouseUser(hit)"
          >
            <span class="font-medium">{{ hit.name || hit.username }}</span>
            <span class="text-xs text-admin-muted">#{{ hit.publicId }}</span>
          </button>
        </div>
        <p v-if="houseForm.userId" class="mt-1 text-xs text-admin-subtext">
          Register: {{ houseForm.userLabel }}
        </p>
      </div>
      <div class="grid gap-2 sm:grid-cols-3">
        <select v-model="houseForm.role" class="admin-input">
          <option value="TREASURY">Treasury (sales inventory)</option>
          <option value="COMPANY_AGENCY">Company agency (takeover)</option>
        </select>
        <input v-model="houseForm.label" class="admin-input" placeholder="Label (optional)" />
        <input v-model="houseForm.note" class="admin-input" placeholder="Note (optional)" />
      </div>
      <button type="button" class="admin-btn-primary" :disabled="houseSubmitting" @click="submitHouseAccount">
        {{ houseSubmitting ? 'Saving…' : 'Register house account' }}
      </button>

      <h3 class="pt-2 text-sm font-semibold">Treasury outflows (sales)</h3>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>From → To</th>
              <th>Units</th>
              <th>Class</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="flow in treasuryFlows" :key="`${flow.flowKind}:${flow.flowId}`">
              <td class="whitespace-nowrap text-xs">{{ formatDt(flow.createdAt) }}</td>
              <td class="text-xs">
                {{ flow.sender?.name || '—' }} → {{ flow.recipient?.name || '—' }}
                <span v-if="flow.reversedAt" class="ml-1 text-admin-warn">(reversed)</span>
              </td>
              <td class="tabular-nums font-semibold">{{ formatCoins(Number(flow.units)) }}</td>
              <td>
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-admin-bg">
                  {{ flow.classification }}
                </span>
              </td>
              <td class="text-xs">
                <template v-if="!flow.locked && flow.classification !== 'INTERNAL'">
                  <button
                    type="button"
                    class="text-admin-accent underline disabled:opacity-50"
                    :disabled="classifySubmitting === flow.flowId"
                    @click="classifyFlow(flow, 'SALE')"
                  >
                    Sale
                  </button>
                  <button
                    type="button"
                    class="ml-2 text-admin-accent underline disabled:opacity-50"
                    :disabled="classifySubmitting === flow.flowId"
                    @click="classifyFlow(flow, 'PROMO')"
                  >
                    Promo
                  </button>
                  <button
                    type="button"
                    class="ml-2 text-admin-accent underline disabled:opacity-50"
                    :disabled="classifySubmitting === flow.flowId"
                    @click="classifyFlow(flow, 'WRITE_OFF')"
                  >
                    Write-off
                  </button>
                </template>
                <span v-else class="text-admin-muted">—</span>
              </td>
            </tr>
            <tr v-if="treasuryLoading && !treasuryFlows.length">
              <td colspan="5" class="py-6 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!treasuryFlows.length">
              <td colspan="5" class="py-6 text-center text-admin-muted">No treasury outflows in this period</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button
        v-if="treasuryHasMore"
        type="button"
        class="admin-btn-secondary"
        :disabled="treasuryLoading"
        @click="loadTreasuryFlows(true)"
      >
        Load more
      </button>
    </section>

    <section id="currency-assign" class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Mint / adjust in-app currency</h2>
      <p class="text-xs text-admin-subtext">
        Credit treasury accounts with trading coins (inventory), or adjust customer wallets directly.
        Promotional credits count as operating cost, not revenue.
      </p>

      <div class="admin-stats-grid">
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">Created · Coins</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{ supplyLoading ? '…' : formatBucket('coins', supply?.created.coins) }}
          </p>
        </div>
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">Created · Points</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{ supplyLoading ? '…' : formatBucket('points', supply?.created.points) }}
          </p>
        </div>
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">Created · Trading</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{ supplyLoading ? '…' : formatBucket('tradingCoins', supply?.created.tradingCoins) }}
          </p>
        </div>
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">Returned · Coins</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{ supplyLoading ? '…' : formatBucket('coins', supply?.returned.coins) }}
          </p>
        </div>
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">Returned · Points</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{ supplyLoading ? '…' : formatBucket('points', supply?.returned.points) }}
          </p>
        </div>
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">Returned · Trading</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{ supplyLoading ? '…' : formatBucket('tradingCoins', supply?.returned.tradingCoins) }}
          </p>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-[min(100%,280px)] flex-1">
            <label class="mb-1 block text-xs text-admin-subtext">Treasury account</label>
            <select
              v-model="selectedTreasuryUserId"
              class="admin-input w-full"
              :disabled="includeNonTreasuryUsers && Boolean(form.userId) && !selectedTreasuryUserId"
              @change="onTreasuryDropdownChange"
            >
              <option value="">
                {{ treasuryHouseAccounts.length ? 'Select treasury account…' : 'No treasury accounts registered' }}
              </option>
              <option v-for="acc in treasuryHouseAccounts" :key="acc.userId" :value="acc.userId">
                {{ treasuryAccountLabel(acc) }}
              </option>
            </select>
          </div>
          <label class="flex items-center gap-2 pb-2 text-sm text-admin-subtext">
            <input
              v-model="includeNonTreasuryUsers"
              type="checkbox"
              @change="onIncludeNonTreasuryChange"
            />
            Include non-treasury users
          </label>
        </div>

        <p
          v-if="!includeNonTreasuryUsers && !treasuryHouseAccounts.length"
          class="text-xs text-admin-warn"
        >
          Register a treasury account above, or enable non-treasury search to mint into any user.
        </p>

        <div v-if="includeNonTreasuryUsers" class="relative">
          <input
            v-model="form.userQuery"
            type="search"
            class="admin-input w-full"
            placeholder="Search user by name, username, or public ID…"
            @keydown.enter.prevent="searchUsers"
            @input="searchUsers"
          />
          <div
            v-if="searchHits.length"
            class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-admin-border bg-admin-surface shadow-lg"
          >
            <button
              v-for="hit in searchHits"
              :key="hit.userId"
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-admin-bg"
              @click="pickUser(hit)"
            >
              <span class="font-medium">{{ hit.name || hit.username }}</span>
              <span class="text-xs text-admin-muted">#{{ hit.publicId }}</span>
            </button>
          </div>
          <p v-if="searching" class="mt-1 text-xs text-admin-muted">Searching…</p>
        </div>

        <p v-if="form.userId" class="text-xs text-admin-subtext">
          Assign to: {{ form.userLabel }}
          <span
            v-if="selectedTreasuryUserId && selectedTreasuryUserId === form.userId"
            class="ml-1 rounded bg-admin-bg px-1.5 py-0.5 text-[10px] uppercase text-admin-muted"
          >
            Treasury
          </span>
          <RouterLink class="ml-2 text-admin-accent underline" :to="`/admin/users/${form.userId}`">
            Open profile
          </RouterLink>
          <button type="button" class="ml-2 text-admin-accent underline" @click="clearSelectedUser">
            Clear
          </button>
        </p>
      </div>

      <div class="grid gap-2 sm:grid-cols-4">
        <select v-model="form.currency" class="admin-input">
          <option value="COIN">Personal coins</option>
          <option value="POINT">Points</option>
          <option value="TRADING_COIN">Trading coins</option>
        </select>
        <select v-model="form.direction" class="admin-input">
          <option value="credit">Create (credit)</option>
          <option value="debit">Return (debit)</option>
        </select>
        <input v-model="form.amount" type="text" inputmode="numeric" class="admin-input" placeholder="Amount" />
        <input v-model="form.description" type="text" class="admin-input" placeholder="Reason (optional)" />
      </div>
      <label
        v-if="form.direction === 'credit'"
        class="flex items-center gap-2 text-sm text-admin-subtext"
      >
        <input v-model="form.promotional" type="checkbox" />
        Promotional (operating cost, not a sale)
      </label>
      <label
        v-if="form.currency === 'TRADING_COIN' && form.direction === 'credit'"
        class="flex items-center gap-2 text-sm text-admin-subtext"
      >
        <input v-model="form.forceTradingCredit" type="checkbox" />
        Force trading credit (even if user is not an agency agent)
      </label>
      <button type="button" class="admin-btn-primary" :disabled="submitting" @click="submitAdjust">
        {{ submitting ? 'Submitting…' : form.direction === 'credit' ? 'Create currency' : 'Return currency' }}
      </button>

      <div class="admin-filter-bar">
        <select v-model="adjFilters.currency" class="admin-input">
          <option value="">All currencies</option>
          <option value="COIN">Coins</option>
          <option value="POINT">Points</option>
          <option value="TRADING_COIN">Trading</option>
        </select>
        <select v-model="adjFilters.direction" class="admin-input">
          <option value="">All directions</option>
          <option value="credit">Created</option>
          <option value="debit">Returned</option>
        </select>
        <button type="button" class="admin-btn-primary text-sm" :disabled="adjLoading" @click="loadAdjustments(false)">
          Apply
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Currency</th>
              <th>Effect</th>
              <th>Amount</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in adjustments" :key="row.id">
              <td class="whitespace-nowrap text-xs">{{ formatDt(row.createdAt) }}</td>
              <td>
                <p class="text-sm">{{ row.user.name || row.user.displayName || row.user.username }}</p>
                <p class="text-xs text-admin-muted">#{{ row.user.displayPublicId || row.user.publicId }}</p>
              </td>
              <td>{{ row.currency }}</td>
              <td>
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    row.supplyEffect === 'created'
                      ? 'bg-admin-success/15 text-admin-success'
                      : 'bg-admin-warn/15 text-admin-warn'
                  "
                >
                  {{ row.supplyEffect }}
                </span>
              </td>
              <td class="tabular-nums font-semibold">
                {{
                  row.currency === 'POINT'
                    ? formatPoints(Number(row.amount))
                    : formatCoins(Number(row.amount))
                }}
              </td>
              <td class="text-xs text-admin-subtext">{{ row.description || '—' }}</td>
            </tr>
            <tr v-if="adjLoading && !adjustments.length">
              <td colspan="6" class="py-8 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!adjustments.length">
              <td colspan="6" class="py-8 text-center text-admin-muted">No adjustments in this period</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button
        v-if="adjHasMore"
        type="button"
        class="admin-btn-secondary"
        :disabled="adjLoading"
        @click="loadAdjustments(true)"
      >
        Load more
      </button>
    </section>

    <section id="currency-inventory" class="admin-card space-y-4">
      <h2 class="text-sm font-semibold">Float at period end</h2>
      <div>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
          Customer float (liability)
        </h3>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Units</th>
                <th>USD</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in customerFloat" :key="row.id">
                <td>{{ row.label }}</td>
                <td class="tabular-nums font-semibold">{{ formatUnits(row.units, row.id) }}</td>
                <td class="tabular-nums">{{ usdLabel(row.usd) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
          House inventory (not a liability)
        </h3>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Units</th>
                <th>USD</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in houseInventory" :key="row.id">
                <td>{{ row.label }}</td>
                <td class="tabular-nums font-semibold">{{ formatUnits(row.units, row.id) }}</td>
                <td class="tabular-nums">{{ usdLabel(row.usd) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="currency-imputed" class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Imputed unit sales</h2>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>Units</th>
              <th>USD</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in imputedRevenue" :key="row.id">
              <td>{{ row.label }}</td>
              <td class="tabular-nums font-semibold">{{ formatCoins(Number(row.units)) }}</td>
              <td class="tabular-nums">{{ usdLabel(row.usd) }}</td>
            </tr>
            <tr v-for="row in imputedCosts" :key="row.id">
              <td>{{ row.label }}</td>
              <td class="tabular-nums font-semibold">{{ formatCoins(Number(row.units)) }}</td>
              <td class="tabular-nums">{{ usdLabel(row.usd) }}</td>
            </tr>
            <tr v-if="dashboard">
              <td class="font-semibold">Net sales margin</td>
              <td class="tabular-nums font-semibold">
                {{ formatCoins(Number(dashboard.imputed.netMarginUnits)) }}
              </td>
              <td class="tabular-nums font-semibold">{{ usdLabel(dashboard.imputed.netMarginUsd) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="currency-pnl" class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Operating P&amp;L (consumption)</h2>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>Units</th>
              <th>USD</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in revenue" :key="row.id">
              <td>{{ row.label }}</td>
              <td class="tabular-nums font-semibold">{{ formatCoins(Number(row.units)) }}</td>
              <td class="tabular-nums">{{ usdLabel(row.usd) }}</td>
            </tr>
            <tr v-for="row in costs" :key="row.id">
              <td>{{ row.label }}</td>
              <td class="tabular-nums font-semibold">{{ formatCoins(Number(row.units)) }}</td>
              <td class="tabular-nums">{{ usdLabel(row.usd) }}</td>
            </tr>
            <tr v-if="dashboard">
              <td class="font-semibold">Net operating profit</td>
              <td class="tabular-nums font-semibold">
                {{ formatCoins(Number(dashboard.pnl.operatingProfitUnits)) }}
              </td>
              <td class="tabular-nums font-semibold">{{ usdLabel(dashboard.pnl.operatingProfitUsd) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="currency-unit-flow" class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Where units went (memo)</h2>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>Units</th>
              <th>USD</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in unitFlow" :key="row.id">
              <td>{{ row.label }}</td>
              <td class="tabular-nums font-semibold">{{ formatCoins(Number(row.units)) }}</td>
              <td class="tabular-nums">{{ usdLabel(row.usd) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="currency-cash" class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Cash journal (audit only)</h2>
      <p class="text-xs text-admin-subtext">
        Recorded fiat rows are kept for audit. Under pure imputation they are
        <span class="font-medium text-admin-text">not</span> counted in gross sales — revenue comes from
        unit flow at 10,000 = $1.
      </p>
      <div class="grid gap-2 sm:grid-cols-4">
        <select v-model="cashForm.direction" class="admin-input">
          <option value="IN">In (capital)</option>
          <option value="OUT">Out (payout)</option>
        </select>
        <select v-model="cashForm.reason" class="admin-input">
          <option v-for="r in CASH_REASONS" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
        <input v-model="cashForm.amountUsd" class="admin-input" placeholder="USD amount" />
        <input v-model="cashForm.description" class="admin-input" placeholder="Note (optional)" />
      </div>
      <button type="button" class="admin-btn-primary" :disabled="cashSubmitting" @click="submitCash">
        {{ cashSubmitting ? 'Saving…' : 'Add cash row' }}
      </button>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Dir</th>
              <th>Reason</th>
              <th>USD</th>
              <th>Counterparty</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cashEntries" :key="row.id">
              <td class="whitespace-nowrap text-xs">{{ formatDt(row.createdAt) }}</td>
              <td>{{ row.direction }}</td>
              <td class="text-xs">{{ row.reason }}</td>
              <td class="tabular-nums font-semibold">{{ usdLabel(row.amountUsdDisplay) }}</td>
              <td class="text-xs">
                {{ row.counterparty ? `${row.counterparty.name} #${row.counterparty.publicId}` : '—' }}
              </td>
              <td class="text-xs text-admin-subtext">{{ row.description || '—' }}</td>
            </tr>
            <tr v-if="cashLoading && !cashEntries.length">
              <td colspan="6" class="py-8 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!cashEntries.length">
              <td colspan="6" class="py-8 text-center text-admin-muted">No cash rows in this period</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button
        v-if="cashHasMore"
        type="button"
        class="admin-btn-secondary"
        :disabled="cashLoading"
        @click="loadCash(true)"
      >
        Load more
      </button>
    </section>

    <BaseDialog
      title="Currency concepts"
      :open="glossaryOpen"
      size="lg"
      @close="glossaryOpen = false"
    >
      <template #body>
        <p class="text-sm text-admin-subtext">
          Plain-language definitions for terms used on this page. Each entry has a general meaning and
          how we apply it in the treasury imputed ledger.
        </p>

        <div class="mt-4 space-y-3">
          <div v-for="group in GLOSSARY_GROUPS" :key="group.label">
            <p class="text-xs font-semibold uppercase tracking-wide text-admin-muted">{{ group.label }}</p>
            <div class="mt-1 flex flex-wrap gap-1">
              <button
                v-for="termId in group.terms"
                :key="termId"
                type="button"
                class="rounded-md border px-2 py-1 text-xs"
                :class="
                  termId === activeGlossaryId
                    ? 'border-admin-accent text-admin-accent'
                    : 'border-admin-border text-admin-subtext hover:text-admin-text'
                "
                @click="activeGlossaryId = termId"
              >
                {{ GLOSSARY[termId].title }}
              </button>
            </div>
          </div>
        </div>

        <h2 class="mt-5 text-base font-semibold text-admin-text">{{ activeGlossary.title }}</h2>

        <section class="mt-3 space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-admin-subtext">
            Literal meaning
          </h3>
          <p class="text-sm leading-relaxed text-admin-text">{{ activeGlossary.literal }}</p>
        </section>

        <section class="mt-4 space-y-2 rounded-md bg-admin-bg px-3 py-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-admin-subtext">
            In our system
          </h3>
          <p class="text-sm leading-relaxed text-admin-text">{{ activeGlossary.inSystem }}</p>
        </section>

        <section class="mt-4 space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-admin-subtext">
            On this page
          </h3>
          <p class="text-sm leading-relaxed text-admin-subtext">{{ activeGlossary.onThisPage }}</p>
          <div v-if="activeGlossary.scrollTarget || activeGlossary.relatedMetric" class="flex flex-wrap gap-2 pt-1">
            <button
              v-if="activeGlossary.scrollTarget"
              type="button"
              class="admin-btn-secondary text-xs"
              @click="jumpFromGlossary(activeGlossary.scrollTarget!)"
            >
              Jump to section
            </button>
            <button
              v-if="activeGlossary.relatedMetric"
              type="button"
              class="admin-btn-secondary text-xs"
              @click="openMetricFromGlossary(activeGlossary.relatedMetric!)"
            >
              Metric formula ({{ METRIC_HELP[activeGlossary.relatedMetric!].cardLabel }})
            </button>
          </div>
        </section>

        <p class="mt-5 text-xs text-admin-muted">
          Summary cards also have their own
          <span class="font-medium">i</span>
          buttons for exact formulas. USD display uses 10,000 units = $1 everywhere on this page.
        </p>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="openHelp('grossSales')">
          Dashboard metric formulas
        </button>
        <button type="button" class="admin-btn-primary" @click="glossaryOpen = false">Close</button>
      </template>
    </BaseDialog>

    <BaseDialog :title="activeHelp.title" :open="helpOpen" size="lg" @close="helpOpen = false">
      <template #body>
        <div class="mb-4 flex flex-wrap gap-1">
          <button
            v-for="topic in HELP_TOPICS"
            :key="topic"
            type="button"
            class="rounded-md border px-2 py-1 text-xs"
            :class="
              topic === activeHelpTopic
                ? 'border-admin-accent text-admin-accent'
                : 'border-admin-border text-admin-subtext hover:text-admin-text'
            "
            @click="activeHelpTopic = topic"
          >
            {{ METRIC_HELP[topic].cardLabel }}
          </button>
        </div>

        <p class="text-sm text-admin-subtext">{{ activeHelp.summary }}</p>

        <section class="mt-4 space-y-2 rounded-md bg-admin-bg px-3 py-2">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-admin-subtext">How it is calculated</h3>
          <p class="text-sm text-admin-text">{{ activeHelp.formula }}</p>
        </section>

        <section class="mt-4 space-y-2">
          <h3 class="text-sm font-semibold">What is counted</h3>
          <ul class="list-disc space-y-1 pl-5 text-sm text-admin-subtext">
            <li v-for="(line, idx) in activeHelp.includes" :key="`in-${idx}`">{{ line }}</li>
          </ul>
        </section>

        <section v-if="activeHelp.excludes.length" class="mt-4 space-y-2">
          <h3 class="text-sm font-semibold">What is not counted here</h3>
          <ul class="list-disc space-y-1 pl-5 text-sm text-admin-subtext">
            <li v-for="(line, idx) in activeHelp.excludes" :key="`ex-${idx}`">{{ line }}</li>
          </ul>
        </section>

        <section
          v-if="activeHelpTopic === 'salesVsUsage' && reconciliation"
          class="mt-4 space-y-1 rounded-md border border-admin-border px-3 py-2 text-xs text-admin-muted"
        >
          <p>
            Current period delta:
            <span class="font-medium tabular-nums text-admin-text">{{ reconciliation.delta }} units</span>
            ({{ usdLabel(reconciliation.deltaUsd) }})
          </p>
          <p>
            Opening customer units:
            {{ formatCoins(Number(reconciliation.openingCustomerFloatUnits)) }}
            ({{ reconciliation.openingFloatSource }})
          </p>
          <p>
            Closing customer units:
            {{ formatCoins(Number(reconciliation.closingCustomerFloatUnits)) }}
          </p>
          <p>
            Change in customer units:
            {{ formatCoins(Number(reconciliation.deltaCustomerFloatUnits)) }}
          </p>
        </section>

        <section
          v-if="activeHelpTopic === 'booksBalanced' && hero"
          class="mt-4 space-y-1 rounded-md border border-admin-border px-3 py-2 text-xs text-admin-muted"
        >
          <p>
            Status:
            <span
              class="font-medium"
              :class="hero.identityOk ? 'text-admin-success' : 'text-admin-warn'"
            >
              {{ hero.identityOk ? 'OK' : 'BREAKAGE' }}
            </span>
            · gap {{ hero.identityDelta }} units
          </p>
        </section>

        <p class="mt-4 text-xs text-admin-muted">
          All USD amounts use a fixed display rate of 10,000 units = $1. Detailed line items for
          this period appear in the tables below the summary cards.
        </p>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-primary" @click="helpOpen = false">Close</button>
      </template>
    </BaseDialog>
  </div>
</template>
