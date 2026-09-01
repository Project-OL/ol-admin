<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { format, parseISO } from 'date-fns'
import axios from 'axios'
import { useAgencyAdminStore } from '@/stores/agencyAdmin'
import type { AgencyCommissionHistoryEntry, AgencyPeriod } from '@/types/agency'
import { formatNumber, formatPoints } from '@/utils/format'
import { showToast } from '@/utils/toast'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'

const props = defineProps<{
  identifier: string
  initialHostPublicId?: string
}>()

const store = useAgencyAdminStore()

const entries = ref<AgencyCommissionHistoryEntry[]>([])
const period = ref<AgencyPeriod | null>(null)
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const tier = ref('')

const filters = reactive({
  mode: 'days' as 'days' | 'range',
  periodDays: 30,
  from: '',
  to: '',
  hostPublicId: '',
})

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function rateLabel(rateBp: number | null | undefined) {
  if (rateBp == null) return '—'
  return `${(rateBp / 100).toFixed(2)}%`
}

function queryParams(cursor?: string) {
  const params: Record<string, string | number | undefined> = {
    limit: 20,
    cursor,
    hostPublicId: filters.hostPublicId.trim() || undefined,
  }
  if (filters.mode === 'range' && filters.from && filters.to) {
    params.from = filters.from
    params.to = filters.to
  } else {
    params.periodDays = filters.periodDays
  }
  return params
}

async function load(append = false) {
  if (append) {
    if (loadingMore.value || !hasMore.value || !nextCursor.value) return
    loadingMore.value = true
  } else {
    loading.value = true
  }
  try {
    const data = await store.fetchCommissionHistory(
      props.identifier,
      queryParams(append ? nextCursor.value ?? undefined : undefined),
    )
    entries.value = append ? [...entries.value, ...data.entries] : data.entries
    nextCursor.value = data.nextCursor
    hasMore.value = data.hasMore
    period.value = data.period
    tier.value = data.commissionTier
  } catch (err) {
    if (!append) {
      entries.value = []
      period.value = null
    }
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'USER_NOT_FOUND') {
        showToast('No host found for that public ID', 'error')
        return
      }
    }
    showToast('Failed to load commission history', 'error')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function applyFilters() {
  if (filters.mode === 'range' && (!filters.from || !filters.to)) {
    showToast('Choose both from and to dates', 'error')
    return
  }
  void load(false)
}

function setHostFilter(publicId: string) {
  filters.hostPublicId = publicId
  void load(false)
}

watch(
  () => props.identifier,
  () => {
    void load(false)
  },
)

watch(
  () => props.initialHostPublicId,
  (id) => {
    if (id) setHostFilter(id)
  },
)

onMounted(() => {
  if (props.initialHostPublicId) filters.hostPublicId = props.initialHostPublicId
  void load(false)
})

const {
  sortKey: entriesSortKey,
  sortDir: entriesSortDir,
  sortedRows: sortedEntries,
  toggleSort: toggleEntriesSort,
} = useSortableRows(entries, (entry, key) => {
  switch (key) {
    case 'createdAt':
      return entry.createdAt ? new Date(entry.createdAt).getTime() : 0
    case 'host':
      return (entry.host?.displayName || '').toLowerCase()
    case 'category':
      return (entry.category || '').toLowerCase()
    case 'hostTxType':
      return (entry.hostTxType || '').toLowerCase()
    case 'rateBp':
      return entry.rateBp ?? -1
    case 'amount':
      return Number(entry.amount ?? 0)
    case 'balanceAfter':
      return Number(entry.balanceAfter ?? 0)
    default:
      return undefined
  }
})

