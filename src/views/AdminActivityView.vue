<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { format, parseISO } from 'date-fns'
import axios from 'axios'
import { adminActivityApi } from '@/api/adminActivity'
import type { AdminActivityAdminBrief, AdminActivityEntry } from '@/types/adminActivity'
import { showToast } from '@/utils/toast'
import { actionTypeLabel, destinationHref, groupActionTypes } from '@/utils/adminActivityLabels'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'

const entries = ref<AdminActivityEntry[]>([])
const actionTypes = ref<string[]>([])
const admins = ref<AdminActivityAdminBrief[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)

const filters = reactive({
  actionType: '',
  ipAddress: '',
  adminEmail: '',
  from: '',
  to: '',
})

const ROLE_GROUP_LABELS: Record<string, string> = {
  CUSTOMER_SUPPORT: 'Customer support',
  SUPER_ADMIN: 'Super admin',
  MODERATOR: 'Moderator',
  FINANCE: 'Finance',
  CONTENT: 'Content',
}

const adminGroups = computed(() => {
  const byRole = new Map<string, AdminActivityAdminBrief[]>()
  for (const admin of admins.value) {
    const list = byRole.get(admin.role) ?? []
    list.push(admin)
    byRole.set(admin.role, list)
  }
  const preferred = ['CUSTOMER_SUPPORT', 'SUPER_ADMIN', 'MODERATOR', 'FINANCE', 'CONTENT']
  const roles = [
    ...preferred.filter((role) => byRole.has(role)),
    ...[...byRole.keys()].filter((role) => !preferred.includes(role)).sort(),
  ]
  return roles.map((role) => ({
    role,
    label: ROLE_GROUP_LABELS[role] ?? role,
    admins: byRole.get(role) ?? [],
  }))
})

const actionTypeGroups = computed(() => groupActionTypes(actionTypes.value))

function destHref(row: AdminActivityEntry) {
  return destinationHref(row.destination.resourceType, row.destination.resourceId)
}

function formatDt(iso: string) {
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm:ss')
  } catch {
    return iso
  }
}

function listParams(cursor?: string) {
  return {
    limit: 30,
    actionType: filters.actionType || undefined,
    ipAddress: filters.ipAddress.trim() || undefined,
    adminEmail: filters.adminEmail.trim() || undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
    cursor,
  }
}

