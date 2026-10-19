<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { format } from 'date-fns'
import { gcpCapacityApi } from '@/api/gcpCapacity'
import type { GcpCapacity, GcpCapacityChange, GcpCapacityRequest } from '@/types/gcpCapacity'
import { showToast } from '@/utils/toast'

// INF-23: change production capacity (API server group min/max, Redis size) through ol-scaler.
// The main server (the single Live-server) is deliberately not controllable here.

// Approximate on-demand prices, asia-south1, for the confirm dialog only (not billing).
const USD_PER_API_VM_MONTH = 49 // e2-standard-2
const USD_PER_REDIS_GB_MONTH = 47 // Memorystore Standard

const cap = ref<GcpCapacity | null>(null)
const loading = ref(false)
const pending = ref<GcpCapacityRequest | null>(null)
const opsPassword = ref('')
const reason = ref('')
const submitting = ref(false)
const operation = ref<{ ref: string; done: boolean; error: string | null } | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const customMin = ref(1)
const customMax = ref(3)
const redisSize = ref(2)

async function load() {
  loading.value = true
  try {
    const res = await gcpCapacityApi.get()
    cap.value = res.data
    if (res.data.api) {
      customMin.value = res.data.api.minReplicas
      customMax.value = res.data.api.maxReplicas
    }
    if (res.data.redis) redisSize.value = res.data.redis.sizeGb
  } catch {
    showToast('Failed to load capacity', 'error')
  } finally {
    loading.value = false
  }
}

const pendingSummary = computed(() => {
  const p = pending.value
  if (!p || !cap.value) return ''
  if (p.kind === 'api') {
    const a = cap.value.api
    const delta = (p.minReplicas - (a?.minReplicas ?? 0)) * USD_PER_API_VM_MONTH
    return `API servers min/max ${a?.minReplicas}–${a?.maxReplicas} → ${p.minReplicas}–${p.maxReplicas}. Baseline cost change about ${delta >= 0 ? '+' : ''}$${delta}/month (more only while load needs the extra servers).`
  }
  const r = cap.value.redis
  const delta = (p.sizeGb - (r?.sizeGb ?? 0)) * USD_PER_REDIS_GB_MONTH
  return `Redis ${r?.sizeGb} GB → ${p.sizeGb} GB (a brief failover of a few seconds). Cost change about ${delta >= 0 ? '+' : ''}$${delta}/month.`
})

function ask(change: GcpCapacityRequest) {
  if (!cap.value?.configured) return showToast('Capacity control is not configured on this server', 'error')
  if (!cap.value.hasOpsPassword) return showToast('No ops password is set for your account (set it with the CLI on the server)', 'error')
  if (cap.value.cooldownSeconds > 0) return showToast(`Wait ${cap.value.cooldownSeconds} s: one change per 10 minutes`, 'error')
  pending.value = change
  opsPassword.value = ''
  reason.value = ''
}

function cancel() {
  pending.value = null
  opsPassword.value = ''
}

async function confirm() {
  if (!pending.value || !opsPassword.value) return
  submitting.value = true
  try {
    const { data: step } = await gcpCapacityApi.stepUp(opsPassword.value)
    opsPassword.value = ''
    const payload: GcpCapacityChange = { ...pending.value, stepUpToken: step.stepUpToken, reason: reason.value || undefined }
    const { data } = await gcpCapacityApi.change(payload)
    showToast('Change sent; waiting for GCP', 'success')
    pending.value = null
    operation.value = { ref: data.operation.ref, done: false, error: null }
    startPolling()
    await load()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string; error?: string } } }
    showToast(e.response?.data?.message ?? e.response?.data?.error ?? 'Change failed', 'error')
  } finally {
    submitting.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (!operation.value) return stopPolling()
    try {
      const { data } = await gcpCapacityApi.operation(operation.value.ref)
      operation.value = { ...operation.value, ...data }
      if (data.done) {
        stopPolling()
        showToast(data.error ? `GCP reported: ${data.error}` : 'Capacity change applied', data.error ? 'error' : 'success')
        await load()
      }
    } catch {
      /* keep polling */
    }
  }, 5000)
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

const pct = (r: number | null) => (r === null ? '—' : `${(r * 100).toFixed(1)}%`)

