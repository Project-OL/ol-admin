<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { format, formatDistanceToNowStrict } from 'date-fns'
import axios from 'axios'
import { faceVerificationAdminApi } from '@/api/faceVerificationAdmin'
import { userAdminApi } from '@/api/userAdmin'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import type { StuckRegistrationSessionRow } from '@/types/faceVerificationSessions'
import { formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'

const MIN_AGE_OPTIONS = [
  { value: 5, label: '5 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
]

const route = useRoute()
const router = useRouter()

const items = ref<StuckRegistrationSessionRow[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const loading = ref(false)
const recheckingId = ref<string | null>(null)
const clearing = ref(false)

const filters = reactive({
  minAgeSec: 5,
  userId: '',
})

const clearTarget = ref<StuckRegistrationSessionRow | null>(null)
const clearOpen = ref(false)

function axiosMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  const body = err.response?.data as { message?: string } | undefined
  return body?.message || fallback
}

function formatDt(iso: string) {
  try {
    return format(new Date(iso), 'dd MMM yyyy HH:mm:ss')
  } catch {
    return iso
  }
}

function stuckLabel(sec: number) {
  if (sec < 60) return `${sec}s`
  return formatDistanceToNowStrict(new Date(Date.now() - sec * 1000))
}

function listParams(p = page.value) {
  return {
    minAgeSec: filters.minAgeSec,
    page: p,
    limit,
    userId: filters.userId.trim() || undefined,
  }
}

async function load(p = 1) {
  loading.value = true
  page.value = p
  try {
    const { data } = await faceVerificationAdminApi.listStuckRegistrationSessions(listParams(p))
    items.value = data.sessions ?? []
    total.value = data.total ?? 0
  } catch {
    items.value = []
    total.value = 0
    showToast('Failed to load stuck registration sessions', 'error')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  router.replace({
    query: { ...route.query, minAgeSec: String(filters.minAgeSec), userId: filters.userId || undefined },
  })
  load(1)
}

async function recheck(row: StuckRegistrationSessionRow) {
  if (recheckingId.value) return
  recheckingId.value = row.sessionId
  try {
    const { data } = await userAdminApi.recheckRegistrationSession(row.userId, row.sessionId)
    showToast(data.message || 'Verify job re-queued', 'success')
    await load(page.value)
  } catch (err) {
    showToast(axiosMessage(err, 'Failed to re-queue verify job'), 'error')
  } finally {
    recheckingId.value = null
  }
}

function openClear(row: StuckRegistrationSessionRow) {
  clearTarget.value = row
  clearOpen.value = true
}

async function confirmClear(payload: { reason?: string }) {
  if (!clearTarget.value || clearing.value) return
  clearing.value = true
  try {
    const { data } = await userAdminApi.clearRegistrationSessions(
      clearTarget.value.userId,
      payload.reason,
    )
    showToast(data.message || 'Stuck sessions cleared', 'success')
    clearOpen.value = false
    clearTarget.value = null
    await load(page.value)
  } catch (err) {
    showToast(axiosMessage(err, 'Failed to clear stuck sessions'), 'error')
  } finally {
    clearing.value = false
  }
}

onMounted(() => {
  if (typeof route.query.minAgeSec === 'string' && Number(route.query.minAgeSec) >= 0) {
    filters.minAgeSec = Number(route.query.minAgeSec)
  }
  if (typeof route.query.userId === 'string') filters.userId = route.query.userId
  load(1)
})
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Face Verification — Needs Attention</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Users whose most recent registration attempt hasn't reached a good outcome yet — either hung
        (a session created but never followed by a verify call means the app never finished the
        liveness capture; one that's been PROCESSING for a while may indicate a worker outage), or a
        legitimate rejection (liveness/validation failure) they haven't retried past. A user who
        retries and succeeds, or whose latest attempt simply expired after starting a newer one, drops
        off this list on its own. Recheck (hung sessions only) to force a fresh Rekognition poll, or
        clear to reset rate limits and let the user start over.
      </p>
    </div>

    <section class="admin-card">
      <div class="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label class="mb-0.5 block text-[11px] text-admin-subtext">Needing attention for at least</label>
          <select v-model.number="filters.minAgeSec" class="admin-input w-auto">
            <option v-for="opt in MIN_AGE_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="min-w-0 flex-1 sm:min-w-[220px]">
          <label class="mb-0.5 block text-[11px] text-admin-subtext">User UUID (optional)</label>
          <input
            v-model="filters.userId"
            type="text"
            class="admin-input w-full"
            placeholder="Filter to one user…"
            @keydown.enter="applyFilters"
          />
        </div>
        <button type="button" class="admin-btn-primary" :disabled="loading" @click="applyFilters">
          {{ loading ? 'Loading…' : 'Apply' }}
        </button>
        <button type="button" class="admin-btn-secondary" :disabled="loading" @click="load(page)">
          Refresh
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Stuck for</th>
              <th>Created</th>
              <th>Risk score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.sessionId">
              <td>
                <RouterLink
                  :to="`/admin/users/${row.userId}`"
                  class="text-sm font-medium text-admin-accent hover:underline"
                >
                  {{ row.name }}
                </RouterLink>
                <p class="font-mono text-xs text-admin-subtext">
                  {{ row.publicId ?? row.userId }}
                </p>
              </td>
              <td>
                <StatusBadge
                  :status="row.status.toLowerCase()"
                  :label="row.status.replace(/_/g, ' ')"
                />
                <p v-if="row.failureReason" class="mt-1 max-w-[220px] truncate text-[11px] text-admin-danger">
                  {{ row.failureReason }}
                </p>
              </td>
              <td class="whitespace-nowrap text-xs text-admin-warn">
                {{ stuckLabel(row.stuckForSec) }}
              </td>
              <td class="whitespace-nowrap text-xs">{{ formatDt(row.createdAt) }}</td>
              <td class="tabular-nums text-xs">{{ row.riskScore }}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-if="row.status === 'PENDING' || row.status === 'UPLOADED' || row.status === 'PROCESSING'"
                    type="button"
                    class="admin-btn-secondary py-1 text-xs"
                    :disabled="recheckingId === row.sessionId"
                    @click="recheck(row)"
                  >
                    {{ recheckingId === row.sessionId ? 'Checking…' : 'Recheck' }}
                  </button>
                  <button
                    type="button"
                    class="admin-btn-danger py-1 text-xs"
                    @click="openClear(row)"
                  >
                    Clear
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="loading && !items.length">
              <td colspan="6" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="6" class="py-10 text-center text-admin-muted">
                No stuck registration sessions
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination mt-4">
        <span>{{ formatNumber(total) }} total</span>
        <div class="flex items-center gap-2">
          <span class="text-xs">Page {{ page }}</span>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="page <= 1 || loading"
            @click="load(page - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="page * limit >= total || loading"
            @click="load(page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <ConfirmActionDialog
      :open="clearOpen"
      title="Clear stuck registration sessions"
      :message="`Force-expires every open registration session for ${clearTarget?.name ?? 'this user'} and resets the related rate limits, so they can start a fresh attempt from the app. Does not touch their existing face profile.`"
      confirm-label="Clear sessions"
      variant="danger"
      require-reason
      @close="clearOpen = false"
      @confirm="confirmClear"
    />
  </div>
</template>
