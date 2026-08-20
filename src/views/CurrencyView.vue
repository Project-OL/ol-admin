<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { format, parseISO } from 'date-fns'
import { currencyApi } from '@/api/currency'
import { userAdminApi } from '@/api/userAdmin'
import type {
  AdminCurrencyAdjustmentEntry,
  AdminCurrencyKind,
  CompanyCashCreateBody,
  CompanyCashEntry,
  CompanyCashReason,
  LedgerGrain,
  LedgerLine,
  MasterLedgerDashboard,
} from '@/types/currency'
import type { UserSearchItem } from '@/types/api'
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

const form = reactive({
  userQuery: '',
  userId: '',
  userLabel: '',
  currency: 'TRADING_COIN' as AdminCurrencyKind,
  direction: 'credit' as 'credit' | 'debit',
  amount: '',
  cashUsd: '',
  promotional: false,
  description: '',
  forceTradingCredit: false,
})
const searchHits = ref<UserSearchItem[]>([])
const searching = ref(false)
const submitting = ref(false)

const cashForm = reactive<CompanyCashCreateBody>({
  direction: 'IN',
  reason: 'AGENCY_TRADING_PURCHASE',
  amountUsd: '',
  description: '',
})
const cashSubmitting = ref(false)

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
  if (id === 'hostPoints' || id === 'agencyPoints' || id === 'companyAgencyPoints') {
    return formatPoints(n)
  }
  return formatCoins(n)
}