onMounted(load)
onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Capacity</h1>
        <p class="mt-1 max-w-2xl text-sm text-admin-subtext">
          Scale the API servers and resize Redis. Each change needs your separate ops password, is limited to one every
          10 minutes, is capped by the scaler service, and is emailed to every super admin. The main server (Live-server)
          is not changeable here.
        </p>
      </div>
      <button type="button" class="admin-btn-secondary" :disabled="loading" @click="load">Refresh</button>
    </div>

    <p v-if="cap && !cap.configured" class="admin-card mt-4 text-sm text-admin-danger">
      Capacity control is not configured on this server (OL_SCALER_URL is unset). The page is read-only.
    </p>
    <p v-else-if="cap && !cap.hasOpsPassword" class="admin-card mt-4 text-sm text-admin-subtext">
      No ops password is set for your account. It can only be set on the server:
      <code>node dist/cli/set-ops-password.js &lt;your email&gt;</code>
    </p>
    <p v-if="cap && cap.cooldownSeconds > 0" class="mt-3 text-sm text-admin-subtext">
      Next change allowed in {{ cap.cooldownSeconds }} s.
    </p>

    <div class="mt-4 grid gap-4 md:grid-cols-2">
      <section class="admin-card">
        <h2 class="font-semibold">API servers</h2>
        <template v-if="cap?.api">
          <p class="mt-2 text-sm">
            Running <b>{{ cap.api.targetSize }}</b> · autoscale <b>{{ cap.api.minReplicas }}–{{ cap.api.maxReplicas }}</b>
            at {{ Math.round(cap.api.cpuTarget * 100) }}% CPU
            <span v-if="!cap.api.isStable" class="text-admin-subtext">(changing)</span>
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="p in cap.profiles"
              :key="p.id"
              type="button"
              class="admin-btn-secondary"
              :disabled="p.minReplicas === cap.api.minReplicas && p.maxReplicas === cap.api.maxReplicas"
              @click="ask({ kind: 'api', minReplicas: p.minReplicas, maxReplicas: p.maxReplicas })"
            >
              {{ p.label }} ({{ p.minReplicas }}–{{ p.maxReplicas }})
            </button>
          </div>
          <div class="mt-3 flex flex-wrap items-end gap-2 text-sm">
            <label class="flex flex-col gap-1 text-xs text-admin-subtext">
              Min
              <input v-model.number="customMin" type="number" min="1" :max="cap.api.caps.minMax" class="admin-input w-20" />
            </label>
            <label class="flex flex-col gap-1 text-xs text-admin-subtext">
              Max
              <input v-model.number="customMax" type="number" min="1" :max="cap.api.caps.maxMax" class="admin-input w-20" />
            </label>
            <button
              type="button"
              class="admin-btn-primary"
              @click="ask({ kind: 'api', minReplicas: customMin, maxReplicas: customMax })"
            >
              Apply custom
            </button>
            <span class="text-xs text-admin-subtext">caps: min ≤ {{ cap.api.caps.minMax }}, max ≤ {{ cap.api.caps.maxMax }}</span>
          </div>
        </template>
        <p v-else class="mt-2 text-sm text-admin-subtext">{{ loading ? 'Loading…' : 'Not available' }}</p>
      </section>

      <section class="admin-card">
        <h2 class="font-semibold">Redis</h2>
        <template v-if="cap?.redis">
          <p class="mt-2 text-sm">
            <b>{{ cap.redis.sizeGb }} GB</b> {{ cap.redis.tier }} · {{ cap.redis.state }} · in use {{ pct(cap.redis.usedRatio) }}
            <span v-if="cap.redis.usedGb !== null">({{ cap.redis.usedGb }} GB)</span>
          </p>
          <div class="mt-3 flex flex-wrap items-end gap-2">
            <label class="flex flex-col gap-1 text-xs text-admin-subtext">
              New size
              <select v-model.number="redisSize" class="admin-input w-28">
                <option v-for="s in cap.redis.allowedSizes" :key="s" :value="s">{{ s }} GB</option>
              </select>
            </label>
            <button
              type="button"
              class="admin-btn-primary"
              :disabled="redisSize === cap.redis.sizeGb"
              @click="ask({ kind: 'redis', sizeGb: redisSize })"
            >
              Resize
            </button>
          </div>
          <p class="mt-2 text-xs text-admin-subtext">
            A downsize is refused unless the new size is at least 1.5× the memory in use.
          </p>
        </template>
        <p v-else class="mt-2 text-sm text-admin-subtext">{{ loading ? 'Loading…' : 'Not available' }}</p>
      </section>
    </div>

    <section v-if="operation" class="admin-card mt-4 text-sm">
      Last operation: <code>{{ operation.ref }}</code> —
      <b v-if="!operation.done">in progress…</b>
      <b v-else-if="operation.error" class="text-admin-danger">failed: {{ operation.error }}</b>
      <b v-else class="text-admin-success">done</b>
    </section>

    <section class="admin-card mt-4">
      <h2 class="font-semibold">Recent changes</h2>
      <div class="admin-table-wrap mt-2">
        <table class="admin-table">
          <thead>
            <tr><th>When</th><th>Change</th><th>Reason</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in cap?.recentChanges ?? []" :key="i">
              <td>{{ format(new Date(c.createdAt), 'dd MMM yyyy HH:mm') }}</td>
              <td>{{ c.actionDetails?.summary ?? '—' }}</td>
              <td>{{ c.actionDetails?.reason ?? '—' }}</td>
              <td>{{ c.actionStatus }}</td>
            </tr>
            <tr v-if="!(cap?.recentChanges?.length)">
              <td colspan="4" class="text-admin-subtext">No changes yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="pending" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="cancel">
      <div class="admin-card w-full max-w-md">
        <h3 class="font-semibold">Confirm capacity change</h3>
        <p class="mt-2 text-sm">{{ pendingSummary }}</p>
        <label class="mt-3 flex flex-col gap-1 text-xs text-admin-subtext">
          Reason (optional, shown in the history)
          <input v-model="reason" type="text" maxlength="300" class="admin-input" />
        </label>
        <label class="mt-3 flex flex-col gap-1 text-xs text-admin-subtext">
          Ops password
          <input v-model="opsPassword" type="password" autocomplete="off" class="admin-input" @keyup.enter="confirm" />
        </label>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="admin-btn-secondary" :disabled="submitting" @click="cancel">Cancel</button>
          <button type="button" class="admin-btn-danger" :disabled="submitting || !opsPassword" @click="confirm">
            {{ submitting ? 'Applying…' : 'Apply change' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