defineExpose({ setHostFilter })
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">
        Commission history
      </h2>
      <p v-if="period" class="mt-1 text-xs text-admin-muted">
        Window {{ period.from }} → {{ period.to }}
        <span v-if="tier"> · Tier {{ tier }}</span>
        · Per-credit AGENT_COMMISSION ledger
      </p>
    </div>

    <div class="admin-filter-bar">
      <input
        v-model="filters.hostPublicId"
        type="search"
        class="admin-input min-w-0 w-full flex-1 sm:min-w-[140px]"
        placeholder="Host public ID (optional)"
        @keydown.enter="applyFilters"
      />
      <select v-model="filters.mode" class="admin-input w-full sm:w-auto">
        <option value="days">Rolling days</option>
        <option value="range">Date range</option>
      </select>
      <select
        v-if="filters.mode === 'days'"
        v-model.number="filters.periodDays"
        class="admin-input w-full sm:w-auto"
      >
        <option :value="7">7 days</option>
        <option :value="14">14 days</option>
        <option :value="30">30 days</option>
        <option :value="60">60 days</option>
        <option :value="90">90 days</option>
      </select>
      <template v-else>
        <input v-model="filters.from" type="date" class="admin-input w-full sm:w-auto" title="From" />
        <input v-model="filters.to" type="date" class="admin-input w-full sm:w-auto" title="To" />
      </template>
      <button type="button" class="admin-btn-primary w-full sm:w-auto" :disabled="loading" @click="applyFilters">
        {{ loading ? 'Loading…' : 'Apply' }}
      </button>
      <button
        v-if="filters.hostPublicId"
        type="button"
        class="admin-btn-secondary w-full sm:w-auto"
        @click="filters.hostPublicId = ''; applyFilters()"
      >
        Clear host
      </button>
    </div>

    <!-- Mobile -->
    <div class="space-y-2 md:hidden">
      <div v-if="loading && !entries.length" class="py-8 text-center text-admin-muted">Loading…</div>
      <div v-else-if="!entries.length" class="py-8 text-center text-admin-muted">No commission credits</div>
      <div v-for="entry in entries" :key="entry.id" class="admin-card">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium">{{ entry.host?.displayName ?? 'Unknown host' }}</p>
            <p class="font-mono text-xs text-admin-muted">
              #{{ entry.host?.displayPublicId || entry.host?.publicId || '—' }}
            </p>
          </div>
          <p class="shrink-0 tabular-nums font-semibold text-emerald-400">
            +{{ formatPoints(Number(entry.amount)) }}
          </p>
        </div>
        <div class="mt-2 flex flex-wrap gap-2 text-xs text-admin-subtext">
          <span>{{ formatDt(entry.createdAt) }}</span>
          <span v-if="entry.category">{{ entry.category }}</span>
          <span v-if="entry.hostTxType">{{ entry.hostTxType }}</span>
          <span>{{ rateLabel(entry.rateBp) }}</span>
        </div>
      </div>
    </div>

    <!-- Desktop -->
    <div class="admin-table-wrap hidden md:block">
      <table class="admin-table">
        <thead>
          <tr>
            <SortableTh label="When" sort-key="createdAt" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
            <SortableTh label="Host" sort-key="host" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
            <SortableTh label="Category" sort-key="category" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
            <SortableTh label="Host tx" sort-key="hostTxType" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
            <SortableTh label="Rate" sort-key="rateBp" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
            <SortableTh label="Amount" sort-key="amount" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
            <SortableTh label="Balance" sort-key="balanceAfter" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in sortedEntries" :key="entry.id">
            <td class="whitespace-nowrap text-xs">{{ formatDt(entry.createdAt) }}</td>
            <td>
              <p class="text-sm font-medium">{{ entry.host?.displayName ?? '—' }}</p>
              <p class="font-mono text-xs text-admin-subtext">
                #{{ entry.host?.displayPublicId || entry.host?.publicId || '—' }}
              </p>
            </td>
            <td class="text-xs">{{ entry.category ?? '—' }}</td>
            <td class="font-mono text-xs">{{ entry.hostTxType ?? '—' }}</td>
            <td class="text-xs">{{ rateLabel(entry.rateBp) }}</td>
            <td class="tabular-nums font-medium text-emerald-400">
              +{{ formatPoints(Number(entry.amount)) }}
            </td>
            <td class="tabular-nums text-xs text-admin-subtext">
              {{ formatPoints(Number(entry.balanceAfter)) }}
            </td>
          </tr>
          <tr v-if="loading && !entries.length">
            <td colspan="7" class="py-10 text-center text-admin-muted">Loading…</td>
          </tr>
          <tr v-else-if="!entries.length">
            <td colspan="7" class="py-10 text-center text-admin-muted">No commission credits</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="admin-pagination">
      <span>{{ formatNumber(entries.length) }} loaded</span>
      <button
        type="button"
        class="admin-btn-secondary text-sm"
        :disabled="!hasMore || loadingMore || loading"
        @click="load(true)"
      >
        {{ loadingMore ? 'Loading…' : 'Load more' }}
      </button>
    </div>
  </div>
</template>