function usdLabel(usd: string) {
  const n = Number(usd)
  return Number.isFinite(n) ? formatUsd(n) : `$${usd}`
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
    ['1 Company money', 'Capital in', '', d.hero.capitalInUsd],
    ['1 Company money', 'Cash out (EPAY + takeover)', '', d.hero.cashOutUsd],
    ['1 Company money', 'Cash profit', '', d.hero.cashProfitUsd],
    ['1 Company money', 'Operating profit', d.hero.operatingProfitUnits, d.hero.operatingProfitUsd],
    [
      '1 Company money',
      'Identity (wallets vs ledger)',
      d.hero.identityOk ? 'OK' : 'BREAKAGE',
      d.hero.identityDelta,
    ],
    ['1 Company money', 'Net admin issued', d.stock.netMinted, ''],
    ['1 Company money', 'Total outstanding', d.stock.outstanding, d.stock.outstandingUsd],
    ['1 Company money', 'Issued − outstanding (retained)', d.stock.destroyedUnits, ''],
  ]
  for (const line of d.stock.inventory) {
    rows.push(['2 Inventory', line.label, line.units, line.usd])
  }
  for (const line of d.pnl.revenue) {
    rows.push(['3 Operating revenue', line.label, line.units, line.usd])
  }
  for (const line of d.pnl.costs) {
    rows.push(['3 Operating cost', line.label, line.units, line.usd])
  }
  rows.push([
    '3 Operating P&L',
    'Net operating profit',
    d.pnl.operatingProfitUnits,
    d.pnl.operatingProfitUsd,
  ])
  rows.push(['4 Cash journal', 'Capital in', '', d.cash.capitalInUsd])
  rows.push(['4 Cash journal', 'Cash out', '', d.cash.cashOutUsd])
  rows.push(['4 Cash journal', 'Cash profit', '', d.cash.cashProfitUsd])
  for (const entry of cashEntries.value) {
    const signed = entry.direction === 'OUT' ? `-${entry.amountUsd}` : entry.amountUsd
    rows.push([
      '4 Cash journal',
      `${entry.direction} ${entry.reason}${entry.description ? ` — ${entry.description}` : ''}`,
      entry.unitsAmount ?? '',
      signed,
    ])
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
      cursor: append ? adjCursor.value ?? undefined : undefined,
      limit: 15,
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

async function refreshAll() {
  await loadDashboard()
  await Promise.all([loadCash(false), loadAdjustments(false)])
}

function windowParams() {
  const p = dashboard.value?.period
  if (p) return { from: p.from, to: p.to }
  return periodParams.value
}

async function searchUsers() {
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

function pickUser(hit: UserSearchItem) {
  const id = hit.userId
  if (!id) return
  form.userId = id
  form.userLabel = [hit.name, hit.username, hit.publicId].filter(Boolean).join(' · ')
  form.userQuery = form.userLabel
  searchHits.value = []
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
  const needsCash =
    form.direction === 'credit' && form.currency === 'TRADING_COIN' && !form.promotional
  if (needsCash && (!form.cashUsd || Number(form.cashUsd) <= 0)) {
    showToast('Enter USD received for this trading-coin mint', 'error')
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
      cashUsd: needsCash ? form.cashUsd : undefined,
    })
    showToast(
      `${form.direction === 'credit' ? 'Issued' : 'Returned'} ${form.amount} ${form.currency}`,
      'success',
    )
    form.amount = ''
    form.cashUsd = ''
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

onMounted(() => {
  void refreshAll()
})

const hero = computed(() => dashboard.value?.hero ?? null)
const inventory = computed<LedgerLine[]>(() => dashboard.value?.stock.inventory ?? [])
const revenue = computed<LedgerLine[]>(() => dashboard.value?.pnl.revenue ?? [])
const costs = computed<LedgerLine[]>(() => dashboard.value?.pnl.costs ?? [])

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
        <h1 class="text-xl font-semibold sm:text-2xl">Currency</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Company capital, inventory, operating P&amp;L, and cash. 10,000 units = $1. Unspent coins
          are a liability, not profit.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
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
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Capital in</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ loading ? '…' : usdLabel(hero?.capitalInUsd ?? '0') }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Cash out</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ loading ? '…' : usdLabel(hero?.cashOutUsd ?? '0') }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Cash profit</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ loading ? '…' : usdLabel(hero?.cashProfitUsd ?? '0') }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Operating profit</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ loading ? '…' : usdLabel(hero?.operatingProfitUsd ?? '0') }}
        </p>
        <p class="text-xs text-admin-muted tabular-nums">
          {{ loading ? '' : formatCoins(Number(hero?.operatingProfitUnits ?? 0)) }} units
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Identity</p>
        <p
          class="mt-1 text-xl font-semibold"
          :class="hero?.identityOk === false ? 'text-admin-warn' : 'text-admin-success'"
        >
          {{ loading ? '…' : hero?.identityOk ? 'OK' : 'BREAKAGE' }}
        </p>
        <p v-if="hero && !hero.identityOk" class="text-xs text-admin-muted">
          Δ {{ hero.identityDelta }}
        </p>
      </div>
    </div>

    <section class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Inventory at period end</h2>
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
            <tr v-for="row in inventory" :key="row.id">
              <td>{{ row.label }}</td>
              <td class="tabular-nums font-semibold">{{ formatUnits(row.units, row.id) }}</td>
              <td class="tabular-nums">{{ usdLabel(row.usd) }}</td>
            </tr>
            <tr v-if="loading && !inventory.length">
              <td colspan="3" class="py-8 text-center text-admin-muted">Loading…</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Operating P&amp;L</h2>
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

    <section class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Cash journal</h2>
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

    <section class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Issue currency (phase 1)</h2>
      <p class="text-xs text-admin-subtext">
        Trading-coin credits require the USD the agency paid off-system, unless marked promotional.
      </p>
      <div class="relative">
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
          class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-admin-border bg-admin-surface"
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
        <p v-if="form.userId" class="mt-1 text-xs text-admin-subtext">
          Selected: {{ form.userLabel }}
          <RouterLink class="ml-2 text-admin-accent underline" :to="`/admin/users/${form.userId}`">
            Open profile
          </RouterLink>
        </p>
      </div>
      <div class="grid gap-2 sm:grid-cols-4">
        <select v-model="form.currency" class="admin-input">
          <option value="TRADING_COIN">Trading coins</option>
          <option value="COIN">Personal coins</option>
          <option value="POINT">Points</option>
        </select>
        <select v-model="form.direction" class="admin-input">
          <option value="credit">Create (credit)</option>
          <option value="debit">Return (debit)</option>
        </select>
        <input v-model="form.amount" type="text" inputmode="numeric" class="admin-input" placeholder="Amount" />
        <input v-model="form.description" type="text" class="admin-input" placeholder="Reason (optional)" />
      </div>
      <div
        v-if="form.currency === 'TRADING_COIN' && form.direction === 'credit' && !form.promotional"
        class="grid gap-2 sm:grid-cols-2"
      >
        <input v-model="form.cashUsd" class="admin-input" placeholder="USD received from agency" />
      </div>
      <label
        v-if="form.direction === 'credit'"
        class="flex items-center gap-2 text-sm text-admin-subtext"
      >
        <input v-model="form.promotional" type="checkbox" />
        Promotional (no cash-in; counts as operating cost)
      </label>
      <label
        v-if="form.currency === 'TRADING_COIN' && form.direction === 'credit'"
        class="flex items-center gap-2 text-sm text-admin-subtext"
      >
        <input v-model="form.forceTradingCredit" type="checkbox" />
        Force trading credit (even if user is not an agency agent)
      </label>
      <button type="button" class="admin-btn-primary" :disabled="submitting" @click="submitAdjust">
        {{ submitting ? 'Submitting…' : form.direction === 'credit' ? 'Issue currency' : 'Return currency' }}
      </button>

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
  </div>
</template>
