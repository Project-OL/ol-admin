<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { format, parseISO } from 'date-fns'
import { useAgencyAdminStore } from '@/stores/agencyAdmin'
import type { AgencyHostEarningsItem, AgencyPeriod } from '@/types/agency'
import { formatNumber, formatPoints } from '@/utils/format'
import { showToast } from '@/utils/toast'
import axios from 'axios'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'

const props = defineProps<{
  identifier: string
}>()

const emit = defineEmits<{
  openCommission: [host: { hostPublicId: string; displayName: string }]
}>()

const store = useAgencyAdminStore()

const hosts = ref<AgencyHostEarningsItem[]>([])
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
})

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy')
  } catch {
    return iso
  }
}

function formatDuration(secondsRaw: string) {
  const seconds = Number(secondsRaw)
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function queryParams(cursor?: string) {
  const params: Record<string, string | number | undefined> = {
    limit: 20,
    cursor,
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
    const data = await store.fetchHostEarnings(
      props.identifier,
      queryParams(append ? nextCursor.value ?? undefined : undefined),
    )
    hosts.value = append ? [...hosts.value, ...data.hosts] : data.hosts
    nextCursor.value = data.nextCursor
    hasMore.value = data.hasMore
    period.value = data.period
    tier.value = data.commissionTier
  } catch (err) {
    if (!append) {
      hosts.value = []
      period.value = null
    }
    const msg = axios.isAxiosError(err)
      ? (err.response?.data as { message?: string } | undefined)?.message
      : undefined
    showToast(msg || 'Failed to load host earnings', 'error')
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

watch(
  () => props.identifier,
  () => {
    void load(false)
  },
)

const {
  sortKey: hostsSortKey,
  sortDir: hostsSortDir,
  sortedRows: sortedHosts,
  toggleSort: toggleHostsSort,
} = useSortableRows(hosts, (host, key) => {
  switch (key) {
    case 'host':
      return (host.displayName || host.username || '').toLowerCase()
    case 'joinedAt':
      return host.joinedAt ? new Date(host.joinedAt).getTime() : 0
    case 'hostEarningsPoints':
      return Number(host.hostEarningsPoints ?? 0)
    case 'hostCommissionPoints':
      return Number(host.hostCommissionPoints ?? 0)
    case 'totalPoints':
      return Number(host.totalPoints ?? 0)
    case 'liveDurationSeconds':
      return Number(host.liveDurationSeconds ?? 0)
    default:
      return undefined
  }
})

onMounted(() => {
  void load(false)
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">
          Hosts &amp; earnings
        </h2>
        <p v-if="period" class="mt-1 text-xs text-admin-muted">
          Window {{ period.from }} → {{ period.to }}
          <span v-if="tier"> · Tier {{ tier }}</span>
          <span class="block sm:inline sm:before:content-['·_']">
            Rolling window ends yesterday (not calendar month)
          </span>
        </p>
      </div>
    </div>

    <div class="admin-filter-bar">
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
    </div>

    <!-- Mobile cards -->
    <div class="space-y-2 md:hidden">
      <div v-if="loading && !hosts.length" class="py-8 text-center text-admin-muted">Loading…</div>
      <div v-else-if="!hosts.length" class="py-8 text-center text-admin-muted">No hosts on roster</div>
      <button
        v-for="host in hosts"
        :key="host.hostUserId"
        type="button"
        class="admin-card w-full text-left"
        @click="emit('openCommission', { hostPublicId: host.publicId || host.displayPublicId, displayName: host.displayName })"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ host.displayName || host.username }}</p>
            <p class="font-mono text-xs text-admin-muted">
              #{{ host.displayPublicId || host.publicId }}
            </p>
          </div>
          <p class="shrink-0 tabular-nums font-semibold">
            {{ formatPoints(Number(host.totalPoints)) }}
          </p>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-admin-subtext">
          <span>Host {{ formatPoints(Number(host.hostEarningsPoints)) }}</span>
          <span>Comm {{ formatPoints(Number(host.hostCommissionPoints)) }}</span>
          <span>Joined {{ formatDt(host.joinedAt) }}</span>
          <span>Live {{ formatDuration(host.liveDurationSeconds) }}</span>
        </div>
      </button>
    </div>

    <!-- Desktop table -->
    <div class="admin-table-wrap hidden md:block">
      <table class="admin-table">
        <thead>
          <tr>
            <SortableTh label="Host" sort-key="host" :active-key="hostsSortKey" :direction="hostsSortDir" @sort="toggleHostsSort" />
            <SortableTh label="Joined" sort-key="joinedAt" :active-key="hostsSortKey" :direction="hostsSortDir" @sort="toggleHostsSort" />
            <SortableTh label="Host earnings" sort-key="hostEarningsPoints" :active-key="hostsSortKey" :direction="hostsSortDir" @sort="toggleHostsSort" />
            <SortableTh label="Commission" sort-key="hostCommissionPoints" :active-key="hostsSortKey" :direction="hostsSortDir" @sort="toggleHostsSort" />
            <SortableTh label="Total" sort-key="totalPoints" :active-key="hostsSortKey" :direction="hostsSortDir" @sort="toggleHostsSort" />
            <SortableTh label="Live" sort-key="liveDurationSeconds" :active-key="hostsSortKey" :direction="hostsSortDir" @sort="toggleHostsSort" />
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="host in sortedHosts" :key="host.hostUserId">
            <td>
              <p class="font-medium">{{ host.displayName || host.username }}</p>
              <p class="font-mono text-xs text-admin-subtext">
                #{{ host.displayPublicId || host.publicId }}
                <span v-if="host.username"> · @{{ host.username }}</span>
              </p>
            </td>
            <td class="whitespace-nowrap text-xs">{{ formatDt(host.joinedAt) }}</td>
            <td class="tabular-nums">{{ formatPoints(Number(host.hostEarningsPoints)) }}</td>
            <td class="tabular-nums">{{ formatPoints(Number(host.hostCommissionPoints)) }}</td>
            <td class="tabular-nums font-medium">{{ formatPoints(Number(host.totalPoints)) }}</td>
            <td class="text-xs">{{ formatDuration(host.liveDurationSeconds) }}</td>
            <td class="text-right">
              <button
                type="button"
                class="admin-btn-secondary text-xs"
                @click="emit('openCommission', { hostPublicId: host.publicId || host.displayPublicId, displayName: host.displayName })"
              >
                Commission
              </button>
            </td>
          </tr>
          <tr v-if="loading && !hosts.length">
            <td colspan="7" class="py-10 text-center text-admin-muted">Loading…</td>
          </tr>
          <tr v-else-if="!hosts.length">
            <td colspan="7" class="py-10 text-center text-admin-muted">No hosts on roster</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="admin-pagination">
      <span>{{ formatNumber(hosts.length) }} loaded</span>
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
