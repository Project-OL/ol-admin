<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { userAdminApi } from '@/api/userAdmin'
import { mapSearchUser } from '@/api/mappers'
import type { UserSearchResult } from '@/types/user'
import type { AdminUserRegistrationStats } from '@/types/api'
import { mockUser } from '@/mocks/userDetail'
import { showToast } from '@/utils/toast'
import { formatNumber } from '@/utils/format'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'

const useMock = import.meta.env.VITE_USE_MOCK === 'true'

const query = ref('')
const searchType = ref('auto')
const loading = ref(false)
const results = ref<UserSearchResult[]>([])
const matchedBy = ref('')
const recent = ref<UserSearchResult[]>([])
const loadingHistory = ref(false)
const stats = ref<AdminUserRegistrationStats | null>(null)
const loadingStats = ref(false)
const registeredTodayUsers = ref<UserSearchResult[]>([])

/** Chip / list primary label: prefer composed legal `name`, else username. */
function chipLabel(user: UserSearchResult) {
  const legal = (user.name ?? '').trim()
  if (legal) return legal
  return user.username || user.id.slice(0, 8)
}

function chipInitial(user: UserSearchResult) {
  return chipLabel(user).charAt(0).toUpperCase() || '?'
}

async function loadStats() {
  if (useMock) {
    stats.value = {
      totalUsers: 12840,
      registeredToday: 37,
      todayStartsAt: new Date().toISOString(),
      users: [],
    }
    registeredTodayUsers.value = [
      {
        id: mockUser.id,
        name: mockUser.name,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        username: mockUser.username,
        publicId: mockUser.publicId,
        avatar: mockUser.avatar,
        status: mockUser.status,
        tags: mockUser.tags,
      },
    ]
    return
  }
  loadingStats.value = true
  try {
    const { data } = await userAdminApi.getRegistrationStats()
    stats.value = data
    registeredTodayUsers.value = (data.users ?? []).map(mapSearchUser)
  } catch {
    stats.value = null
    registeredTodayUsers.value = []
  } finally {
    loadingStats.value = false
  }
}

async function loadHistory() {
  if (useMock) {
    recent.value = [
      {
        id: mockUser.id,
        name: mockUser.name,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        username: mockUser.username,
        publicId: mockUser.publicId,
        avatar: mockUser.avatar,
        status: mockUser.status,
        tags: mockUser.tags,
      },
    ]
    return
  }
  loadingHistory.value = true
  try {
    const { data } = await userAdminApi.getSearchHistory()
    recent.value = data.users.map(mapSearchUser)
  } catch {
    recent.value = []
  } finally {
    loadingHistory.value = false
  }
}

async function search() {
  const q = query.value.trim()
  if (!q) return

  if ((searchType.value === 'name' || searchType.value === 'auto') && q.length < 2) {
    // Name resolution requires min 2 chars; auto may still resolve UUID/email/phone with shorter q.
    // Only block when explicitly searching by name.
    if (searchType.value === 'name') {
      showToast('Name search requires at least 2 characters', 'error')
      return
    }
  }

  loading.value = true
  results.value = []
  try {
    if (useMock) {
      results.value = [
        {
          id: mockUser.id,
          name: mockUser.name,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          username: mockUser.username,
          email: mockUser.email,
          publicId: mockUser.publicId,
          avatar: mockUser.avatar,
          status: mockUser.status,
        },
      ]
      matchedBy.value = 'mock'
      return
    }
    const { data } = await userAdminApi.searchUsers(q, searchType.value)
    matchedBy.value = data.matchedBy ?? ''
    results.value = data.users.map(mapSearchUser)
    if (!results.value.length) showToast('No users found', 'error')
    // Exact single-match search updates history server-side; refresh chips.
    // Name multi-match dumps are not written to history.
    if (results.value.length === 1) void loadHistory()
  } catch {
    /* interceptor handles toast */
  } finally {
    loading.value = false
  }
}

const {
  sortKey: registeredTodaySortKey,
  sortDir: registeredTodaySortDir,
  sortedRows: sortedRegisteredToday,
  toggleSort: toggleRegisteredTodaySort,
} = useSortableRows(registeredTodayUsers, (user, key) => {
  switch (key) {
    case 'user':
      return (user.username || chipLabel(user)).toLowerCase()
    case 'name':
      return chipLabel(user).toLowerCase()
    case 'email':
      return (user.email || '').toLowerCase()
    case 'status':
      return user.status ?? ''
    default:
      return undefined
  }
})

