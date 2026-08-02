<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { format, parseISO } from 'date-fns'
import axios from 'axios'
import { transactionsApi } from '@/api/transactions'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import type {
  AdminCoinTradingTransfer,
  AdminGiftTransaction,
  AdminLedgerEntry,
  AdminStorePurchase,
  AdminSubscription,
  AdminTransactionEntry,
  AdminUserBrief,
  AdminVipPurchase,
  TransactionsTab,
} from '@/types/transactions'
import { formatCoins, formatNumber, formatPoints } from '@/utils/format'
import { showToast } from '@/utils/toast'

const TABS: { value: TransactionsTab; label: string; short: string }[] = [
  { value: 'coins', label: 'Personal coins', short: 'Coins' },
  { value: 'points', label: 'Points', short: 'Points' },
  { value: 'trading-coins', label: 'Trading ledger', short: 'Trading' },
  { value: 'coin-trading-transfers', label: 'Trading transfers', short: 'Transfers' },
  { value: 'gifts', label: 'Gifts', short: 'Gifts' },
  { value: 'subscriptions', label: 'Subscriptions', short: 'Subs' },
  { value: 'vip-purchases', label: 'VIP purchases', short: 'VIP' },
  { value: 'store-purchases', label: 'Store purchases', short: 'Store' },
]

const LEDGER_TABS = new Set<TransactionsTab>(['coins', 'points', 'trading-coins'])
const REVERTABLE_TABS = new Set<TransactionsTab>([
  'coins',
  'points',
  'coin-trading-transfers',
  'gifts',
])

const route = useRoute()
const router = useRouter()

