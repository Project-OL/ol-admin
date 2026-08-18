<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDistanceToNow } from 'date-fns'
import type { UserProfile, UserSearchResult } from '@/types/user'
import { formatCoins, formatINR, formatNumber, formatPoints } from '@/utils/format'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import { userAdminApi } from '@/api/userAdmin'
import { mapSearchUser } from '@/api/mappers'
import { useAuthStore } from '@/stores/auth'
import { mockUser } from '@/mocks/userDetail'
import { showToast } from '@/utils/toast'

const props = defineProps<{ user: UserProfile }>()

const richTierLabel = computed(() => {
  const name = props.user.richTier?.displayName?.trim()
  if (name) return name
  const tier = props.user.richTier?.tier ?? 0
  return tier > 0 ? `Tier ${tier}` : 'None'
})
const hasRichTier = computed(() => (props.user.richTier?.tier ?? 0) > 0)

const router = useRouter()
const copiedField = ref<'id' | 'publicId' | 'displayId' | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyValue(value: string, field: 'id' | 'publicId' | 'displayId') {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    copiedField.value = field
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedField.value = null
    }, 1500)
    showToast('Copied to clipboard', 'success')
  } catch {
    showToast('Failed to copy — select and copy manually', 'error')
  }
}

const auth = useAuthStore()
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref<UserSearchResult[]>([])
const showResults = ref(false)
const searchRoot = ref<HTMLElement | null>(null)

function resultLabel(u: UserSearchResult) {
  const legal = (u.name ?? '').trim()
  return legal || u.username || u.id.slice(0, 8)
}

function openUser(id: string) {
  showResults.value = false
  searchResults.value = []
  searchQuery.value = ''
  router.push(`/admin/users/${id}`)
}

async function handleSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  searching.value = true
  searchResults.value = []
  showResults.value = false
  try {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      openUser(mockUser.id)
      return
    }
    const { data } = await userAdminApi.searchUsers(q)
    const users = data.users.map(mapSearchUser)
    if (!users.length) {
      showToast('No users found', 'error')
      return
    }
    // Exact / single match → open; name multi-match → selectable list (do not auto-open first).
    if (users.length === 1) {
      openUser(users[0]!.id)
      return
    }
    searchResults.value = users
    showResults.value = true
  } catch {
    /* interceptor handles toast */
  } finally {
    searching.value = false
  }
}

