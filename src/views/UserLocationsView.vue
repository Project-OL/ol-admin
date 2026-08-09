<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { format } from 'date-fns'
import { userAdminApi } from '@/api/userAdmin'
import { showToast } from '@/utils/toast'
import type { AdminLocationFeedItem } from '@/types/userLocation'

const items = ref<AdminLocationFeedItem[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)

const userIdFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm')
  } catch {
    return value
  }
}

function formatCoord(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(6)
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

function queryParams(cursor?: string) {
  return {
    limit: 50,
    cursor,
    userId: userIdFilter.value.trim() || undefined,
    from: dateFrom.value ? new Date(dateFrom.value).toISOString() : undefined,
    to: dateTo.value ? new Date(dateTo.value + 'T23:59:59').toISOString() : undefined,
  }
}

async function load() {
  loading.value = true
  try {
    const { data } = await userAdminApi.listLocations(queryParams())
    items.value = data.items
    nextCursor.value = data.nextCursor
    hasMore.value = data.hasMore
  } catch {
    items.value = []
    showToast('Failed to load locations feed', 'error')
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    const { data } = await userAdminApi.listLocations(queryParams(nextCursor.value))
    items.value = [...items.value, ...data.items]
    nextCursor.value = data.nextCursor
    hasMore.value = data.hasMore
  } catch {
    showToast('Failed to load more locations', 'error')
  } finally {
    loadingMore.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Locations</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Global GPS sample feed (read-only)
      </p>
    </div>

    <div class="admin-card">
      <div class="mb-4 flex flex-wrap gap-2">
        <input
          v-model="userIdFilter"
          type="text"
          class="admin-input min-w-0 w-full flex-1 sm:min-w-[220px]"
          placeholder="Filter by user UUID"
        />
        <input v-model="dateFrom" type="date" class="admin-input w-auto" />
        <input v-model="dateTo" type="date" class="admin-input w-auto" />
        <button type="button" class="admin-btn-primary" :disabled="loading" @click="load">
          {{ loading ? 'Loading…' : 'Search' }}
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Recorded</th>
              <th>Coords</th>
              <th>Accuracy</th>
              <th>Source</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.id">
              <td>
                <RouterLink
                  :to="`/admin/users/${row.user.userId}`"
                  class="font-medium text-admin-accent hover:underline"
                >
                  {{ row.user.displayName || row.user.username }}
                </RouterLink>
                <p class="font-mono text-xs text-admin-subtext">
                  {{ row.user.displayPublicId || row.user.publicId }}
                </p>
              </td>
              <td class="whitespace-nowrap text-xs">{{ formatDate(row.recordedAt) }}</td>
              <td class="font-mono text-xs">
                {{ formatCoord(row.latitude) }}, {{ formatCoord(row.longitude) }}
              </td>
              <td class="tabular-nums text-sm">
                {{ row.accuracyM != null ? `${row.accuracyM} m` : '—' }}
              </td>
              <td class="text-xs">{{ row.source }}</td>
              <td class="text-right">
                <a
                  :href="mapsUrl(row.latitude, row.longitude)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-admin-accent hover:underline"
                >
                  Map
                </a>
              </td>
            </tr>
            <tr v-if="loading && !items.length">
              <td colspan="6" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="6" class="py-10 text-center text-admin-muted">No location samples</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasMore" class="mt-4 flex justify-center">
        <button
          type="button"
          class="admin-btn-secondary text-xs"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? 'Loading…' : 'Load more' }}
        </button>
      </div>
    </div>
  </div>
</template>