const activeTab = ref<TransactionsTab>('coins')
const entries = ref<AdminTransactionEntry[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const showAdvanced = ref(false)

const filters = reactive({
  q: '',
  direction: '' as '' | 'credit' | 'debit',
  from: '',
  to: '',
  senderUserId: '',
  receiverUserId: '',
  userId: '',
})

const selected = ref<AdminTransactionEntry | null>(null)
const revertOpen = ref(false)
const revertReason = ref('')
const reverting = ref(false)

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function shortId(id: string) {
  if (id.length <= 12) return id
  return `${id.slice(0, 8)}…`
}

function userLabel(u: AdminUserBrief | null | undefined) {
  if (!u) return '—'
  return u.displayName || u.username || u.displayPublicId || '—'
}

function userSub(u: AdminUserBrief | null | undefined) {
  if (!u) return ''
  const id = u.displayPublicId || u.publicId
  return id ? `#${id}${u.username ? ` · @${u.username}` : ''}` : u.username ? `@${u.username}` : ''
}

function isLedger(e: AdminTransactionEntry): e is AdminLedgerEntry {
  return 'txType' in e && 'balanceAfter' in e && 'user' in e && 'counterparty' in e
}

function isTransfer(e: AdminTransactionEntry): e is AdminCoinTradingTransfer {
  return 'tradingCoinsDebited' in e && 'coinsCredited' in e && 'sender' in e
}

function isGift(e: AdminTransactionEntry): e is AdminGiftTransaction {
  return 'pointsAwarded' in e && 'quantity' in e && 'sender' in e && 'gift' in e
}

function isSubscription(e: AdminTransactionEntry): e is AdminSubscription {
  return 'subscriber' in e && 'creator' in e && 'nextRenewalAt' in e
}

function isVip(e: AdminTransactionEntry): e is AdminVipPurchase {
  return 'tier' in e && 'periodDays' in e && 'ledgerEntry' in e
}

function isStore(e: AdminTransactionEntry): e is AdminStorePurchase {
  return 'storeItem' in e && 'buyer' in e && 'recipient' in e && 'coinsPaid' in e
}

function directionClass(dir: string) {
  const d = dir.toLowerCase()
  if (d === 'credit') return 'text-emerald-400'
  if (d === 'debit') return 'text-admin-danger'
  return 'text-admin-subtext'
}

function canRevertEntry(e: AdminTransactionEntry | null): boolean {
  if (!e || !REVERTABLE_TABS.has(activeTab.value)) return false
  if ('canRevert' in e) return Boolean(e.canRevert)
  return false
}

const selectedCanRevert = computed(() => canRevertEntry(selected.value))

function listParams(cursor?: string) {
  const params: Record<string, string | number | undefined> = {
    limit: 20,
    q: filters.q.trim() || undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
    userId: filters.userId.trim() || undefined,
    senderUserId: filters.senderUserId.trim() || undefined,
    receiverUserId: filters.receiverUserId.trim() || undefined,
    cursor,
  }
  if (LEDGER_TABS.has(activeTab.value) && filters.direction) {
    params.direction = filters.direction
  }
  return params
}

function parseTab(raw: unknown): TransactionsTab | null {
  if (typeof raw !== 'string') return null
  return TABS.some((t) => t.value === raw) ? (raw as TransactionsTab) : null
}

async function loadEntries(append = false) {
  if (append) {
    if (loadingMore.value || !hasMore.value || !nextCursor.value) return
    loadingMore.value = true
  } else {
    loading.value = true
    selected.value = null
  }

  try {
    const { data } = await transactionsApi.list(
      activeTab.value,
      listParams(append ? nextCursor.value ?? undefined : undefined),
    )
    const next = data.entries ?? []
    entries.value = append ? [...entries.value, ...next] : next
    nextCursor.value = data.nextCursor ?? null
    hasMore.value = Boolean(data.hasMore)
  } catch (err) {
    if (!append) {
      entries.value = []
      nextCursor.value = null
      hasMore.value = false
    }
    showToast(errorMessage(err, 'Failed to load transactions'), 'error')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function errorMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  const body = err.response?.data as { code?: string; message?: string } | undefined
  const code = body?.code
  switch (code) {
    case 'USER_NOT_FOUND':
      return 'No user found for that public ID'
    case 'INVALID_REQUEST':
      return body?.message || 'Invalid search or request'
    case 'NOT_REVERTABLE':
      return 'This entry has no counterparty and cannot be reverted'
    case 'ALREADY_REVERTED':
    case 'TRANSFER_ALREADY_REVERSED':
      return 'Already reverted'
    case 'INSUFFICIENT_COINS':
      return 'Receiver personal coins too low to cover revert'
    case 'INSUFFICIENT_TRADING_COINS':
      return 'Receiver trading coins too low to cover revert'
    case 'INSUFFICIENT_POINTS':
      return 'Receiver points too low to cover revert'
    case 'PERSONAL_COINS_FROZEN':
      return 'Receiver personal coins wallet is frozen'
    case 'TRADING_COINS_FROZEN':
      return 'Receiver trading coins wallet is frozen'
    case 'POINTS_FROZEN':
      return 'Receiver points wallet is frozen'
    case 'LEDGER_ENTRY_NOT_FOUND':
      return 'Ledger entry not found'
    case 'GIFT_TRANSACTION_NOT_FOUND':
      return 'Gift transaction not found'
    case 'TRANSFER_NOT_FOUND':
      return 'Trading transfer not found'
    default:
      return body?.message || fallback
  }
}

function applyFilters() {
  void loadEntries(false)
}

function resetFilters() {
  filters.q = typeof route.query.q === 'string' ? route.query.q : ''
  filters.direction = ''
  filters.from = ''
  filters.to = ''
  filters.senderUserId = ''
  filters.receiverUserId = ''
  filters.userId = ''
  showAdvanced.value = false
  void loadEntries(false)
}

function setTab(tab: TransactionsTab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  filters.direction = ''
  selected.value = null
  router.replace({ query: { ...route.query, tab } })
  void loadEntries(false)
}

function openDetail(entry: AdminTransactionEntry) {
  selected.value = entry
}

function closeDetail() {
  selected.value = null
}

function openRevert() {
  if (!selectedCanRevert.value) return
  revertReason.value = ''
  revertOpen.value = true
}

function closeRevert() {
  if (reverting.value) return
  revertOpen.value = false
}

async function confirmRevert() {
  const entry = selected.value
  const reason = revertReason.value.trim()
  if (!entry || !reason || reverting.value) return

  reverting.value = true
  try {
    const idempotencyKey = `admin-tx-revert-${entry.id}-${Date.now()}`
    const body = { reason, idempotencyKey }

    if (activeTab.value === 'coins' || activeTab.value === 'trading-coins') {
      await transactionsApi.revertCoin(entry.id, body)
    } else if (activeTab.value === 'points') {
      await transactionsApi.revertPoint(entry.id, body)
    } else if (activeTab.value === 'coin-trading-transfers') {
      await transactionsApi.revertCoinTradingTransfer(entry.id, body)
    } else if (activeTab.value === 'gifts') {
      await transactionsApi.revertGift(entry.id, body)
    } else {
      showToast('Revert is not available for this tab', 'error')
      return
    }

    showToast('Transaction reverted', 'success')
    revertOpen.value = false
    selected.value = null
    await loadEntries(false)
  } catch (err) {
    showToast(errorMessage(err, 'Failed to revert transaction'), 'error')
  } finally {
    reverting.value = false
  }
}

function primaryAmount(entry: AdminTransactionEntry): string {
  if (isLedger(entry)) {
    const n = Number(entry.amount)
    const abs = Number.isFinite(n) ? Math.abs(n) : entry.amount
    if (activeTab.value === 'points') return formatPoints(Number(abs))
    return formatCoins(Number(abs))
  }
  if (isTransfer(entry)) return formatCoins(Number(entry.coinsCredited))
  if (isGift(entry)) return formatCoins(entry.coinCost)
  if (isVip(entry)) return formatCoins(Number(entry.coinCost))
  if (isStore(entry)) return formatCoins(entry.coinsPaid)
  return '—'
}

function primaryTitle(entry: AdminTransactionEntry): string {
  if (isLedger(entry)) return entry.transactionName || entry.txType
  if (isTransfer(entry)) return 'Coin trading transfer'
  if (isGift(entry)) return entry.gift.name
  if (isSubscription(entry)) return `Subscription · ${entry.status}`
  if (isVip(entry)) return `VIP ${entry.tier} · ${entry.periodDays}d`
  if (isStore(entry)) return entry.storeItem.name
  return 'Transaction'
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && selected.value && !revertOpen.value) closeDetail()
}

watch(
  () => selected.value,
  (entry) => {
    if (!revertOpen.value) {
      document.body.style.overflow = entry ? 'hidden' : ''
    }
  },
)

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  const tab = parseTab(route.query.tab)
  if (tab) activeTab.value = tab
  if (typeof route.query.q === 'string') filters.q = route.query.q
  void loadEntries(false)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Transactions</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Explore platform money movements and safely revert peer transfers, gifts, and trading
          transfers
        </p>
      </div>
      <button
        type="button"
        class="admin-btn-secondary text-sm"
        :disabled="loading"
        @click="loadEntries(false)"
      >
        Refresh
      </button>
    </div>

    <!-- Tabs -->
    <div
      class="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0"
      style="-webkit-overflow-scrolling: touch"
    >
      <div
        class="inline-flex min-w-full gap-1 rounded-lg border border-admin-border bg-admin-surface p-1 sm:flex sm:min-w-0 sm:flex-wrap"
      >
        <button
          v-for="tab in TABS"
          :key="tab.value"
          type="button"
          :class="[
            'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
            activeTab === tab.value
              ? 'bg-admin-accent/15 text-admin-accent'
              : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="setTab(tab.value)"
        >
          <span class="sm:hidden">{{ tab.short }}</span>
          <span class="hidden sm:inline">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <section class="admin-card space-y-3">
      <div class="admin-filter-bar">
        <input
          v-model="filters.q"
          type="search"
          enterkeyhint="search"
          class="admin-input min-w-0 w-full flex-1 sm:min-w-[200px]"
          placeholder="Search id or public ID…"
          @keydown.enter="applyFilters"
        />
        <select
          v-if="LEDGER_TABS.has(activeTab)"
          v-model="filters.direction"
          class="admin-input w-full sm:w-auto"
        >
          <option value="">All directions</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <input v-model="filters.from" type="date" class="admin-input w-full sm:w-auto" title="From" />
        <input v-model="filters.to" type="date" class="admin-input w-full sm:w-auto" title="To" />
        <button type="button" class="admin-btn-primary w-full sm:w-auto" :disabled="loading" @click="applyFilters">
          {{ loading ? 'Loading…' : 'Search' }}
        </button>
        <button type="button" class="admin-btn-secondary w-full sm:w-auto" :disabled="loading" @click="resetFilters">
          Reset
        </button>
        <button
          type="button"
          class="admin-btn-secondary w-full sm:w-auto text-xs"
          @click="showAdvanced = !showAdvanced"
        >
          {{ showAdvanced ? 'Hide' : 'More' }} filters
        </button>
      </div>

      <div v-if="showAdvanced" class="grid gap-2 sm:grid-cols-3">
        <input
          v-model="filters.userId"
          type="text"
          class="admin-input"
          placeholder="User UUID (either party)"
        />
        <input
          v-model="filters.senderUserId"
          type="text"
          class="admin-input"
          placeholder="Sender / buyer UUID"
        />
        <input
          v-model="filters.receiverUserId"
          type="text"
          class="admin-input"
          placeholder="Receiver / creator UUID"
        />
      </div>
    </section>

    <!-- Results: mobile cards -->
    <section class="space-y-2 md:hidden">
      <div
        v-if="loading && !entries.length"
        class="admin-card py-10 text-center text-admin-muted"
      >
        Loading…
      </div>
      <div
        v-else-if="!entries.length"
        class="admin-card py-10 text-center text-admin-muted"
      >
        No transactions found
      </div>
      <button
        v-for="entry in entries"
        :key="entry.id"
        type="button"
        class="admin-card w-full text-left transition-colors hover:border-admin-accent/40"
        :class="selected?.id === entry.id ? 'border-admin-accent/50 bg-admin-accent/5' : ''"
        @click="openDetail(entry)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ primaryTitle(entry) }}</p>
            <p class="mt-0.5 font-mono text-xs text-admin-muted">{{ shortId(entry.id) }}</p>
          </div>
          <div class="shrink-0 text-right">
            <p
              class="tabular-nums font-semibold"
              :class="isLedger(entry) ? directionClass(entry.direction) : 'text-admin-text'"
            >
              <template v-if="isLedger(entry)">
                {{ entry.direction.toLowerCase() === 'debit' ? '−' : '+' }}
              </template>
              {{ primaryAmount(entry) }}
            </p>
            <p class="mt-0.5 text-xs text-admin-muted">{{ formatDt(entry.createdAt) }}</p>
          </div>
        </div>
        <div class="mt-2 flex flex-wrap gap-2 text-xs text-admin-subtext">
          <template v-if="isLedger(entry)">
            <span>{{ userLabel(entry.user) }}</span>
            <span v-if="entry.counterparty">→ {{ userLabel(entry.counterparty) }}</span>
            <span
              v-if="entry.canRevert"
              class="rounded bg-admin-warn/15 px-1.5 py-0.5 text-admin-warn"
            >Revertable</span>
          </template>
          <template v-else-if="isTransfer(entry)">
            <span>{{ userLabel(entry.sender) }} → {{ userLabel(entry.receiver) }}</span>
            <span
              v-if="entry.canRevert"
              class="rounded bg-admin-warn/15 px-1.5 py-0.5 text-admin-warn"
            >Revertable</span>
            <span
              v-else-if="entry.reversedAt"
              class="rounded bg-admin-muted/20 px-1.5 py-0.5"
            >Reversed</span>
          </template>
          <template v-else-if="isGift(entry)">
            <span>{{ userLabel(entry.sender) }} → {{ userLabel(entry.receiver) }}</span>
            <span
              v-if="entry.canRevert"
              class="rounded bg-admin-warn/15 px-1.5 py-0.5 text-admin-warn"
            >Revertable</span>
          </template>
          <template v-else-if="isSubscription(entry)">
            <span>{{ userLabel(entry.subscriber) }} → {{ userLabel(entry.creator) }}</span>
          </template>
          <template v-else-if="isVip(entry)">
            <span>{{ userLabel(entry.user) }}</span>
          </template>
          <template v-else-if="isStore(entry)">
            <span>{{ userLabel(entry.buyer) }} → {{ userLabel(entry.recipient) }}</span>
          </template>
        </div>
      </button>
    </section>

    <!-- Results: desktop table -->
    <section class="admin-card hidden md:block">
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Summary</th>
              <th>Parties</th>
              <th>Amount</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in entries"
              :key="entry.id"
              class="cursor-pointer transition-colors hover:bg-admin-bg/80"
              :class="selected?.id === entry.id ? 'bg-admin-accent/10' : ''"
              @click="openDetail(entry)"
            >
              <td class="whitespace-nowrap text-xs">{{ formatDt(entry.createdAt) }}</td>
              <td>
                <p class="font-medium">{{ primaryTitle(entry) }}</p>
                <p class="font-mono text-xs text-admin-muted" :title="entry.id">
                  {{ shortId(entry.id) }}
                </p>
                <p v-if="isLedger(entry)" class="text-xs text-admin-subtext">
                  {{ entry.txType }}
                  <span v-if="entry.description"> · {{ entry.description }}</span>
                </p>
              </td>
              <td>
                <template v-if="isLedger(entry)">
                  <p class="text-sm">{{ userLabel(entry.user) }}</p>
                  <p class="text-xs text-admin-subtext">{{ userSub(entry.user) }}</p>
                  <p v-if="entry.counterparty" class="mt-1 text-xs text-admin-subtext">
                    ↔ {{ userLabel(entry.counterparty) }}
                  </p>
                </template>
                <template v-else-if="isTransfer(entry) || isGift(entry)">
                  <p class="text-sm">{{ userLabel(entry.sender) }}</p>
                  <p class="text-xs text-admin-subtext">→ {{ userLabel(entry.receiver) }}</p>
                </template>
                <template v-else-if="isSubscription(entry)">
                  <p class="text-sm">{{ userLabel(entry.subscriber) }}</p>
                  <p class="text-xs text-admin-subtext">→ {{ userLabel(entry.creator) }}</p>
                </template>
                <template v-else-if="isVip(entry)">
                  <p class="text-sm">{{ userLabel(entry.user) }}</p>
                  <p class="text-xs text-admin-subtext">{{ userSub(entry.user) }}</p>
                </template>
                <template v-else-if="isStore(entry)">
                  <p class="text-sm">{{ userLabel(entry.buyer) }}</p>
                  <p class="text-xs text-admin-subtext">→ {{ userLabel(entry.recipient) }}</p>
                </template>
              </td>
              <td>
                <p
                  class="tabular-nums font-semibold"
                  :class="isLedger(entry) ? directionClass(entry.direction) : ''"
                >
                  <template v-if="isLedger(entry)">
                    {{ entry.direction.toLowerCase() === 'debit' ? '−' : '+' }}
                  </template>
                  {{ primaryAmount(entry) }}
                </p>
                <p v-if="isLedger(entry)" class="text-xs text-admin-muted">
                  bal {{ formatNumber(Number(entry.balanceAfter)) }}
                </p>
                <p v-else-if="isGift(entry)" class="text-xs text-admin-muted">
                  +{{ formatPoints(entry.pointsAwarded) }} pts · ×{{ entry.quantity }}
                </p>
                <p v-else-if="isTransfer(entry)" class="text-xs text-admin-muted">
                  −{{ formatCoins(Number(entry.tradingCoinsDebited)) }} trading
                </p>
              </td>
              <td>
                <span
                  v-if="'canRevert' in entry && entry.canRevert"
                  class="inline-flex rounded-full bg-admin-warn/15 px-2 py-0.5 text-xs font-medium text-admin-warn"
                >
                  Revertable
                </span>
                <span
                  v-else-if="isTransfer(entry) && entry.reversedAt"
                  class="inline-flex rounded-full bg-admin-muted/20 px-2 py-0.5 text-xs text-admin-subtext"
                >
                  Reversed
                </span>
                <span v-else class="text-xs text-admin-muted">—</span>
              </td>
            </tr>
            <tr v-if="loading && !entries.length">
              <td colspan="5" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!entries.length">
              <td colspan="5" class="py-10 text-center text-admin-muted">No transactions found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="admin-pagination">
      <span class="text-sm text-admin-subtext">
        {{ formatNumber(entries.length) }} loaded
        <template v-if="hasMore"> · more available</template>
      </span>
      <div>
        <button
          type="button"
          class="admin-btn-secondary text-sm"
          :disabled="!hasMore || loadingMore || loading"
          @click="loadEntries(true)"
        >
          {{ loadingMore ? 'Loading…' : 'Load more' }}
        </button>
      </div>
    </div>

    <!-- Detail drawer -->
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="selected" class="fixed inset-0 z-50 flex justify-end">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeDetail" />
          <aside
            class="relative flex h-full w-full max-w-lg flex-col border-l border-admin-border bg-admin-surface shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div class="flex items-start justify-between gap-3 border-b border-admin-border px-4 py-4 sm:px-5">
              <div class="min-w-0">
                <h2 class="truncate text-base font-semibold">{{ primaryTitle(selected) }}</h2>
                <p class="mt-1 break-all font-mono text-xs text-admin-muted">{{ selected.id }}</p>
                <p class="mt-1 text-xs text-admin-subtext">{{ formatDt(selected.createdAt) }}</p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-md p-1.5 text-admin-subtext hover:bg-admin-border hover:text-admin-text"
                aria-label="Close"
                @click="closeDetail"
              >
                ✕
              </button>
            </div>

            <div class="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <!-- Amount -->
              <section>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Amount
                </h3>
                <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
                  <p
                    class="text-lg font-semibold tabular-nums"
                    :class="isLedger(selected) ? directionClass(selected.direction) : ''"
                  >
                    <template v-if="isLedger(selected)">
                      {{ selected.direction }} ·
                    </template>
                    {{ primaryAmount(selected) }}
                  </p>
                  <p v-if="isLedger(selected)" class="mt-1 text-xs text-admin-subtext">
                    Balance after: {{ formatNumber(Number(selected.balanceAfter)) }}
                    <span v-if="selected.currencyType"> · {{ selected.currencyType }}</span>
                  </p>
                  <p v-else-if="isGift(selected)" class="mt-1 text-xs text-admin-subtext">
                    Points awarded: {{ formatPoints(selected.pointsAwarded) }} · Qty:
                    {{ selected.quantity }}
                  </p>
                  <p v-else-if="isTransfer(selected)" class="mt-1 text-xs text-admin-subtext">
                    Trading debit: {{ formatCoins(Number(selected.tradingCoinsDebited)) }} · Wallet:
                    {{ selected.recipientWalletType }}
                  </p>
                </div>
              </section>

              <!-- Ledger specifics -->
              <section v-if="isLedger(selected)">
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Ledger
                </h3>
                <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                  <div class="admin-kv-row">
                    <span class="admin-kv-label">Type</span>
                    <span class="admin-kv-value font-mono text-xs">{{ selected.txType }}</span>
                  </div>
                  <div v-if="selected.description" class="admin-kv-row">
                    <span class="admin-kv-label">Description</span>
                    <span class="admin-kv-value">{{ selected.description }}</span>
                  </div>
                  <div v-if="selected.refId" class="admin-kv-row">
                    <span class="admin-kv-label">Ref</span>
                    <span class="admin-kv-value break-all font-mono text-xs">{{ selected.refId }}</span>
                  </div>
                </div>
              </section>

              <!-- Parties -->
              <section>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Parties
                </h3>
                <div class="space-y-2">
                  <template v-if="isLedger(selected)">
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <p class="text-xs text-admin-muted">Wallet owner</p>
                      <p class="font-medium">{{ userLabel(selected.user) }}</p>
                      <p class="text-xs text-admin-subtext">{{ userSub(selected.user) }}</p>
                      <RouterLink
                        :to="`/admin/users/${selected.user.userId}`"
                        class="mt-1 inline-block text-xs font-medium text-admin-accent hover:underline"
                      >
                        Open profile →
                      </RouterLink>
                    </div>
                    <div
                      v-if="selected.counterparty"
                      class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm"
                    >
                      <p class="text-xs text-admin-muted">Counterparty</p>
                      <p class="font-medium">{{ userLabel(selected.counterparty) }}</p>
                      <p class="text-xs text-admin-subtext">{{ userSub(selected.counterparty) }}</p>
                      <RouterLink
                        :to="`/admin/users/${selected.counterparty.userId}`"
                        class="mt-1 inline-block text-xs font-medium text-admin-accent hover:underline"
                      >
                        Open profile →
                      </RouterLink>
                    </div>
                  </template>

                  <template v-else-if="isTransfer(selected) || isGift(selected)">
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <p class="text-xs text-admin-muted">Sender</p>
                      <p class="font-medium">{{ userLabel(selected.sender) }}</p>
                      <p class="text-xs text-admin-subtext">{{ userSub(selected.sender) }}</p>
                      <RouterLink
                        :to="`/admin/users/${selected.sender.userId}`"
                        class="mt-1 inline-block text-xs font-medium text-admin-accent hover:underline"
                      >
                        Open profile →
                      </RouterLink>
                    </div>
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <p class="text-xs text-admin-muted">Receiver</p>
                      <p class="font-medium">{{ userLabel(selected.receiver) }}</p>
                      <p class="text-xs text-admin-subtext">{{ userSub(selected.receiver) }}</p>
                      <RouterLink
                        :to="`/admin/users/${selected.receiver.userId}`"
                        class="mt-1 inline-block text-xs font-medium text-admin-accent hover:underline"
                      >
                        Open profile →
                      </RouterLink>
                    </div>
                  </template>

                  <template v-else-if="isSubscription(selected)">
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <p class="text-xs text-admin-muted">Subscriber</p>
                      <p class="font-medium">{{ userLabel(selected.subscriber) }}</p>
                      <RouterLink
                        :to="`/admin/users/${selected.subscriber.userId}`"
                        class="mt-1 inline-block text-xs font-medium text-admin-accent hover:underline"
                      >
                        Open profile →
                      </RouterLink>
                    </div>
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <p class="text-xs text-admin-muted">Creator</p>
                      <p class="font-medium">{{ userLabel(selected.creator) }}</p>
                      <RouterLink
                        :to="`/admin/users/${selected.creator.userId}`"
                        class="mt-1 inline-block text-xs font-medium text-admin-accent hover:underline"
                      >
                        Open profile →
                      </RouterLink>
                    </div>
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <div class="admin-kv-row">
                        <span class="admin-kv-label">Status</span>
                        <span class="admin-kv-value">{{ selected.status }}</span>
                      </div>
                      <div class="admin-kv-row">
                        <span class="admin-kv-label">Next renewal</span>
                        <span class="admin-kv-value">{{ formatDt(selected.nextRenewalAt) }}</span>
                      </div>
                      <div class="admin-kv-row">
                        <span class="admin-kv-label">Grace until</span>
                        <span class="admin-kv-value">{{ formatDt(selected.graceUntil) }}</span>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="isVip(selected)">
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <p class="text-xs text-admin-muted">Buyer</p>
                      <p class="font-medium">{{ userLabel(selected.user) }}</p>
                      <RouterLink
                        :to="`/admin/users/${selected.user.userId}`"
                        class="mt-1 inline-block text-xs font-medium text-admin-accent hover:underline"
                      >
                        Open profile →
                      </RouterLink>
                    </div>
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <div class="admin-kv-row">
                        <span class="admin-kv-label">Expires after</span>
                        <span class="admin-kv-value">{{ formatDt(selected.expiresAtAfter) }}</span>
                      </div>
                      <div class="admin-kv-row">
                        <span class="admin-kv-label">Ledger</span>
                        <span class="admin-kv-value font-mono text-xs">{{ selected.ledgerEntryId }}</span>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="isStore(selected)">
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <p class="text-xs text-admin-muted">Buyer</p>
                      <p class="font-medium">{{ userLabel(selected.buyer) }}</p>
                      <RouterLink
                        :to="`/admin/users/${selected.buyer.userId}`"
                        class="mt-1 inline-block text-xs font-medium text-admin-accent hover:underline"
                      >
                        Open profile →
                      </RouterLink>
                    </div>
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <p class="text-xs text-admin-muted">Recipient</p>
                      <p class="font-medium">{{ userLabel(selected.recipient) }}</p>
                      <RouterLink
                        :to="`/admin/users/${selected.recipient.userId}`"
                        class="mt-1 inline-block text-xs font-medium text-admin-accent hover:underline"
                      >
                        Open profile →
                      </RouterLink>
                    </div>
                    <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                      <div class="admin-kv-row">
                        <span class="admin-kv-label">Item</span>
                        <span class="admin-kv-value">{{ selected.storeItem.name }}</span>
                      </div>
                      <div class="admin-kv-row">
                        <span class="admin-kv-label">Category</span>
                        <span class="admin-kv-value">{{ selected.storeItem.category }}</span>
                      </div>
                      <div class="admin-kv-row">
                        <span class="admin-kv-label">Active / applied</span>
                        <span class="admin-kv-value">
                          {{ selected.isActive ? 'yes' : 'no' }} /
                          {{ selected.isApplied ? 'yes' : 'no' }}
                        </span>
                      </div>
                      <div class="admin-kv-row">
                        <span class="admin-kv-label">Expires</span>
                        <span class="admin-kv-value">{{ formatDt(selected.expiresAt) }}</span>
                      </div>
                    </div>
                  </template>
                </div>
              </section>

              <!-- Linked catalog -->
              <section v-if="isLedger(selected) && (selected.gift || selected.storeItem || selected.vipPurchase || selected.coinTradingTransfer)">
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Linked
                </h3>
                <div class="space-y-2 text-sm">
                  <div
                    v-if="selected.gift"
                    class="rounded-md border border-admin-border bg-admin-bg/40 p-3"
                  >
                    <p class="font-medium">Gift · {{ selected.gift.giftName }}</p>
                    <p class="text-xs text-admin-subtext">
                      {{ formatCoins(selected.gift.coinCost) }} coins ·
                      {{ formatPoints(selected.gift.pointsAwarded) }} pts · ×{{ selected.gift.quantity }}
                    </p>
                    <p class="mt-1 break-all font-mono text-xs text-admin-muted">
                      {{ selected.gift.giftTransactionId }}
                    </p>
                  </div>
                  <div
                    v-if="selected.storeItem"
                    class="rounded-md border border-admin-border bg-admin-bg/40 p-3"
                  >
                    <p class="font-medium">Store · {{ selected.storeItem.name }}</p>
                    <p class="text-xs text-admin-subtext">
                      {{ selected.storeItem.category }} ·
                      {{ formatCoins(selected.storeItem.coinCost) }} coins
                    </p>
                  </div>
                  <div
                    v-if="selected.vipPurchase"
                    class="rounded-md border border-admin-border bg-admin-bg/40 p-3"
                  >
                    <p class="font-medium">
                      VIP · {{ selected.vipPurchase.tier }} ({{ selected.vipPurchase.periodDays }}d)
                    </p>
                    <p class="text-xs text-admin-subtext">
                      {{ formatCoins(Number(selected.vipPurchase.coinCost)) }} · expires
                      {{ formatDt(selected.vipPurchase.expiresAtAfter) }}
                    </p>
                  </div>
                  <div
                    v-if="selected.coinTradingTransfer"
                    class="rounded-md border border-admin-border bg-admin-bg/40 p-3"
                  >
                    <p class="font-medium">Trading transfer</p>
                    <p class="text-xs text-admin-subtext">
                      −{{ formatCoins(Number(selected.coinTradingTransfer.tradingCoinsDebited)) }}
                      → +{{ formatCoins(Number(selected.coinTradingTransfer.coinsCredited)) }}
                      ({{ selected.coinTradingTransfer.recipientWalletType }})
                    </p>
                    <p class="mt-1 break-all font-mono text-xs text-admin-muted">
                      {{ selected.coinTradingTransfer.id }}
                    </p>
                  </div>
                </div>
              </section>

              <section v-else-if="isGift(selected)">
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Gift catalog
                </h3>
                <div class="flex gap-3 rounded-md border border-admin-border bg-admin-bg/40 p-3">
                  <img
                    v-if="selected.gift.displayImageUrl"
                    :src="selected.gift.displayImageUrl"
                    :alt="selected.gift.name"
                    class="h-12 w-12 rounded-md object-cover"
                  />
                  <div class="min-w-0 text-sm">
                    <p class="font-medium">{{ selected.gift.name }}</p>
                    <p class="text-xs text-admin-subtext">
                      {{ selected.gift.code }}
                      <span v-if="selected.gift.vipOnly"> · VIP only</span>
                    </p>
                    <p v-if="selected.context" class="mt-1 text-xs text-admin-muted">
                      Context: {{ selected.context }}
                    </p>
                  </div>
                </div>
              </section>

              <section v-if="isTransfer(selected) && selected.reversedAt">
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Reversal
                </h3>
                <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                  <div class="admin-kv-row">
                    <span class="admin-kv-label">Reversed at</span>
                    <span class="admin-kv-value">{{ formatDt(selected.reversedAt) }}</span>
                  </div>
                  <div v-if="selected.reverseReason" class="admin-kv-row">
                    <span class="admin-kv-label">Reason</span>
                    <span class="admin-kv-value">{{ selected.reverseReason }}</span>
                  </div>
                  <div v-if="selected.reversedBy" class="admin-kv-row">
                    <span class="admin-kv-label">By</span>
                    <span class="admin-kv-value">{{ userLabel(selected.reversedBy) }}</span>
                  </div>
                </div>
              </section>
            </div>

            <div
              v-if="selectedCanRevert"
              class="shrink-0 border-t border-admin-border px-4 py-3 sm:px-5"
            >
              <button type="button" class="admin-btn-danger w-full" @click="openRevert">
                Revert transaction
              </button>
              <p class="mt-2 text-center text-xs text-admin-muted">
                Debits the receiver first, then credits the sender. Requires a reason.
              </p>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <BaseDialog title="Revert transaction" :open="revertOpen" size="md" @close="closeRevert">
      <template #body>
        <p class="mb-3 text-sm text-admin-subtext">
          This cannot be undone from the UI. Confirm both parties and amounts before continuing.
        </p>
        <label class="mb-1 block text-xs text-admin-subtext">Reason (required)</label>
        <textarea
          v-model="revertReason"
          class="admin-input min-h-[100px] resize-y"
          placeholder="Support ticket #… — confirmed fraud"
          maxlength="1000"
        />
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" :disabled="reverting" @click="closeRevert">
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-danger"
          :disabled="reverting || !revertReason.trim()"
          @click="confirmRevert"
        >
          {{ reverting ? 'Reverting…' : 'Confirm revert' }}
        </button>
      </template>
    </BaseDialog>
  </div>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-active aside,
.drawer-leave-active aside {
  transition: transform 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from aside,
.drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
