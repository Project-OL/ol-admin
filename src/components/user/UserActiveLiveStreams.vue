<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { format } from 'date-fns'
import axios from 'axios'
import { userAdminApi } from '@/api/userAdmin'
import type { AdminLiveStreamRow } from '@/types/api'
import { showToast } from '@/utils/toast'

const props = defineProps<{ userId: string }>()

const streams = ref<AdminLiveStreamRow[]>([])
const loading = ref(false)
const stoppingId = ref<string | null>(null)
const reason = ref('')

async function load() {
  loading.value = true
  try {
    const { data } = await userAdminApi.listActiveLiveStreams(props.userId)
    streams.value = data.streams ?? []
  } catch {
    streams.value = []
  } finally {
    loading.value = false
  }
}

async function stopStream(row: AdminLiveStreamRow) {
  stoppingId.value = row.id
  try {
    const { data } = await userAdminApi.stopLiveStream(
      props.userId,
      row.id,
      reason.value.trim() || undefined,
    )
    showToast(data.message || `Room ${data.roomId} close requested`, 'success')
    await load()
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data as { message?: string } | undefined
      showToast(body?.message || 'Failed to close live stream', 'error')
    } else {
      showToast('Failed to close live stream', 'error')
    }
  } finally {
    stoppingId.value = null
  }
}

onMounted(load)
watch(() => props.userId, load)
</script>

<template>
  <div class="admin-card space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">
        Active live streams
      </h2>
      <button type="button" class="admin-btn-secondary py-1 text-xs" :disabled="loading" @click="load">
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
    </div>
    <p class="text-xs text-admin-muted">
      Close a room to disconnect the host and all viewers (LiveKit). Redis live keys are cleared on this API.
    </p>
    <input
      v-model="reason"
      type="text"
      class="admin-input text-sm"
      placeholder="Optional reason for closing…"
    />
    <div v-if="!streams.length && !loading" class="text-xs text-admin-muted">No active live streams</div>
    <ul v-else class="space-y-2">
      <li
        v-for="row in streams"
        :key="row.id"
        class="flex items-start justify-between gap-3 rounded-md border border-admin-border px-3 py-2"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">{{ row.title || row.roomId }}</p>
          <p class="text-xs text-admin-muted">
            {{ row.source === 'live_stream' ? 'Live room' : 'Host session' }}
            · {{ row.status }}
            <span v-if="row.startedAt">
              · started {{ format(new Date(row.startedAt), 'dd MMM HH:mm') }}
            </span>
          </p>
          <p class="truncate font-mono text-[11px] text-admin-muted">{{ row.roomId }}</p>
        </div>
        <button
          type="button"
          class="admin-btn-danger shrink-0 py-1 text-xs"
          :disabled="stoppingId === row.id"
          @click="stopStream(row)"
        >
          {{ stoppingId === row.id ? 'Closing…' : 'Close room' }}
        </button>
      </li>
    </ul>
  </div>
</template>