function onDocClick(e: MouseEvent) {
  if (!searchRoot.value) return
  if (!searchRoot.value.contains(e.target as Node)) {
    showResults.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <div class="space-y-4">
    <!-- Top bar -->
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <form
        ref="searchRoot"
        class="relative flex w-full min-w-0 flex-1 flex-col gap-2 sm:max-w-xl sm:flex-row"
        @submit.prevent="handleSearch"
      >
        <input
          v-model="searchQuery"
          type="search"
          class="admin-input min-w-0 flex-1"
          placeholder="Search by User ID, first name, phone, email, device ID..."
          autocomplete="off"
          @focus="showResults = searchResults.length > 1"
        />
        <button type="submit" class="admin-btn-primary shrink-0 whitespace-nowrap" :disabled="searching">
          {{ searching ? 'Searching...' : 'Search' }}
        </button>

        <div
          v-if="showResults && searchResults.length > 1"
          class="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-admin-border bg-admin-card shadow-lg sm:right-auto sm:w-full"
        >
          <p class="border-b border-admin-border px-3 py-2 text-xs text-admin-muted">
            {{ searchResults.length }} matches — select a user
          </p>
          <button
            v-for="hit in searchResults"
            :key="hit.id"
            type="button"
            class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-admin-bg/80"
            @click="openUser(hit.id)"
          >
            <img
              v-if="hit.avatar"
              :src="hit.avatar"
              :alt="resultLabel(hit)"
              class="h-8 w-8 shrink-0 rounded-full object-cover"
            />
            <span
              v-else
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-admin-accent/20 text-xs font-bold text-admin-accent"
            >
              {{ resultLabel(hit).charAt(0).toUpperCase() }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ resultLabel(hit) }}</span>
              <span class="block truncate text-xs text-admin-subtext">
                <template v-if="hit.firstName || hit.lastName">
                  {{ [hit.firstName, hit.lastName].filter(Boolean).join(' ') }}
                  <template v-if="hit.username"> · </template>
                </template>
                <template v-if="hit.username">@{{ hit.username }} · </template>
                <span class="font-mono">{{ hit.publicId ?? hit.id.slice(0, 8) }}</span>
              </span>
            </span>
            <span class="shrink-0 rounded bg-admin-bg px-1.5 py-0.5 text-[10px] capitalize text-admin-muted">
              {{ hit.status ?? '—' }}
            </span>
          </button>
        </div>
      </form>
      <div class="flex shrink-0 items-center gap-2">
        <span v-if="auth.admin" class="text-sm text-admin-subtext">{{ auth.admin.role }}</span>
        <select class="admin-input w-auto py-1.5">
          <option>Admin Panel</option>
        </select>
      </div>
    </div>

    <!-- User identity + stats strip -->
    <div class="admin-card">
      <div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
        <img
          v-if="user.avatar"
          :src="user.avatar"
          :alt="user.name"
          class="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-admin-accent/30"
        />
        <div
          v-else
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-admin-accent/20 text-lg font-semibold text-admin-accent"
        >
          {{ user.name.slice(0, 2).toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1 basis-full sm:basis-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="break-words text-xl font-semibold">{{ user.name }}</h1>
            <span
              v-if="user.vip"
              class="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400"
            >
              VIP
            </span>
            <span
              v-if="hasRichTier"
              class="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-300"
            >
              {{ richTierLabel }}
            </span>
            <StatusBadge :status="user.status" />
          </div>
          <p v-if="user.username" class="mt-0.5 text-sm text-admin-subtext">@{{ user.username }}</p>
          <p class="mt-0.5 flex flex-wrap items-center gap-1 break-all text-sm text-admin-subtext">
            <span>ID: {{ user.id }}</span>
            <button
              type="button"
              class="inline-flex shrink-0 text-admin-muted transition-colors hover:text-admin-accent"
              title="Copy user ID"
              @click="copyValue(user.id, 'id')"
            >
              <svg v-if="copiedField === 'id'" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clip-rule="evenodd"
                />
              </svg>
              <svg v-else class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h6A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-1v-1h1V3.5h-6V4.5h-1V3.5Z" />
                <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h6A1.5 1.5 0 0 0 12 16.5v-9A1.5 1.5 0 0 0 10.5 6h-6Z" />
              </svg>
              <span class="sr-only">Copy user ID</span>
            </button>
          </p>
          <div class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-admin-subtext">
            <p v-if="user.publicId" class="flex items-center gap-1">
              Public ID:
              <span class="font-mono tabular-nums text-admin-text">{{ user.publicId }}</span>
              <button
                type="button"
                class="inline-flex shrink-0 text-admin-muted transition-colors hover:text-admin-accent"
                title="Copy public ID"
                @click="copyValue(user.publicId, 'publicId')"
              >
                <svg v-if="copiedField === 'publicId'" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                    clip-rule="evenodd"
                  />
                </svg>
                <svg v-else class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h6A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-1v-1h1V3.5h-6V4.5h-1V3.5Z" />
                  <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h6A1.5 1.5 0 0 0 12 16.5v-9A1.5 1.5 0 0 0 10.5 6h-6Z" />
                </svg>
                <span class="sr-only">Copy public ID</span>
              </button>
            </p>
            <p v-if="user.displayPublicId" class="flex items-center gap-1">
              Display ID:
              <span class="font-mono tabular-nums text-admin-text">{{ user.displayPublicId }}</span>
              <button
                type="button"
                class="inline-flex shrink-0 text-admin-muted transition-colors hover:text-admin-accent"
                title="Copy display ID"
                @click="copyValue(user.displayPublicId, 'displayId')"
              >
                <svg v-if="copiedField === 'displayId'" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                    clip-rule="evenodd"
                  />
                </svg>
                <svg v-else class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h6A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-1v-1h1V3.5h-6V4.5h-1V3.5Z" />
                  <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h6A1.5 1.5 0 0 0 12 16.5v-9A1.5 1.5 0 0 0 10.5 6h-6Z" />
                </svg>
                <span class="sr-only">Copy display ID</span>
              </button>
              <span
                v-if="user.vip && user.displayPublicId !== user.publicId"
                class="ml-1 text-xs text-amber-400"
              >VIP</span>
            </p>
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-3">
        <div class="min-w-max flex-1 rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Wealth Level</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ user.wealthLevel }}</p>
        </div>
        <div class="min-w-max flex-1 rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Stream Level</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ user.streamLevel }}</p>
        </div>
        <div class="min-w-max flex-1 rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Rich Tier</p>
          <p class="whitespace-nowrap text-lg font-semibold" :class="hasRichTier ? 'text-violet-300' : ''">
            {{ richTierLabel }}
          </p>
        </div>
        <div class="min-w-max flex-1 rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Wallet</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatCoins(user.walletCoins) }}</p>
        </div>
        <div class="min-w-max flex-1 rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Points</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatPoints(user.points) }}</p>
        </div>
        <div class="min-w-max flex-1 rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Total Earnings</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatINR(user.totalEarnings) }}</p>
        </div>
        <div class="min-w-max flex-1 rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Total Points</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatNumber(user.totalPoints) }}</p>
        </div>
        <div class="min-w-max flex-1 rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Total RC</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatCoins(user.totalRechargeCoin) }}</p>
        </div>
        <div class="min-w-max flex-1 rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Last Active</p>
          <p class="whitespace-nowrap text-sm font-medium">
            {{ formatDistanceToNow(new Date(user.lastActive), { addSuffix: true }) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
