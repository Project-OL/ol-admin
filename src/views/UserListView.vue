<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { userAdminApi } from '@/api/userAdmin'
import { mapSearchUser } from '@/api/mappers'
import type { UserSearchResult } from '@/types/user'
import { mockUser } from '@/mocks/userDetail'
import { showToast } from '@/utils/toast'

const router = useRouter()
const useMock = import.meta.env.VITE_USE_MOCK === 'true'

const query = ref('')
const searchType = ref('auto')
const loading = ref(false)
const results = ref<UserSearchResult[]>([])
const matchedBy = ref('')

async function search() {
  const q = query.value.trim()
  if (!q) return

  loading.value = true
  results.value = []
  try {
    if (useMock) {
      results.value = [{ id: mockUser.id, name: mockUser.name, email: mockUser.email }]
      matchedBy.value = 'mock'
      return
    }
    const { data } = await userAdminApi.searchUsers(q, searchType.value)
    matchedBy.value = data.matchedBy
    results.value = data.users.map(mapSearchUser)
    if (!results.value.length) showToast('No users found', 'error')
  } catch {
    /* interceptor handles toast */
  } finally {
    loading.value = false
  }
}

function openUser(id: string) {
  router.push(`/admin/users/${id}`)
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
    <div class="admin-card">
    <h1 class="text-xl font-semibold">User Search</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Search by email, phone, user ID, public ID, device ID, or name
      </p>

      <div class="admin-search-row mt-6">
        <input
          v-model="query"
          type="text"
          class="admin-input min-w-0 flex-1"
          placeholder="user@example.com, +919876543210, UUID..."
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

      <p v-if="matchedBy && results.length" class="mt-4 text-xs text-admin-muted">
        Matched by: {{ matchedBy }}
      </p>

      <div v-if="results.length" class="admin-table-wrap mt-4">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Contact</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in results" :key="user.id">
              <td>
                <div class="flex items-center gap-3">
                  <img
                    v-if="user.avatar"
                    :src="user.avatar"
                    :alt="user.name"
                    class="h-9 w-9 rounded-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-admin-accent/20 text-xs font-bold text-admin-accent"
                  >
                    {{ user.name.charAt(0) }}
                  </div>
                  <div>
                    <p class="font-medium">{{ user.name }}</p>
                    <p class="font-mono text-xs text-admin-subtext">{{ user.publicId ?? user.id.slice(0, 8) }}</p>
                  </div>
                </div>
              </td>
              <td class="text-xs">
                <p>{{ user.email ?? '—' }}</p>
                <p class="text-admin-subtext">{{ user.phone ?? '' }}</p>
              </td>
              <td>
                <span class="rounded bg-admin-bg px-2 py-0.5 text-xs capitalize">{{ user.status ?? '—' }}</span>
              </td>
              <td class="text-right">
                <button type="button" class="admin-btn-secondary text-xs" @click="openUser(user.id)">
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        v-if="useMock"
        type="button"
        class="admin-btn-secondary mt-6 w-full"
        @click="openUser(mockUser.id)"
      >
        View Demo User ({{ mockUser.name }})
      </button>
    </div>
  </div>
</template>
