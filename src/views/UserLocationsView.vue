<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { format } from 'date-fns'
import { userAdminApi } from '@/api/userAdmin'
import { showToast } from '@/utils/toast'
import type { AdminLocationFeedItem, AdminLocationsQuery } from '@/types/userLocation'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const items = ref<AdminLocationFeedItem[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)

const userFilter = ref('')
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

function parseUserFilter():
  | { ok: true; userId?: string; publicId?: string }
  | { ok: false; message: string } {
  const q = userFilter.value.trim().replace(/^#/, '')
  if (!q) return { ok: true }
  if (UUID_RE.test(q)) return { ok: true, userId: q }
  if (/^\d+$/.test(q)) return { ok: true, publicId: q }
  return { ok: false, message: 'Enter a user UUID or numeric public / display ID' }
}

function queryParams(cursor?: string): AdminLocationsQuery | null {
  const parsed = parseUserFilter()
  if (!parsed.ok) {
    showToast(parsed.message, 'error')
    return null
  }
  return {
    limit: 50,
    cursor,
    userId: parsed.userId,
    publicId: parsed.publicId,
    from: dateFrom.value ? new Date(dateFrom.value).toISOString() : undefined,
    to: dateTo.value ? new Date(dateTo.value + 'T23:59:59').toISOString() : undefined,
  }
}

function toastLoadError(err: unknown) {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { code?: string; message?: string } | undefined
    if (body?.code === 'USER_NOT_FOUND') {
      showToast(body.message || 'User not found', 'error')
      return
    }
    if (body?.code === 'INVALID_REQUEST') {
      showToast(body.message || 'Invalid location filter', 'error')
      return
    }
  }
  showToast('Failed to load locations feed', 'error')
}

async function load() {
  const params = queryParams()
  if (!params) return
  loading.value = true
  try {
    const { data } = await userAdminApi.listLocations(params)
    items.value = data.items
    nextCursor.value = data.nextCursor
    hasMore.value = data.hasMore
  } catch (err) {
    items.value = []
    toastLoadError(err)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value || !nextCursor.value) return
  const params = queryParams(nextCursor.value)
  if (!params) return
  loadingMore.value = true
  try {
    const { data } = await userAdminApi.listLocations(params)
    items.value = [...items.value, ...data.items]
    nextCursor.value = data.nextCursor
    hasMore.value = data.hasMore
  } catch (err) {
    toastLoadError(err)
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
        Global GPS sample feed (read-only). Search a user by UUID, public ID, or display ID.
      </p>
    </div>

    <div class="admin-card">
      <div class="mb-4 flex flex-wrap gap-2">
        <input
          v-model="userFilter"
          type="text"
          class="admin-input min-w-0 w-full flex-1 sm:min-w-[220px]"
          placeholder="User UUID, public ID, or display ID"
          @keydown.enter="load"
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
