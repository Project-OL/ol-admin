<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { format } from 'date-fns'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import { useUserDetailStore } from '@/stores/userDetail'
import { formatCoins, formatPoints } from '@/utils/format'
import type { TransactionParams } from '@/types/user'

const props = defineProps<{ userId: string }>()
const store = useUserDetailStore()

const activeTab = ref<'coins' | 'points' | 'trading'>('coins')
const typesFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const direction = ref<'credit' | 'debit' | ''>('')
const loading = ref(false)
const loadingMore = ref(false)
const scrollEl = ref<HTMLElement | null>(null)
const filterOptions = ref<string[]>([])

function getParams(): TransactionParams {
  return {
    limit: 20,
    types: typesFilter.value || undefined,
    from: dateFrom.value ? new Date(dateFrom.value).toISOString() : undefined,
    to: dateTo.value ? new Date(dateTo.value + 'T23:59:59').toISOString() : undefined,
    direction: direction.value || undefined,
  }
}

function currentRows() {
  if (activeTab.value === 'coins') return store.coinTransactions
  if (activeTab.value === 'points') return store.pointTransactions
  return store.tradingTransactions
}

function hasMore() {
  if (activeTab.value === 'coins') return store.coinHasMore
  if (activeTab.value === 'points') return store.pointHasMore
  return store.tradingHasMore
}

function currentCursor() {
  if (activeTab.value === 'coins') return store.coinCursor
  if (activeTab.value === 'points') return store.pointCursor
  return store.tradingCursor
}

async function loadTransactions() {
  loading.value = true
  try {
    const params = getParams()
    if (activeTab.value === 'coins') {
      await store.fetchCoinTransactions(props.userId, params, false)
    } else if (activeTab.value === 'points') {
      await store.fetchPointTransactions(props.userId, params, false)
    } else {
      await store.fetchTradingTransactions(props.userId, params, false)
    }
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore()) return
  const cursor = currentCursor()
  if (!cursor) return

  loadingMore.value = true
  try {
    const params = { ...getParams(), cursor }
    if (activeTab.value === 'coins') {
      await store.fetchCoinTransactions(props.userId, params, true)
    } else if (activeTab.value === 'points') {
      await store.fetchPointTransactions(props.userId, params, true)
    } else {
      await store.fetchTradingTransactions(props.userId, params, true)
    }
  } finally {
    loadingMore.value = false
  }
}

function onScroll() {
  const el = scrollEl.value
  if (!el || loadingMore.value || loading.value || !hasMore()) return
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48
  if (nearBottom) void loadMore()
}

function updateFilterOptions() {
  if (activeTab.value === 'coins') filterOptions.value = store.transactionFilterTypes.coins
  else if (activeTab.value === 'points') filterOptions.value = store.transactionFilterTypes.points
  else filterOptions.value = store.transactionFilterTypes.trading
}

function formatAmount(tx: { amount: number }, tab: string) {
  const abs = Math.abs(tx.amount)
  if (tab === 'points') return formatPoints(abs)
  return formatCoins(abs)
}

watch(activeTab, () => {
  typesFilter.value = ''
  direction.value = ''
  updateFilterOptions()
  loadTransactions()
})

watch([typesFilter, dateFrom, dateTo, direction], () => loadTransactions())

onMounted(async () => {
  await store.fetchTransactionFilterTypes()
  updateFilterOptions()
  loadTransactions()
})
</script>

<template>
  <div class="admin-card">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-1 rounded-lg bg-admin-bg p-1">
        <button
          v-for="tab in [
            { id: 'coins', label: 'Coins' },
            { id: 'points', label: 'Points' },
            { id: 'trading', label: 'Trading' },
          ]"
          :key="tab.id"
          type="button"
          :class="[
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === tab.id ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="activeTab = tab.id as typeof activeTab"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="admin-filter-bar w-full sm:w-auto">
        <input v-model="dateFrom" type="date" class="admin-input w-full min-w-0 py-1.5 text-xs sm:w-auto" />
        <input v-model="dateTo" type="date" class="admin-input w-full min-w-0 py-1.5 text-xs sm:w-auto" />
        <select
          v-if="filterOptions.length"
          v-model="typesFilter"
          class="admin-input w-full min-w-0 py-1.5 text-xs sm:w-auto sm:max-w-[180px]"
        >
          <option value="">All types</option>
          <option v-for="t in filterOptions" :key="t" :value="t">{{ t }}</option>
        </select>
        <select
          v-if="activeTab === 'trading'"
          v-model="direction"
          class="admin-input w-full min-w-0 py-1.5 text-xs sm:w-auto"
        >
          <option value="">All directions</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
      </div>
    </div>

    <div
      ref="scrollEl"
      class="admin-table-wrap max-h-80 overflow-y-auto"
      @scroll="onScroll"
    >
      <table class="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>ID</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in currentRows()" :key="tx.id">
            <td class="whitespace-nowrap text-xs">
              {{ format(new Date(tx.date), 'dd MMM yyyy HH:mm') }}
            </td>
            <td class="max-w-[100px] truncate font-mono text-xs">{{ tx.id }}</td>
            <td class="max-w-[160px] truncate">{{ tx.description }}</td>
            <td
              :class="[
                'font-medium tabular-nums',
                tx.amount >= 0 ? 'text-admin-success' : 'text-admin-danger',
              ]"
            >
              {{ tx.amount >= 0 ? '+' : '' }}{{ formatAmount(tx, activeTab) }}
            </td>
            <td><StatusBadge :status="tx.status" /></td>
          </tr>
          <tr v-if="loading && !currentRows().length">
            <td colspan="5" class="py-8 text-center text-admin-muted">Loading…</td>
          </tr>
          <tr v-else-if="!currentRows().length">
            <td colspan="5" class="py-8 text-center text-admin-muted">No transactions found</td>
          </tr>
          <tr v-if="loadingMore">
            <td colspan="5" class="py-3 text-center text-xs text-admin-muted">Loading more…</td>
          </tr>
          <tr v-else-if="currentRows().length && !hasMore()">
            <td colspan="5" class="py-3 text-center text-xs text-admin-muted">End of list</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
