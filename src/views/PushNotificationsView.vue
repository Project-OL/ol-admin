<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { format, parseISO } from 'date-fns'
import axios from 'axios'
import { pushNotificationsApi } from '@/api/pushNotifications'
import SendPushDialog from '@/components/push/SendPushDialog.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'
import type {
  PushDelivery,
  PushDeliverySource,
  PushDeliveryStatus,
  PushEligibleUser,
  PushPayload,
  PushTodayStats,
} from '@/types/pushNotifications'
import { formatNumber, getInitials } from '@/utils/format'
import { showToast } from '@/utils/toast'

type Tab = 'overview' | 'users' | 'broadcast'

const SOURCE_LABELS: Record<PushDeliverySource, string> = {
  ADMIN_SINGLE: 'Admin single',
  ADMIN_BROADCAST: 'Admin broadcast',
  TRANSACTION: 'Transaction',
  NEW_MESSAGE: 'New message',
}

const STATUS_OPTIONS: { value: PushDeliveryStatus | ''; label: string }[] = [
  { value: '', label: 'All status' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'SKIPPED', label: 'Skipped' },
]

const SOURCE_OPTIONS: { value: PushDeliverySource | ''; label: string }[] = [
  { value: '', label: 'All sources' },
  { value: 'ADMIN_SINGLE', label: 'Admin single' },
  { value: 'ADMIN_BROADCAST', label: 'Admin broadcast' },
  { value: 'TRANSACTION', label: 'Transaction' },
  { value: 'NEW_MESSAGE', label: 'New message' },
]

const route = useRoute()
const router = useRouter()

const tab = ref<Tab>('overview')

const stats = ref<PushTodayStats | null>(null)
const loadingStats = ref(false)

const deliveries = ref<PushDelivery[]>([])
const deliveriesTotal = ref(0)
const deliveriesPage = ref(1)
const deliveriesLimit = 20
const loadingDeliveries = ref(false)

const deliveryFilters = reactive({
  status: '' as PushDeliveryStatus | '',
  source: '' as PushDeliverySource | '',
  campaignId: '',
  todayOnly: true,
})

const users = ref<PushEligibleUser[]>([])
const usersTotal = ref(0)
const usersPage = ref(1)
const usersLimit = 20
const loadingUsers = ref(false)
const selectedIds = ref<Set<string>>(new Set())

const userFilters = reactive({
  q: '',
  country: '',
  activeOnly: true,
})

type BroadcastMode = 'all' | 'country' | 'selected'
const broadcastMode = ref<BroadcastMode>('all')
const broadcastCountry = ref('')

const composeOpen = ref(false)
const composeMode = ref<'single' | 'selected' | 'broadcast'>('single')
const composeUserId = ref<string | null>(null)
const composeUserLabel = ref('')
const sending = ref(false)

/** Delivery log rows with expanded error text */
const expandedErrorIds = ref<Set<string>>(new Set())