const {
  sortKey: resultsSortKey,
  sortDir: resultsSortDir,
  sortedRows: sortedResults,
  toggleSort: toggleResultsSort,
} = useSortableRows(results, (user, key) => {
  switch (key) {
    case 'user':
      return (user.username || chipLabel(user)).toLowerCase()
    case 'name':
      return chipLabel(user).toLowerCase()
    case 'email':
      return (user.email || '').toLowerCase()
    case 'status':
      return user.status ?? ''
    default:
      return undefined
  }
})

onMounted(() => {
  void loadHistory()
  void loadStats()
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
    <div class="admin-card">
    <h1 class="text-xl font-semibold">User Search</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Search by email, phone, user ID, public ID, device ID, or name (first name, last name, or both)
      </p>

      <div class="mt-5 grid grid-cols-2 gap-3">
        <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
          <p class="text-xs text-admin-subtext">Registered users</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">
            {{ loadingStats && !stats ? '…' : formatNumber(stats?.totalUsers ?? 0) }}
          </p>
          <p class="mt-0.5 text-xs text-admin-muted">All accounts still in the system</p>
        </div>
        <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
          <p class="text-xs text-admin-subtext">Registered today</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">
            {{ loadingStats && !stats ? '…' : formatNumber(stats?.registeredToday ?? 0) }}
          </p>
          <p class="mt-0.5 text-xs text-admin-muted">Since midnight UTC</p>
        </div>
      </div>

      <div class="admin-search-row mt-6">
        <input
          v-model="query"
          type="text"
          class="admin-input min-w-0 flex-1"
          placeholder="Jane, Jane Doe, user@example.com, +919876543210, UUID..."
          @keydown.enter="search"
        />
        <select v-model="searchType" class="admin-input w-full sm:w-36">
          <option value="auto">Auto</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="userId">User ID</option>
          <option value="publicId">Public ID</option>
          <option value="deviceId">Device ID</option>
          <option value="name">Name</option>
        </select>
        <button type="button" class="admin-btn-primary w-full shrink-0 sm:w-auto" :disabled="loading" @click="search">
          {{ loading ? 'Searching...' : 'Search' }}
        </button>
      </div>

      <div v-if="recent.length || loadingHistory" class="mt-6">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-admin-subtext">Recent</p>
        <p v-if="loadingHistory && !recent.length" class="text-xs text-admin-muted">Loading…</p>
        <div v-else class="flex flex-wrap gap-2">
          <RouterLink
            v-for="user in recent"
            :key="user.id"
            :to="`/admin/users/${user.id}`"
            class="inline-flex max-w-full items-center gap-2 rounded-md border border-admin-border bg-admin-bg/60 px-2.5 py-1.5 text-left text-sm transition-colors hover:border-admin-accent/40"
          >
            <img
              v-if="user.avatar"
              :src="user.avatar"
              :alt="chipLabel(user)"
              class="h-6 w-6 shrink-0 rounded-full object-cover"
            />
            <span
              v-else
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-admin-accent/20 text-[10px] font-bold text-admin-accent"
            >
              {{ chipInitial(user) }}
            </span>
            <span class="min-w-0 truncate font-medium">{{ chipLabel(user) }}</span>
            <span v-if="user.username && chipLabel(user) !== user.username" class="shrink-0 text-xs text-admin-muted">
              @{{ user.username }}
            </span>
            <span class="shrink-0 font-mono text-xs text-admin-muted">
              {{ user.publicId ?? user.id.slice(0, 8) }}
            </span>
          </RouterLink>
        </div>
      </div>

      <div v-if="registeredTodayUsers.length" class="mt-6">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-admin-subtext">
          Registered today
          <span v-if="stats" class="ml-1 font-normal normal-case text-admin-muted">
            ({{ formatNumber(registeredTodayUsers.length)
            }}{{ stats.usersTruncated ? ` of ${formatNumber(stats.registeredToday)}` : '' }})
          </span>
        </p>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="User" sort-key="user" :active-key="registeredTodaySortKey" :direction="registeredTodaySortDir" @sort="toggleRegisteredTodaySort" />
                <SortableTh label="Name" sort-key="name" :active-key="registeredTodaySortKey" :direction="registeredTodaySortDir" @sort="toggleRegisteredTodaySort" />
                <SortableTh label="Contact" sort-key="email" :active-key="registeredTodaySortKey" :direction="registeredTodaySortDir" @sort="toggleRegisteredTodaySort" />
                <SortableTh label="Status" sort-key="status" :active-key="registeredTodaySortKey" :direction="registeredTodaySortDir" @sort="toggleRegisteredTodaySort" />
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in sortedRegisteredToday" :key="user.id">
                <td>
                  <div class="flex items-center gap-3">
                    <img
                      v-if="user.avatar"
                      :src="user.avatar"
                      :alt="chipLabel(user)"
                      class="h-9 w-9 rounded-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-admin-accent/20 text-xs font-bold text-admin-accent"
                    >
                      {{ chipInitial(user) }}
                    </div>
                    <div>
                      <p class="font-medium">{{ user.username || chipLabel(user) }}</p>
                      <p class="font-mono text-xs text-admin-subtext">{{ user.publicId ?? user.id.slice(0, 8) }}</p>
                    </div>
                  </div>
                </td>
                <td class="text-xs">
                  <p class="font-medium text-admin-text">{{ chipLabel(user) }}</p>
                  <p class="text-admin-subtext">
                    {{ [user.firstName, user.lastName].filter(Boolean).join(' ') || '—' }}
                  </p>
                </td>
                <td class="text-xs">
                  <p>{{ user.email ?? '—' }}</p>
                  <p class="text-admin-subtext">{{ user.phone ?? '' }}</p>
                </td>
                <td>
                  <span class="rounded bg-admin-bg px-2 py-0.5 text-xs capitalize">{{ user.status ?? '—' }}</span>
                </td>
                <td class="text-right">
                  <RouterLink :to="`/admin/users/${user.id}`" class="admin-btn-secondary text-xs">
                    View
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="matchedBy && results.length" class="mt-4 text-xs text-admin-muted">
        Matched by: {{ matchedBy }}
        <span v-if="results.length > 1" class="ml-1">({{ results.length }} matches — select one)</span>
      </p>

      <div v-if="results.length" class="admin-table-wrap mt-4">
        <table class="admin-table">
          <thead>
            <tr>
              <SortableTh label="User" sort-key="user" :active-key="resultsSortKey" :direction="resultsSortDir" @sort="toggleResultsSort" />
              <SortableTh label="Name" sort-key="name" :active-key="resultsSortKey" :direction="resultsSortDir" @sort="toggleResultsSort" />
              <SortableTh label="Contact" sort-key="email" :active-key="resultsSortKey" :direction="resultsSortDir" @sort="toggleResultsSort" />
              <SortableTh label="Status" sort-key="status" :active-key="resultsSortKey" :direction="resultsSortDir" @sort="toggleResultsSort" />
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in sortedResults" :key="user.id">
              <td>
                <div class="flex items-center gap-3">
                  <img
                    v-if="user.avatar"
                    :src="user.avatar"
                    :alt="chipLabel(user)"
                    class="h-9 w-9 rounded-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-admin-accent/20 text-xs font-bold text-admin-accent"
                  >
                    {{ chipInitial(user) }}
                  </div>
                  <div>
                    <p class="font-medium">{{ user.username || chipLabel(user) }}</p>
                    <p class="font-mono text-xs text-admin-subtext">{{ user.publicId ?? user.id.slice(0, 8) }}</p>
                  </div>
                </div>
              </td>
              <td class="text-xs">
                <p class="font-medium text-admin-text">{{ chipLabel(user) }}</p>
                <p class="text-admin-subtext">
                  {{ [user.firstName, user.lastName].filter(Boolean).join(' ') || '—' }}
                </p>
              </td>
              <td class="text-xs">
                <p>{{ user.email ?? '—' }}</p>
                <p class="text-admin-subtext">{{ user.phone ?? '' }}</p>
              </td>
              <td>
                <span class="rounded bg-admin-bg px-2 py-0.5 text-xs capitalize">{{ user.status ?? '—' }}</span>
              </td>
              <td class="text-right">
                <RouterLink :to="`/admin/users/${user.id}`" class="admin-btn-secondary text-xs">
                  View
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <RouterLink
        v-if="useMock"
        :to="`/admin/users/${mockUser.id}`"
        class="admin-btn-secondary mt-6 block w-full text-center"
      >
        View Demo User ({{ mockUser.name }})
      </RouterLink>
    </div>
  </div>
</template>
