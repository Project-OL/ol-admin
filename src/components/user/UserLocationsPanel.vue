<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { format } from 'date-fns'
import { userAdminApi } from '@/api/userAdmin'
import { showToast } from '@/utils/toast'
import type { AdminUserLocationCurrent, AdminUserLocationSample } from '@/types/userLocation'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'

const props = defineProps<{ userId: string }>()

const current = ref<AdminUserLocationCurrent | null>(null)
const history = ref<AdminUserLocationSample[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)

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

async function load() {
  if (!props.userId) return
  loading.value = true
  try {
    const { data } = await userAdminApi.getUserLocations(props.userId, { limit: 50 })
    current.value = data.current
    history.value = data.history.items
    nextCursor.value = data.history.nextCursor
    hasMore.value = data.history.hasMore
  } catch {
    current.value = null
    history.value = []
    showToast('Failed to load locations', 'error')
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!props.userId || loadingMore.value || !hasMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    const { data } = await userAdminApi.getUserLocations(props.userId, {
      limit: 50,
      cursor: nextCursor.value,
    })
    history.value = [...history.value, ...data.history.items]
    nextCursor.value = data.history.nextCursor
    hasMore.value = data.history.hasMore
  } catch {
    showToast('Failed to load more locations', 'error')
  } finally {
    loadingMore.value = false
  }
}

const {
  sortKey: historySortKey,
  sortDir: historySortDir,
  sortedRows: sortedHistory,
  toggleSort: toggleHistorySort,
} = useSortableRows(history, (row, key) => {
  switch (key) {
    case 'recordedAt':
      return row.recordedAt ? new Date(row.recordedAt).getTime() : 0
    case 'latitude':
      return row.latitude ?? 0
    case 'longitude':
      return row.longitude ?? 0
    case 'accuracyM':
      return row.accuracyM ?? -1
    case 'source':
      return row.source ?? ''
    default:
      return undefined
  }
})

onMounted(() => load())
watch(() => props.userId, () => load())
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <div v-if="loading && !current" class="admin-card flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
    </div>

    <template v-else>
      <div class="admin-card space-y-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">Current location</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">Latest GPS fix from the user app</p>
          </div>
          <a
            v-if="current?.latitude != null && current?.longitude != null"
            :href="mapsUrl(current.latitude, current.longitude)"
            target="_blank"
            rel="noopener noreferrer"
            class="admin-btn-secondary text-xs"
          >
            Open map
          </a>
        </div>

        <div v-if="current" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p class="text-xs text-admin-subtext">Latitude</p>
            <p class="mt-0.5 font-mono text-sm font-medium">{{ formatCoord(current.latitude) }}</p>
          </div>
          <div>
            <p class="text-xs text-admin-subtext">Longitude</p>
            <p class="mt-0.5 font-mono text-sm font-medium">{{ formatCoord(current.longitude) }}</p>
          </div>
          <div>
            <p class="text-xs text-admin-subtext">Accuracy</p>
            <p class="mt-0.5 text-sm font-medium tabular-nums">
              {{ current.accuracyM != null ? `${current.accuracyM} m` : '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-admin-subtext">Located at</p>
            <p class="mt-0.5 text-sm font-medium">{{ formatDate(current.locatedAt) }}</p>
          </div>
        </div>
        <p
          v-else
          class="py-4 text-center text-sm text-admin-muted"
        >
          No current location
        </p>
      </div>

      <div class="admin-card">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold">History</h3>
          <span class="text-xs text-admin-subtext">{{ history.length }} shown</span>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Recorded" sort-key="recordedAt" :active-key="historySortKey" :direction="historySortDir" @sort="toggleHistorySort" />
                <SortableTh label="Latitude" sort-key="latitude" :active-key="historySortKey" :direction="historySortDir" @sort="toggleHistorySort" />
                <SortableTh label="Longitude" sort-key="longitude" :active-key="historySortKey" :direction="historySortDir" @sort="toggleHistorySort" />
                <SortableTh label="Accuracy" sort-key="accuracyM" :active-key="historySortKey" :direction="historySortDir" @sort="toggleHistorySort" />
                <SortableTh label="Source" sort-key="source" :active-key="historySortKey" :direction="historySortDir" @sort="toggleHistorySort" />
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedHistory" :key="row.id">
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.recordedAt) }}</td>
                <td class="font-mono text-xs">{{ formatCoord(row.latitude) }}</td>
                <td class="font-mono text-xs">{{ formatCoord(row.longitude) }}</td>
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
              <tr v-if="!history.length">
                <td colspan="6" class="py-8 text-center text-admin-muted">No location history</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="hasMore" class="mt-3 flex justify-center">
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
    </template>
  </div>
</template>