function toggleErrorExpanded(id: string) {
  const next = new Set(expandedErrorIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedErrorIds.value = next
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  const body = err.response?.data as { code?: string; message?: string } | undefined
  if (body?.code === 'NO_PUSH_TOKEN') return 'User has no push token registered.'
  if (body?.code === 'PUSH_SEND_FAILED') return 'FCM rejected the send.'
  if (body?.code === 'FIREBASE_NOT_CONFIGURED') return 'Firebase is not configured on the server.'
  if (body?.message) return body.message
  return fallback
}

function formatDt(iso: string) {
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function statusBadge(status: PushDeliveryStatus) {
  if (status === 'SENT') return { status: 'success', label: 'Sent' }
  if (status === 'FAILED') return { status: 'failed', label: 'Failed' }
  return { status: 'warn', label: 'Skipped' }
}

function sourceLabel(source: string) {
  return SOURCE_LABELS[source as PushDeliverySource] ?? source
}

async function loadStats() {
  loadingStats.value = true
  try {
    const { data } = await pushNotificationsApi.getTodayStats()
    stats.value = data
  } catch {
    stats.value = null
    showToast('Failed to load today\'s push stats', 'error')
  } finally {
    loadingStats.value = false
  }
}

async function loadDeliveries(page = 1) {
  loadingDeliveries.value = true
  deliveriesPage.value = page
  try {
    const { data } = await pushNotificationsApi.listDeliveries({
      page,
      limit: deliveriesLimit,
      status: deliveryFilters.status || undefined,
      source: deliveryFilters.source || undefined,
      campaignId: deliveryFilters.campaignId.trim() || undefined,
      todayOnly: deliveryFilters.todayOnly,
    })
    deliveries.value = data.deliveries ?? []
    deliveriesTotal.value = data.pagination?.total ?? 0
  } catch {
    deliveries.value = []
    deliveriesTotal.value = 0
    showToast('Failed to load delivery logs', 'error')
  } finally {
    loadingDeliveries.value = false
  }
}

async function loadUsers(page = 1) {
  loadingUsers.value = true
  usersPage.value = page
  try {
    const { data } = await pushNotificationsApi.listUsers({
      page,
      limit: usersLimit,
      q: userFilters.q.trim() || undefined,
      country: userFilters.country.trim() || undefined,
      activeOnly: userFilters.activeOnly,
    })
    users.value = data.users ?? []
    usersTotal.value = data.pagination?.total ?? 0
  } catch {
    users.value = []
    usersTotal.value = 0
    showToast('Failed to load pushable users', 'error')
  } finally {
    loadingUsers.value = false
  }
}

function filterDeliveriesByStatus(status: PushDeliveryStatus) {
  deliveryFilters.status = status
  deliveryFilters.todayOnly = true
  tab.value = 'overview'
  loadDeliveries(1)
}

function applyDeliveryFilters() {
  loadDeliveries(1)
}

function resetDeliveryFilters() {
  deliveryFilters.status = ''
  deliveryFilters.source = ''
  deliveryFilters.campaignId =
    typeof route.query.campaignId === 'string' ? route.query.campaignId : ''
  deliveryFilters.todayOnly = true
  loadDeliveries(1)
}

function applyUserFilters() {
  loadUsers(1)
}

function resetUserFilters() {
  userFilters.q = typeof route.query.q === 'string' ? route.query.q : ''
  userFilters.country = ''
  userFilters.activeOnly = true
  selectedIds.value = new Set()
  loadUsers(1)
}

const allPageSelected = computed(
  () => users.value.length > 0 && users.value.every((u) => selectedIds.value.has(u.userId)),
)

function toggleSelectAll() {
  const next = new Set(selectedIds.value)
  if (allPageSelected.value) {
    for (const u of users.value) next.delete(u.userId)
  } else {
    for (const u of users.value) next.add(u.userId)
  }
  selectedIds.value = next
}

function toggleUser(userId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(userId)) next.delete(userId)
  else next.add(userId)
  selectedIds.value = next
}

const selectedCount = computed(() => selectedIds.value.size)

const composeSubtitle = computed(() => {
  if (composeMode.value === 'single') {
    return composeUserLabel.value ? `To: ${composeUserLabel.value}` : 'Send to one user'
  }
  if (composeMode.value === 'selected') {
    return `Broadcast to ${selectedCount.value} selected user${selectedCount.value === 1 ? '' : 's'}`
  }
  if (broadcastMode.value === 'country') {
    return `Broadcast to all pushable users in country “${broadcastCountry.value.trim().toUpperCase()}”`
  }
  return 'Broadcast to everyone with a push token (active, non-support)'
})

const composeRequiresConfirm = computed(
  () =>
    composeMode.value === 'broadcast' &&
    (broadcastMode.value === 'all' || broadcastMode.value === 'country'),
)

function openSendOne(user: PushEligibleUser) {
  composeMode.value = 'single'
  composeUserId.value = user.userId
  composeUserLabel.value = `${user.name} (@${user.username})`
  composeOpen.value = true
}

function openSendSelected() {
  if (!selectedCount.value) {
    showToast('Select at least one user', 'error')
    return
  }
  composeMode.value = 'selected'
  composeUserId.value = null
  composeUserLabel.value = ''
  composeOpen.value = true
}

function openBroadcastCompose() {
  if (broadcastMode.value === 'country' && !broadcastCountry.value.trim()) {
    showToast('Enter a country code', 'error')
    return
  }
  if (broadcastMode.value === 'selected') {
    if (!selectedCount.value) {
      showToast('Select users on the Pushable users tab first', 'error')
      return
    }
    composeMode.value = 'selected'
  } else {
    composeMode.value = 'broadcast'
  }
  composeUserId.value = null
  composeUserLabel.value = ''
  composeOpen.value = true
}

async function handleComposeConfirm(payload: PushPayload) {
  if (sending.value) return
  sending.value = true
  try {
    if (composeMode.value === 'single' && composeUserId.value) {
      await pushNotificationsApi.sendToUser(composeUserId.value, payload)
      showToast('Push sent', 'success')
      composeOpen.value = false
      await Promise.all([loadStats(), loadDeliveries(deliveriesPage.value)])
      return
    }

    const body =
      composeMode.value === 'selected'
        ? { ...payload, userIds: [...selectedIds.value] }
        : broadcastMode.value === 'country'
          ? { ...payload, country: broadcastCountry.value.trim() }
          : { ...payload }

    const { data } = await pushNotificationsApi.broadcast(body)
    showToast(`Broadcast queued · ${data.campaignId}`, 'success')
    composeOpen.value = false

    deliveryFilters.campaignId = data.campaignId
    deliveryFilters.status = ''
    deliveryFilters.todayOnly = false
    tab.value = 'overview'
    await Promise.all([loadStats(), loadDeliveries(1)])
    router.replace({ query: { ...route.query, campaignId: data.campaignId, tab: 'overview' } })
  } catch (err) {
    showToast(apiErrorMessage(err, 'Failed to send push'), 'error')
  } finally {
    sending.value = false
  }
}

const {
  sortKey: deliveriesSortKey,
  sortDir: deliveriesSortDir,
  sortedRows: sortedDeliveries,
  toggleSort: toggleDeliveriesSort,
} = useSortableRows(deliveries, (item, key) => {
  switch (key) {
    case 'createdAt':
      return item.createdAt ? new Date(item.createdAt).getTime() : 0
    case 'user':
      return (item.user.name || item.user.username || '').toLowerCase()
    case 'title':
      return item.title?.toLowerCase() ?? ''
    case 'status':
      return item.status ?? ''
    case 'source':
      return sourceLabel(item.source).toLowerCase()
    default:
      return undefined
  }
})

const {
  sortKey: usersSortKey,
  sortDir: usersSortDir,
  sortedRows: sortedUsers,
  toggleSort: toggleUsersSort,
} = useSortableRows(users, (user, key) => {
  switch (key) {
    case 'name':
      return (user.name || user.username || '').toLowerCase()
    case 'country':
      return (user.country || '').toLowerCase()
    case 'status':
      return user.status ?? ''
    case 'fcmTokenUpdatedAt':
      return user.fcmTokenUpdatedAt ? new Date(user.fcmTokenUpdatedAt).getTime() : 0
    default:
      return undefined
  }
})

function setTab(next: Tab) {
  tab.value = next
  router.replace({
    query: {
      ...route.query,
      tab: next,
    },
  })
  if (next === 'users' && !users.value.length && !loadingUsers.value) loadUsers(1)
}

watch(
  () => route.query.tab,
  (t) => {
    if (t === 'users' || t === 'broadcast' || t === 'overview') tab.value = t
  },
)

onMounted(async () => {
  const qTab = route.query.tab
  if (qTab === 'users' || qTab === 'broadcast' || qTab === 'overview') tab.value = qTab

  if (typeof route.query.campaignId === 'string') {
    deliveryFilters.campaignId = route.query.campaignId
    deliveryFilters.todayOnly = false
  }
  if (typeof route.query.status === 'string') {
    const s = route.query.status.toUpperCase()
    if (s === 'SENT' || s === 'FAILED' || s === 'SKIPPED') {
      deliveryFilters.status = s
    }
  }
  if (typeof route.query.q === 'string') {
    userFilters.q = route.query.q
    if (tab.value === 'overview' && !route.query.tab) tab.value = 'users'
  }
  if (route.query.send === '1' && typeof route.query.userId === 'string') {
    composeMode.value = 'single'
    composeUserId.value = route.query.userId
    composeUserLabel.value =
      typeof route.query.userLabel === 'string' ? route.query.userLabel : route.query.userId
    composeOpen.value = true
  }

  await Promise.all([
    loadStats(),
    loadDeliveries(1),
    tab.value === 'users' || tab.value === 'broadcast' ? loadUsers(1) : Promise.resolve(),
  ])
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold sm:text-2xl">Push Notifications</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Today’s delivery stats, logs, pushable users, and broadcasts (FCM)
        </p>
      </div>
      <div class="flex w-full gap-1 rounded-lg border border-admin-border bg-admin-surface p-1 lg:w-auto">
        <button
          type="button"
          :class="[
            'min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm lg:flex-none',
            tab === 'overview'
              ? 'bg-admin-accent/15 text-admin-accent'
              : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="setTab('overview')"
        >
          Overview
        </button>
        <button
          type="button"
          :class="[
            'min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm lg:flex-none',
            tab === 'users'
              ? 'bg-admin-accent/15 text-admin-accent'
              : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="setTab('users')"
        >
          <span class="sm:hidden">Users</span>
          <span class="hidden sm:inline">Pushable users</span>
        </button>
        <button
          type="button"
          :class="[
            'min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm lg:flex-none',
            tab === 'broadcast'
              ? 'bg-admin-accent/15 text-admin-accent'
              : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="setTab('broadcast')"
        >
          Broadcast
        </button>
      </div>
    </div>

    <!-- Overview -->
    <template v-if="tab === 'overview'">
      <section class="space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-lg font-medium">
            Today
            <span v-if="stats" class="text-sm font-normal text-admin-muted">
              {{ stats.date }} ({{ stats.timezone }})
            </span>
          </h2>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="loadingStats"
            @click="loadStats"
          >
            Refresh
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            class="admin-card !p-3 text-left transition hover:border-admin-accent/40"
            @click="filterDeliveriesByStatus('SENT')"
          >
            <p class="text-xs text-admin-subtext">Sent today</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-success">
              {{ loadingStats ? '…' : formatNumber(stats?.sent ?? 0) }}
            </p>
          </button>
          <button
            type="button"
            class="admin-card !p-3 text-left transition hover:border-admin-accent/40"
            @click="filterDeliveriesByStatus('FAILED')"
          >
            <p class="text-xs text-admin-subtext">Failed today</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-danger">
              {{ loadingStats ? '…' : formatNumber(stats?.failed ?? 0) }}
            </p>
          </button>
          <button
            type="button"
            class="admin-card !p-3 text-left transition hover:border-admin-accent/40"
            @click="filterDeliveriesByStatus('SKIPPED')"
          >
            <p class="text-xs text-admin-subtext">Skipped today</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-warn">
              {{ loadingStats ? '…' : formatNumber(stats?.skipped ?? 0) }}
            </p>
          </button>
          <div class="admin-card !p-3">
            <p class="text-xs text-admin-subtext">Total logged</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-accent">
              {{ loadingStats ? '…' : formatNumber(stats?.total ?? 0) }}
            </p>
          </div>
        </div>

        <div
          v-if="stats && Object.keys(stats.bySource).length"
          class="flex flex-wrap gap-2 text-xs"
        >
          <span
            v-for="(row, key) in stats.bySource"
            :key="key"
            class="rounded-md bg-admin-bg px-2.5 py-1 text-admin-subtext"
          >
            {{ sourceLabel(String(key)) }}:
            {{ formatNumber(row.sent) }} sent /
            {{ formatNumber(row.failed) }} failed /
            {{ formatNumber(row.total) }} total
          </span>
        </div>
      </section>

      <section class="admin-card">
        <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-lg font-medium">Delivery log</h2>
          <span class="text-xs text-admin-muted">{{ formatNumber(deliveriesTotal) }} total</span>
        </div>

        <div class="mb-4 flex flex-wrap gap-2">
          <select v-model="deliveryFilters.status" class="admin-input w-auto">
            <option v-for="opt in STATUS_OPTIONS" :key="opt.value || 'all'" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <select v-model="deliveryFilters.source" class="admin-input w-auto">
            <option v-for="opt in SOURCE_OPTIONS" :key="opt.value || 'all'" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <input
            v-model="deliveryFilters.campaignId"
            type="text"
            class="admin-input min-w-0 w-full flex-1 sm:min-w-[200px]"
            placeholder="Campaign ID"
          />
          <label class="flex items-center gap-2 text-sm text-admin-subtext">
            <input v-model="deliveryFilters.todayOnly" type="checkbox" class="rounded" />
            Today only (UTC)
          </label>
          <button
            type="button"
            class="admin-btn-primary"
            :disabled="loadingDeliveries"
            @click="applyDeliveryFilters"
          >
            {{ loadingDeliveries ? 'Loading…' : 'Search' }}
          </button>
          <button
            type="button"
            class="admin-btn-secondary"
            :disabled="loadingDeliveries"
            @click="resetDeliveryFilters"
          >
            Reset
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Time" sort-key="createdAt" :active-key="deliveriesSortKey" :direction="deliveriesSortDir" @sort="toggleDeliveriesSort" />
                <SortableTh label="User" sort-key="user" :active-key="deliveriesSortKey" :direction="deliveriesSortDir" @sort="toggleDeliveriesSort" />
                <SortableTh label="Notification" sort-key="title" :active-key="deliveriesSortKey" :direction="deliveriesSortDir" @sort="toggleDeliveriesSort" />
                <SortableTh label="Status" sort-key="status" :active-key="deliveriesSortKey" :direction="deliveriesSortDir" @sort="toggleDeliveriesSort" />
                <SortableTh label="Source" sort-key="source" :active-key="deliveriesSortKey" :direction="deliveriesSortDir" @sort="toggleDeliveriesSort" />
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in sortedDeliveries" :key="item.id">
                <td class="whitespace-nowrap text-xs">{{ formatDt(item.createdAt) }}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <img
                      v-if="item.user.avatarUrl"
                      :src="item.user.avatarUrl"
                      :alt="item.user.name"
                      class="h-8 w-8 rounded-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-8 w-8 items-center justify-center rounded-full bg-admin-accent/20 text-[10px] font-bold text-admin-accent"
                    >
                      {{ getInitials(item.user.name || item.user.username) }}
                    </div>
                    <div>
                      <p class="text-sm font-medium">{{ item.user.name }}</p>
                      <p class="font-mono text-xs text-admin-subtext">
                        @{{ item.user.username }} · {{ item.user.displayPublicId }}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <p class="text-sm font-medium">{{ item.title }}</p>
                  <p class="max-w-[280px] truncate text-xs text-admin-subtext" :title="item.body">
                    {{ item.body }}
                  </p>
                  <p
                    v-if="item.campaignId"
                    class="mt-0.5 max-w-[280px] truncate font-mono text-[10px] text-admin-muted"
                    :title="item.campaignId"
                  >
                    {{ item.campaignId }}
                  </p>
                </td>
                <td>
                  <StatusBadge
                    :status="statusBadge(item.status).status"
                    :label="statusBadge(item.status).label"
                  />
                </td>
                <td class="text-sm">{{ sourceLabel(item.source) }}</td>
                <td class="max-w-[260px] align-top">
                  <button
                    v-if="item.errorCode"
                    type="button"
                    class="group w-full text-left"
                    :aria-expanded="expandedErrorIds.has(item.id)"
                    :title="
                      expandedErrorIds.has(item.id)
                        ? 'Click to collapse'
                        : 'Click to show full error'
                    "
                    @click="toggleErrorExpanded(item.id)"
                  >
                    <p
                      :class="[
                        'font-mono text-xs text-admin-danger',
                        expandedErrorIds.has(item.id)
                          ? 'whitespace-pre-wrap break-all'
                          : 'truncate',
                      ]"
                    >
                      {{ item.errorCode }}
                    </p>
                    <span
                      class="mt-0.5 inline-block text-[10px] text-admin-muted group-hover:text-admin-accent"
                    >
                      {{ expandedErrorIds.has(item.id) ? 'Show less' : 'Show more' }}
                    </span>
                  </button>
                  <span v-else class="text-admin-muted">—</span>
                </td>
              </tr>
              <tr v-if="loadingDeliveries && !deliveries.length">
                <td colspan="6" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!deliveries.length">
                <td colspan="6" class="py-10 text-center text-admin-muted">No deliveries found</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination mt-4">
          <span>{{ formatNumber(deliveriesTotal) }} total</span>
          <div class="flex items-center gap-2">
            <span class="text-xs">Page {{ deliveriesPage }}</span>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="deliveriesPage <= 1 || loadingDeliveries"
              @click="loadDeliveries(deliveriesPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="deliveriesPage * deliveriesLimit >= deliveriesTotal || loadingDeliveries"
              @click="loadDeliveries(deliveriesPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </template>

    <!-- Pushable users -->
    <template v-else-if="tab === 'users'">
      <section class="admin-card">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-medium">Users with a push token</h2>
            <p class="text-xs text-admin-muted">
              Raw FCM tokens are never exposed. Sorted by newest token registration.
            </p>
          </div>
          <button
            type="button"
            class="admin-btn-primary text-sm"
            :disabled="!selectedCount"
            @click="openSendSelected"
          >
            Send to selected ({{ selectedCount }})
          </button>
        </div>

        <div class="mb-4 flex flex-wrap gap-2">
          <input
            v-model="userFilters.q"
            type="text"
            class="admin-input min-w-0 w-full flex-1 sm:min-w-[200px]"
            placeholder="Search name, username, public ID"
            @keydown.enter="applyUserFilters"
          />
          <input
            v-model="userFilters.country"
            type="text"
            class="admin-input w-24"
            placeholder="Country"
            maxlength="8"
          />
          <label class="flex items-center gap-2 text-sm text-admin-subtext">
            <input v-model="userFilters.activeOnly" type="checkbox" class="rounded" />
            Active only
          </label>
          <button
            type="button"
            class="admin-btn-primary"
            :disabled="loadingUsers"
            @click="applyUserFilters"
          >
            {{ loadingUsers ? 'Loading…' : 'Search' }}
          </button>
          <button
            type="button"
            class="admin-btn-secondary"
            :disabled="loadingUsers"
            @click="resetUserFilters"
          >
            Reset
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th class="w-10">
                  <input
                    type="checkbox"
                    :checked="allPageSelected"
                    :disabled="!users.length"
                    @change="toggleSelectAll"
                  />
                </th>
                <SortableTh label="User" sort-key="name" :active-key="usersSortKey" :direction="usersSortDir" @sort="toggleUsersSort" />
                <SortableTh label="Country" sort-key="country" :active-key="usersSortKey" :direction="usersSortDir" @sort="toggleUsersSort" />
                <SortableTh label="Status" sort-key="status" :active-key="usersSortKey" :direction="usersSortDir" @sort="toggleUsersSort" />
                <SortableTh label="Token updated" sort-key="fcmTokenUpdatedAt" :active-key="usersSortKey" :direction="usersSortDir" @sort="toggleUsersSort" />
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in sortedUsers" :key="user.userId">
                <td>
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(user.userId)"
                    @change="toggleUser(user.userId)"
                  />
                </td>
                <td>
                  <div class="flex items-center gap-3">
                    <img
                      v-if="user.avatarUrl"
                      :src="user.avatarUrl"
                      :alt="user.name"
                      class="h-9 w-9 rounded-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-admin-accent/20 text-xs font-bold text-admin-accent"
                    >
                      {{ getInitials(user.name || user.username) }}
                    </div>
                    <div>
                      <p class="font-medium">{{ user.name }}</p>
                      <p class="font-mono text-xs text-admin-subtext">
                        @{{ user.username }} · {{ user.displayPublicId }}
                      </p>
                    </div>
                    <span
                      class="rounded-full bg-admin-success/15 px-2 py-0.5 text-[10px] font-medium text-admin-success"
                    >
                      FCM
                    </span>
                  </div>
                </td>
                <td>{{ user.country ?? '—' }}</td>
                <td>
                  <span class="rounded bg-admin-bg px-2 py-0.5 text-xs capitalize">
                    {{ user.status }}
                  </span>
                </td>
                <td class="whitespace-nowrap text-xs">
                  {{ user.fcmTokenUpdatedAt ? formatDt(user.fcmTokenUpdatedAt) : '—' }}
                </td>
                <td class="text-right">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="admin-btn-primary text-xs"
                      @click="openSendOne(user)"
                    >
                      Send one
                    </button>
                    <RouterLink
                      :to="`/admin/users/${user.userId}`"
                      class="admin-btn-secondary text-xs"
                    >
                      Profile
                    </RouterLink>
                  </div>
                </td>
              </tr>
              <tr v-if="loadingUsers && !users.length">
                <td colspan="6" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!users.length">
                <td colspan="6" class="py-10 text-center text-admin-muted">
                  No users with a push token found
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination mt-4">
          <span>{{ formatNumber(usersTotal) }} total · {{ selectedCount }} selected</span>
          <div class="flex items-center gap-2">
            <span class="text-xs">Page {{ usersPage }}</span>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="usersPage <= 1 || loadingUsers"
              @click="loadUsers(usersPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="usersPage * usersLimit >= usersTotal || loadingUsers"
              @click="loadUsers(usersPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </template>

    <!-- Broadcast -->
    <template v-else>
      <section class="admin-card max-w-xl space-y-5">
        <div>
          <h2 class="text-lg font-medium">Broadcast composer</h2>
          <p class="mt-1 text-sm text-admin-subtext">
            Queues an async campaign (worker required). Cap 50,000 recipients for country / all.
          </p>
        </div>

        <div class="space-y-2">
          <p class="text-xs font-medium text-admin-subtext">Targeting</p>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="broadcastMode" type="radio" value="all" />
            Everyone with a token
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="broadcastMode" type="radio" value="country" />
            Country
          </label>
          <input
            v-if="broadcastMode === 'country'"
            v-model="broadcastCountry"
            type="text"
            class="admin-input ml-6 w-32"
            placeholder="e.g. IN"
            maxlength="8"
          />
          <label class="flex items-center gap-2 text-sm">
            <input v-model="broadcastMode" type="radio" value="selected" />
            Specific users ({{ selectedCount }} selected on Pushable users)
          </label>
        </div>

        <button type="button" class="admin-btn-primary" @click="openBroadcastCompose">
          Compose &amp; queue
        </button>
      </section>
    </template>

    <SendPushDialog
      :open="composeOpen"
      :subtitle="composeSubtitle"
      :confirm-label="composeMode === 'single' ? 'Send now' : 'Queue broadcast'"
      :require-confirm-text="composeRequiresConfirm"
      @close="composeOpen = false"
      @confirm="handleComposeConfirm"
    />
  </div>
</template>
