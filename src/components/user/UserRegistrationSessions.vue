<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { format, formatDistanceToNowStrict } from 'date-fns'
import axios from 'axios'
import { userAdminApi } from '@/api/userAdmin'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import type { RegistrationSessionRow } from '@/types/faceVerificationSessions'
import { showToast } from '@/utils/toast'

const props = defineProps<{ userId: string }>()

const sessions = ref<RegistrationSessionRow[]>([])
const loading = ref(false)
const recheckingId = ref<string | null>(null)
const clearing = ref(false)
const clearOpen = ref(false)

function axiosMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  const body = err.response?.data as { message?: string } | undefined
  return body?.message || fallback
}

function stuckLabel(sec: number) {
  if (sec < 60) return `${sec}s`
  return formatDistanceToNowStrict(new Date(Date.now() - sec * 1000))
}

async function load() {
  loading.value = true
  try {
    const { data } = await userAdminApi.listUserRegistrationSessions(props.userId)
    sessions.value = data.sessions ?? []
  } catch {
    sessions.value = []
  } finally {
    loading.value = false
  }
}

async function recheck(session: RegistrationSessionRow) {
  if (recheckingId.value) return
  recheckingId.value = session.sessionId
  try {
    const { data } = await userAdminApi.recheckRegistrationSession(props.userId, session.sessionId)
    showToast(data.message || 'Verify job re-queued', 'success')
    await load()
  } catch (err) {
    showToast(axiosMessage(err, 'Failed to re-queue verify job'), 'error')
  } finally {
    recheckingId.value = null
  }
}

async function confirmClear(payload: { reason?: string }) {
  if (clearing.value) return
  clearing.value = true
  try {
    const { data } = await userAdminApi.clearRegistrationSessions(props.userId, payload.reason)
    showToast(data.message || 'Stuck sessions cleared', 'success')
    clearOpen.value = false
    await load()
  } catch (err) {
    showToast(axiosMessage(err, 'Failed to clear stuck sessions'), 'error')
  } finally {
    clearing.value = false
  }
}

onMounted(load)
watch(() => props.userId, load)

defineExpose({ load })
</script>

<template>
  <div class="admin-card space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">
        Pending registration sessions
      </h2>
      <div class="flex items-center gap-2">
        <button type="button" class="admin-btn-secondary py-1 text-xs" :disabled="loading" @click="load">
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
        <button
          v-if="sessions.length"
          type="button"
          class="admin-btn-danger py-1 text-xs"
          @click="clearOpen = true"
        >
          Clear all &amp; allow reregister
        </button>
      </div>
    </div>

    <p v-if="!sessions.length && !loading" class="text-xs text-admin-muted">
      No open registration sessions.
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="s in sessions"
        :key="s.sessionId"
        class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-admin-border p-2 text-sm"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <StatusBadge :status="s.status.toLowerCase()" :label="s.status.replace(/_/g, ' ')" />
            <span class="text-xs text-admin-warn">stuck {{ stuckLabel(s.stuckForSec) }}</span>
          </div>
          <p class="mt-1 font-mono text-[11px] text-admin-muted">{{ s.sessionId }}</p>
          <p class="text-[11px] text-admin-muted">
            Created {{ format(new Date(s.createdAt), 'dd MMM yyyy HH:mm:ss') }}
          </p>
          <p v-if="s.failureReason" class="text-[11px] text-admin-danger">{{ s.failureReason }}</p>
        </div>
        <button
          v-if="s.status === 'PENDING' || s.status === 'UPLOADED' || s.status === 'PROCESSING'"
          type="button"
          class="admin-btn-secondary shrink-0 py-1 text-xs"
          :disabled="recheckingId === s.sessionId"
          @click="recheck(s)"
        >
          {{ recheckingId === s.sessionId ? 'Checking…' : 'Recheck now' }}
        </button>
      </li>
    </ul>

    <ConfirmActionDialog
      :open="clearOpen"
      title="Clear stuck registration sessions"
      message="Force-expires every open registration session for this user and resets the related rate limits, so they can start a fresh attempt from the app. Does not touch their existing face profile."
      confirm-label="Clear sessions"
      variant="danger"
      require-reason
      @close="clearOpen = false"
      @confirm="confirmClear"
    />
  </div>
</template>
