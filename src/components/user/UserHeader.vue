<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDistanceToNow } from 'date-fns'
import type { UserProfile } from '@/types/user'
import { formatCoins, formatINR, formatNumber, formatPoints } from '@/utils/format'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import { userAdminApi } from '@/api/userAdmin'
import { useAuthStore } from '@/stores/auth'
import { mockUser } from '@/mocks/userDetail'
import { showToast } from '@/utils/toast'

defineProps<{ user: UserProfile }>()

const router = useRouter()
const auth = useAuthStore()
const searchQuery = ref('')
const searching = ref(false)

async function handleSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  searching.value = true
  try {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      router.push(`/admin/users/${mockUser.id}`)
      return
    }
    const { data } = await userAdminApi.searchUsers(q)
    if (data.users.length > 0) {
      router.push(`/admin/users/${data.users[0]!.userId}`)
    } else {
      showToast('No users found', 'error')
    }
  } catch {
    router.push(`/admin/users/${mockUser.id}`)
  } finally {
    searching.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Top bar -->
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <form class="flex w-full min-w-0 flex-1 flex-col gap-2 sm:max-w-xl sm:flex-row" @submit.prevent="handleSearch">
        <input
          v-model="searchQuery"
          type="search"
          class="admin-input min-w-0 flex-1"
          placeholder="Search by User ID, Name, Phone, Email, Device ID..."
        />
        <button type="submit" class="admin-btn-primary shrink-0 whitespace-nowrap" :disabled="searching">
          {{ searching ? 'Searching...' : 'Search' }}
        </button>
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
            <StatusBadge :status="user.status" />
          </div>
          <p class="mt-0.5 break-all text-sm text-admin-subtext">ID: {{ user.id }}</p>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-3">
        <div class="w-max max-w-full rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Wealth Level</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ user.wealthLevel }}</p>
        </div>
        <div class="w-max max-w-full rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Stream Level</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ user.streamLevel }}</p>
        </div>
        <div class="w-max max-w-full rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Wallet</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatCoins(user.walletCoins) }}</p>
        </div>
        <div class="w-max max-w-full rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Points</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatPoints(user.points) }}</p>
        </div>
        <div class="w-max max-w-full rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Total Earnings</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatINR(user.totalEarnings) }}</p>
        </div>
        <div class="w-max max-w-full rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Total Points</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatNumber(user.totalPoints) }}</p>
        </div>
        <div class="w-max max-w-full rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Total RC</p>
          <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatCoins(user.totalRechargeCoin) }}</p>
        </div>
        <div class="w-max max-w-full rounded-md bg-admin-bg/60 px-3 py-2">
          <p class="text-xs text-admin-subtext">Last Active</p>
          <p class="whitespace-nowrap text-sm font-medium">
            {{ formatDistanceToNow(new Date(user.lastActive), { addSuffix: true }) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
