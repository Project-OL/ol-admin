<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { adminCountryAccessApi } from '@/api/adminCountryAccess'
import { countryUserSearchApi } from '@/api/countryUserSearch'
import type { CountryScopedUser } from '@/types/api'
import { showToast } from '@/utils/toast'
import UserRestrictions from '@/components/user/UserRestrictions.vue'

const myCountries = ref<string[]>([])
const loadingCountries = ref(false)
const country = ref('')
const query = ref('')
const loading = ref(false)
const results = ref<CountryScopedUser[]>([])
const selected = ref<CountryScopedUser | null>(null)

function chipLabel(user: CountryScopedUser) {
  return user.name || user.username || user.displayPublicId
}

function chipInitial(user: CountryScopedUser) {
  return chipLabel(user).charAt(0).toUpperCase() || '?'
}

async function loadMyCountries() {
  loadingCountries.value = true
  try {
    const { data } = await adminCountryAccessApi.getMyCountries()
    myCountries.value = data.countries ?? []
    if (myCountries.value.length === 1) country.value = myCountries.value[0] ?? ''
  } catch {
    myCountries.value = []
  } finally {
    loadingCountries.value = false
  }
}

async function search() {
  loading.value = true
  selected.value = null
  try {
    const { data } = await countryUserSearchApi.search({
      country: country.value || undefined,
      q: query.value.trim() || undefined,
      limit: 50,
    })
    results.value = data.users ?? []
    if (!results.value.length) showToast('No users found', 'error')
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
}

function selectUser(user: CountryScopedUser) {
  selected.value = selected.value?.userId === user.userId ? null : user
}

const hasCountryAccess = computed(() => myCountries.value.length > 0)

onMounted(() => {
  void loadMyCountries()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
    <div class="admin-card">
      <h1 class="text-xl font-semibold">Country Users</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Search users within your granted countries. Name, picture, and public ID only — no
        email, phone, or other contact details are shown here.
      </p>

      <p v-if="!loadingCountries && !hasCountryAccess" class="mt-4 text-sm text-admin-warn">
        No country access has been granted to your account yet. Ask a SUPER_ADMIN to grant one
        under Admin Views.
      </p>

      <div v-else class="admin-search-row mt-6">
        <select v-model="country" class="admin-input w-full sm:w-48">
          <option value="">All my countries</option>
          <option v-for="c in myCountries" :key="c" :value="c">{{ c }}</option>
        </select>
        <input
          v-model="query"
          type="text"
          class="admin-input min-w-0 flex-1"
          placeholder="Name, username, or public ID…"
          @keydown.enter="search"
        />
        <button
          type="button"
          class="admin-btn-primary w-full shrink-0 sm:w-auto"
          :disabled="loading"
          @click="search"
        >
          {{ loading ? 'Searching…' : 'Search' }}
        </button>
      </div>

      <div v-if="results.length" class="admin-table-wrap mt-6">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Name</th>
              <th>Public ID</th>
              <th>Country</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in results"
              :key="user.userId"
              class="cursor-pointer"
              :class="{ 'bg-admin-bg/60': selected?.userId === user.userId }"
              @click="selectUser(user)"
            >
              <td>
                <div class="flex items-center gap-3">
                  <img
                    v-if="user.avatarUrl"
                    :src="user.avatarUrl"
                    :alt="chipLabel(user)"
                    class="h-9 w-9 rounded-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-admin-accent/20 text-xs font-bold text-admin-accent"
                  >
                    {{ chipInitial(user) }}
                  </div>
                  <p class="font-medium">{{ user.username }}</p>
                </div>
              </td>
              <td class="text-xs">{{ chipLabel(user) }}</td>
              <td class="font-mono text-xs text-admin-subtext">{{ user.displayPublicId }}</td>
              <td class="text-xs">{{ user.country ?? '—' }}</td>
              <td class="text-right">
                <button type="button" class="admin-btn-secondary text-xs" @click.stop="selectUser(user)">
                  {{ selected?.userId === user.userId ? 'Close' : 'Actions' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selected" class="mt-6">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-admin-subtext">
          Actions for {{ chipLabel(selected) }}
        </p>
        <UserRestrictions
          :user-id="selected.userId"
          :allowed-types="['LIVE_CHAT_MUTE', 'LIVE_AUDIO_MUTE', 'MESSAGING_DISABLE']"
          :show-remove-avatar="true"
        />
      </div>
    </div>
  </div>
</template>