async function loadEntries(append = false) {
  if (append) {
    if (loadingMore.value || !hasMore.value || !nextCursor.value) return
    loadingMore.value = true
  } else {
    loading.value = true
  }
  try {
    const { data } = await adminActivityApi.list(listParams(append ? nextCursor.value ?? undefined : undefined))
    const next = data.entries ?? []
    entries.value = append ? [...entries.value, ...next] : next
    nextCursor.value = data.nextCursor ?? null
    hasMore.value = Boolean(data.hasMore)
  } catch (err) {
    if (!append) entries.value = []
    showToast(
      axios.isAxiosError(err)
        ? (err.response?.data as { code?: string; message?: string } | undefined)?.code ===
            'ADMIN_NOT_FOUND'
          ? 'Admin email not found'
          : err.response?.data?.message || 'Failed to load activity'
        : 'Failed to load activity',
      'error',
    )
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadActionTypes() {
  try {
    const { data } = await adminActivityApi.listActionTypes()
    actionTypes.value = data.actionTypes ?? []
  } catch {
    actionTypes.value = []
  }
}

async function loadAdmins() {
  try {
    const { data } = await adminActivityApi.listAdmins()
    admins.value = data.admins ?? []
  } catch {
    admins.value = []
  }
}

function applyFilters() {
  void loadEntries(false)
}

function resetFilters() {
  filters.actionType = ''
  filters.ipAddress = ''
  filters.adminEmail = ''
  filters.from = ''
  filters.to = ''
  void loadEntries(false)
}

const {
  sortKey: entriesSortKey,
  sortDir: entriesSortDir,
  sortedRows: sortedEntries,
  toggleSort: toggleEntriesSort,
} = useSortableRows(entries, (row, key) => {
  switch (key) {
    case 'createdAt':
      return row.createdAt ? new Date(row.createdAt).getTime() : 0
    case 'admin':
      return (row.admin?.displayName || row.admin?.email || '').toLowerCase()
    case 'actionType':
      return actionTypeLabel(row.actionType).toLowerCase()
    case 'targetUser':
      return (row.targetUser?.name || row.targetUser?.displayName || row.targetUser?.username || '').toLowerCase()
    case 'destination':
      return (row.destination.label || '').toLowerCase()
    case 'ipAddress':
      return (row.ipAddress || '').toLowerCase()
    case 'actionStatus':
      return row.actionStatus ?? ''
    default:
      return undefined
  }
})

onMounted(() => {
  void loadActionTypes()
  void loadAdmins()
  void loadEntries(false)
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Admin activity</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Audit trail of admin and super-admin actions — user, agency, payroll, catalog, settings, live, and messaging.
        </p>
      </div>
      <button type="button" class="admin-btn-secondary text-sm" :disabled="loading" @click="loadEntries(false)">
        Refresh
      </button>
    </div>

    <section class="admin-card space-y-3">
      <div class="admin-filter-bar">
        <select v-model="filters.actionType" class="admin-input" title="Action type">
          <option value="">All action types</option>
          <optgroup v-for="group in actionTypeGroups" :key="group.group" :label="group.group">
            <option v-for="t in group.types" :key="t" :value="t">{{ actionTypeLabel(t) }}</option>
          </optgroup>
        </select>
        <input v-model="filters.ipAddress" type="text" class="admin-input" placeholder="IP address" />
        <select v-model="filters.adminEmail" class="admin-input" title="Admin email">
          <option value="">All admin emails</option>
          <optgroup v-for="group in adminGroups" :key="group.role" :label="group.label">
            <option v-for="a in group.admins" :key="a.adminUserId" :value="a.email">
              {{ a.email }} ({{ a.displayName }})
            </option>
          </optgroup>
        </select>
        <input v-model="filters.from" type="date" class="admin-input" title="From" />
        <input v-model="filters.to" type="date" class="admin-input" title="To" />
        <button type="button" class="admin-btn-primary" :disabled="loading" @click="applyFilters">
          Search
        </button>
        <button type="button" class="admin-btn-secondary" :disabled="loading" @click="resetFilters">
          Reset
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <SortableTh label="When" sort-key="createdAt" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
              <SortableTh label="Admin" sort-key="admin" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
              <SortableTh label="Action" sort-key="actionType" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
              <SortableTh label="Target user" sort-key="targetUser" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
              <SortableTh label="Destination" sort-key="destination" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
              <SortableTh label="IP" sort-key="ipAddress" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
              <SortableTh label="Status" sort-key="actionStatus" :active-key="entriesSortKey" :direction="entriesSortDir" @sort="toggleEntriesSort" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedEntries" :key="row.id">
              <td class="whitespace-nowrap text-xs">{{ formatDt(row.createdAt) }}</td>
              <td>
                <template v-if="row.admin">
                  <p class="text-sm font-medium">{{ row.admin.displayName }}</p>
                  <p class="text-xs text-admin-muted">{{ row.admin.email }}</p>
                  <p class="text-xs text-admin-subtext">{{ row.admin.role }}</p>
                </template>
                <span v-else class="text-xs text-admin-muted">—</span>
              </td>
              <td>
                <p class="text-sm">{{ actionTypeLabel(row.actionType) }}</p>
                <p class="font-mono text-xs text-admin-muted">{{ row.actionType }}</p>
              </td>
              <td>
                <template v-if="row.targetUser">
                  <RouterLink
                    class="text-sm text-admin-accent underline"
                    :to="`/admin/users/${row.targetUser.userId}`"
                  >
                    {{ row.targetUser.name || row.targetUser.displayName || row.targetUser.username }}
                  </RouterLink>
                  <p class="text-xs text-admin-muted">#{{ row.targetUser.displayPublicId || row.targetUser.publicId }}</p>
                </template>
                <span v-else class="text-xs text-admin-muted">—</span>
              </td>
              <td class="max-w-xs text-xs text-admin-subtext">
                <RouterLink
                  v-if="destHref(row)"
                  class="text-admin-accent underline"
                  :to="destHref(row)"
                >
                  {{ row.destination.label }}
                </RouterLink>
                <p v-else>{{ row.destination.label }}</p>
                <p v-if="row.destination.resourceId" class="mt-0.5 font-mono text-admin-muted">
                  {{ row.destination.resourceType }} · {{ row.destination.resourceId.slice(0, 8) }}…
                </p>
              </td>
              <td class="font-mono text-xs">{{ row.ipAddress || '—' }}</td>
              <td>
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    row.actionStatus === 'success'
                      ? 'bg-admin-success/15 text-admin-success'
                      : 'bg-admin-danger/15 text-admin-danger'
                  "
                >
                  {{ row.actionStatus }}
                </span>
              </td>
            </tr>
            <tr v-if="loading && !entries.length">
              <td colspan="7" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!entries.length">
              <td colspan="7" class="py-10 text-center text-admin-muted">No activity found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        v-if="hasMore"
        type="button"
        class="admin-btn-secondary"
        :disabled="loadingMore"
        @click="loadEntries(true)"
      >
        {{ loadingMore ? 'Loading…' : 'Load more' }}
      </button>
    </section>
  </div>
</template>
