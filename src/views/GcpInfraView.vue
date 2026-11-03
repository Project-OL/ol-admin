<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { format } from 'date-fns'
import { gcpInfraApi } from '@/api/gcpInfra'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'
import type {
  GcpCostByServiceRow,
  GcpInfraFlag,
  GcpResourceConfigUpdate,
  GcpResourceWithUsage,
  GcpThresholds,
  LivekitBandwidth,
} from '@/types/gcpInfra'
import { formatUsd } from '@/utils/format'
import { showToast } from '@/utils/toast'

function isFetchError(value: unknown): value is { error: string } {
  return !!value && typeof value === 'object' && 'error' in (value as Record<string, unknown>)
}

function currentUtcMonthValue() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const resources = ref<GcpResourceWithUsage[]>([])
const flags = ref<GcpInfraFlag[]>([])
const costByService = ref<Awaited<ReturnType<typeof gcpInfraApi.getCostByService>>['data'] | null>(null)
const loadingResources = ref(false)
const loadingFlags = ref(false)
const loadingCost = ref(false)
const flagFilter = ref<'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | ''>('OPEN')
const monthValue = ref(currentUtcMonthValue())
const editingKey = ref<string | null>(null)
const editForm = ref<GcpResourceConfigUpdate & { thresholds: GcpThresholds }>({ thresholds: {} })
const savingConfig = ref(false)

async function loadResources() {
  loadingResources.value = true
  try {
    const res = await gcpInfraApi.getResources()
    resources.value = res.data
  } catch {
    resources.value = []
    showToast('Failed to load GCP resources', 'error')
  } finally {
    loadingResources.value = false
  }
}

async function loadFlags() {
  loadingFlags.value = true
  try {
    const res = await gcpInfraApi.getFlags(flagFilter.value || undefined)
    flags.value = res.data
  } catch {
    flags.value = []
    showToast('Failed to load GCP infra flags', 'error')
  } finally {
    loadingFlags.value = false
  }
}

async function loadCost(refresh = false) {
  loadingCost.value = true
  try {
    const [y, m] = monthValue.value.split('-').map(Number)
    const res = await gcpInfraApi.getCostByService({ year: y, month: m, refresh })
    costByService.value = res.data
  } catch {
    costByService.value = null
    showToast('Failed to load GCP billing export data', 'error')
  } finally {
    loadingCost.value = false
  }
}

// LIVE-63: video server (LiveKit VPS) transfer vs its 32 TB/month allowance.
const bandwidth = ref<LivekitBandwidth | { error: string } | null>(null)
const loadingBandwidth = ref(false)

async function loadBandwidth(refresh = false) {
  loadingBandwidth.value = true
  try {
    const res = await gcpInfraApi.getLivekitBandwidth(refresh)
    bandwidth.value = res.data
  } catch {
    bandwidth.value = null
    showToast('Failed to load video server bandwidth', 'error')
  } finally {
    loadingBandwidth.value = false
  }
}

const bw = computed(() => (bandwidth.value && !isFetchError(bandwidth.value) ? bandwidth.value : null))
const bwError = computed(() => (bandwidth.value && isFetchError(bandwidth.value) ? bandwidth.value.error : null))

function formatBytes(n: number) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TB`
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`
  return `${(n / 1e6).toFixed(0)} MB`
}

function quotaPct(bytes: number) {
  return bw.value ? Math.min(100, (bytes / bw.value.monthlyQuotaBytes) * 100) : 0
}

function quotaBarClass(p: number) {
  if (!bw.value) return 'bg-admin-accent'
  if (p >= bw.value.thresholds.critPct) return 'bg-admin-danger'
  if (p >= bw.value.thresholds.warnPct) return 'bg-amber-500'
  return 'bg-admin-success'
}

/** Polyline points for the hourly total (in + out) Mbps sparkline, 0..portMbps scaled to 0..40. */
const sparkline = computed(() => {
  const rows = bw.value?.hourly7d ?? []
  if (rows.length < 2) return ''
  const max = Math.max(...rows.map((r) => r.incomingMbps + r.outgoingMbps), 1)
  return rows
    .map((r, i) => `${((i / (rows.length - 1)) * 300).toFixed(1)},${(40 - ((r.incomingMbps + r.outgoingMbps) / max) * 38).toFixed(1)}`)
    .join(' ')
})

function refreshAll() {
  loadResources()
  loadFlags()
  loadCost(true)
  loadBandwidth(true)
}

const monthLabel = computed(() => {
  const [y, m] = monthValue.value.split('-').map(Number)
  if (!y || !m) return 'This month (UTC)'
  const d = new Date(Date.UTC(y, m - 1, 1))
  return format(d, 'MMMM yyyy') + ' (UTC)'
})

const costError = computed(() =>
  costByService.value && isFetchError(costByService.value) ? costByService.value.error : null,
)
const costTotal = computed(() =>
  costByService.value && !isFetchError(costByService.value) ? costByService.value.total : null,
)
const costRows = computed<GcpCostByServiceRow[]>(() =>
  costByService.value && !isFetchError(costByService.value) ? costByService.value.byService : [],
)

const {
  sortKey: costSortKey,
  sortDir: costSortDir,
  sortedRows: sortedCostRows,
  toggleSort: toggleCostSort,
} = useSortableRows(costRows, (row, key) => {
  if (key === 'service') return row.service.toLowerCase()
  if (key === 'amount') return row.amount
  return undefined
})

function headroomLabel(h: GcpResourceWithUsage['headroomFor2x']) {
  if (h === 'OK') return '2x OK'
  if (h === 'AT_RISK') return 'At risk'
  return 'Unknown'
}
function headroomClass(h: GcpResourceWithUsage['headroomFor2x']) {
  if (h === 'OK') return 'bg-admin-success/10 text-admin-success'
  if (h === 'AT_RISK') return 'bg-admin-danger/10 text-admin-danger'
  return 'bg-admin-subtext/10 text-admin-subtext'
}

function pct(v: number | null | undefined) {
  return v === null || v === undefined ? '—' : `${v}%`
}

function startEdit(r: GcpResourceWithUsage) {
  editingKey.value = r.resourceKey
  editForm.value = {
    targetTierFor2x: r.targetTierFor2x ?? '',
    suggestedNextTier: r.suggestedNextTier ?? '',
    estimatedMonthlyCostUsd: r.estimatedMonthlyCostUsd,
    runbookMarkdown: r.runbookMarkdown ?? '',
    thresholds: { ...r.thresholds },
  }
}

function cancelEdit() {
  editingKey.value = null
}

async function saveEdit(resourceKey: string) {
  savingConfig.value = true
  try {
    await gcpInfraApi.updateResourceConfig(resourceKey, editForm.value)
    showToast('Resource config updated', 'success')
    editingKey.value = null
    await loadResources()
  } catch {
    showToast('Failed to update resource config', 'error')
  } finally {
    savingConfig.value = false
  }
}

async function resolveFlag(id: string) {
  try {
    await gcpInfraApi.resolveFlag(id)
    showToast('Flag resolved', 'success')
    await loadFlags()
  } catch {
    showToast('Failed to resolve flag', 'error')
  }
}

onMounted(async () => {
  await Promise.all([loadResources(), loadFlags(), loadCost(), loadBandwidth()])
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">GCP Infra & Cost</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Hourly-collected usage, real billed cost (GCP Billing Export), and threshold flags for
          every tracked GCP resource. Resources are sized to comfortably absorb 2x current usage.
        </p>
      </div>
      <button
        type="button"
        class="admin-btn-secondary"
        :disabled="loadingResources || loadingFlags || loadingCost || loadingBandwidth"
        @click="refreshAll"
      >
        {{ loadingResources || loadingFlags || loadingCost || loadingBandwidth ? 'Refreshing…' : 'Refresh' }}
      </button>
    </div>

    <!-- Video server bandwidth (LIVE-63) -->
    <section class="admin-card">
      <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-lg font-medium">Video server bandwidth (LiveKit VPS)</h2>
        <p v-if="bw" class="text-xs text-admin-muted">
          Updated {{ format(new Date(bw.generatedAt), 'dd MMM HH:mm') }} · refreshes every 5 min
        </p>
      </div>

      <p v-if="bwError" class="rounded-md bg-admin-danger/10 p-3 text-sm text-admin-danger">{{ bwError }}</p>
      <p v-else-if="loadingBandwidth && !bw" class="py-6 text-center text-admin-muted">Loading…</p>

      <template v-else-if="bw">
        <div class="mb-4">
          <div class="mb-1 flex flex-wrap justify-between gap-2 text-sm">
            <span>
              This month (UTC): <strong class="tabular-nums">{{ formatBytes(bw.monthToDate.totalBytes) }}</strong>
              of {{ formatBytes(bw.monthlyQuotaBytes) }}
            </span>
            <span class="tabular-nums">{{ bw.monthToDate.pctOfQuota.toFixed(2) }}%</span>
          </div>
          <div class="relative h-3 w-full overflow-hidden rounded-full bg-admin-subtext/15">
            <div
              class="h-full rounded-full"
              :class="quotaBarClass(quotaPct(bw.monthToDate.totalBytes))"
              :style="{ width: `${Math.max(0.5, quotaPct(bw.monthToDate.totalBytes))}%` }"
            />
            <div class="absolute inset-y-0 w-px bg-amber-500" :style="{ left: `${bw.thresholds.warnPct}%` }" title="Alert at 60%" />
            <div class="absolute inset-y-0 w-px bg-admin-danger" :style="{ left: `${bw.thresholds.critPct}%` }" title="Alert at 80%" />
          </div>
          <p class="mt-1 text-xs text-admin-subtext">
            Marks at {{ bw.thresholds.warnPct }}% and {{ bw.thresholds.critPct }}% are the email alerts. Over 32 TB
            Hostinger throttles the server to 10 Mbps, which means no video.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p class="text-xs text-admin-subtext">Projected this month</p>
            <p class="mt-1 text-lg font-semibold tabular-nums">{{ formatBytes(bw.projectedMonthBytes) }}</p>
            <p class="text-xs text-admin-muted">{{ ((bw.projectedMonthBytes / bw.monthlyQuotaBytes) * 100).toFixed(1) }}% of allowance</p>
          </div>
          <div>
            <p class="text-xs text-admin-subtext">Last 30 days</p>
            <p class="mt-1 text-lg font-semibold tabular-nums">{{ formatBytes(bw.rolling30d.totalBytes) }}</p>
            <p class="text-xs text-admin-muted">
              in {{ formatBytes(bw.rolling30d.incomingBytes) }} · out {{ formatBytes(bw.rolling30d.outgoingBytes) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-admin-subtext">Now (10 min avg)</p>
            <p class="mt-1 text-lg font-semibold tabular-nums">
              {{ (bw.currentMbps.incoming + bw.currentMbps.outgoing).toFixed(1) }} Mbps
            </p>
            <p class="text-xs text-admin-muted">of ~{{ bw.thresholds.portMbps }} Mbps port</p>
          </div>
          <div>
            <p class="text-xs text-admin-subtext">Peak hour, 7 days</p>
            <p class="mt-1 text-lg font-semibold tabular-nums">{{ bw.peakMbps7d.toFixed(1) }} Mbps</p>
            <p class="text-xs text-admin-muted">alert at {{ bw.thresholds.portAlertMbps }} Mbps for 10 min</p>
          </div>
        </div>

        <div v-if="sparkline" class="mt-4">
          <p class="mb-1 text-xs text-admin-subtext">Hourly traffic, last 7 days (in + out)</p>
          <svg viewBox="0 0 300 40" preserveAspectRatio="none" class="h-12 w-full" role="img" aria-label="Hourly traffic, last 7 days">
            <polyline :points="sparkline" fill="none" stroke="currentColor" stroke-width="1.5" class="text-admin-accent" vector-effect="non-scaling-stroke" />
          </svg>
        </div>

        <p class="mt-3 text-xs text-admin-muted">
          Source: {{ bw.source }}. Hostinger's own counter runs somewhat higher; check hPanel near the limits.
        </p>
      </template>
    </section>

    <!-- Resources -->
    <section class="admin-card">
      <h2 class="mb-4 text-lg font-medium">Resources</h2>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Current tier</th>
              <th>CPU</th>
              <th>Mem</th>
              <th>Disk</th>
              <th>2x headroom</th>
              <th>Est. cost/mo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="r in resources" :key="r.resourceKey">
              <tr>
                <td class="font-medium">{{ r.displayName }}</td>
                <td class="text-sm">{{ r.currentTier }}</td>
                <td class="tabular-nums text-sm">{{ pct(r.latestUsage?.cpuPct) }}</td>
                <td class="tabular-nums text-sm">{{ pct(r.latestUsage?.memPct) }}</td>
                <td class="tabular-nums text-sm">{{ pct(r.latestUsage?.diskPct) }}</td>
                <td>
                  <span class="rounded px-2 py-0.5 text-xs font-medium" :class="headroomClass(r.headroomFor2x)">
                    {{ headroomLabel(r.headroomFor2x) }}
                  </span>
                </td>
                <td class="tabular-nums text-sm">
                  {{ r.estimatedMonthlyCostUsd != null ? formatUsd(r.estimatedMonthlyCostUsd) : '—' }}
                </td>
                <td>
                  <button type="button" class="text-xs text-admin-accent hover:underline" @click="startEdit(r)">
                    Edit
                  </button>
                </td>
              </tr>
              <tr v-if="editingKey === r.resourceKey" class="bg-admin-bg/40">
                <td colspan="8" class="p-4">
                  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label class="flex flex-col gap-1 text-xs text-admin-subtext">
                      Target tier for 2x usage
                      <input v-model="editForm.targetTierFor2x" type="text" class="admin-input" />
                    </label>
                    <label class="flex flex-col gap-1 text-xs text-admin-subtext">
                      Suggested next tier
                      <input v-model="editForm.suggestedNextTier" type="text" class="admin-input" />
                    </label>
                    <label class="flex flex-col gap-1 text-xs text-admin-subtext">
                      Estimated cost/mo (USD)
                      <input
                        v-model.number="editForm.estimatedMonthlyCostUsd"
                        type="number"
                        step="0.01"
                        class="admin-input"
                      />
                    </label>
                    <label class="flex flex-col gap-1 text-xs text-admin-subtext">
                      CPU warn / crit (%)
                      <div class="flex gap-2">
                        <input v-model.number="editForm.thresholds.cpuWarn" type="number" class="admin-input" />
                        <input v-model.number="editForm.thresholds.cpuCrit" type="number" class="admin-input" />
                      </div>
                    </label>
                    <label class="flex flex-col gap-1 text-xs text-admin-subtext">
                      Memory warn / crit (%)
                      <div class="flex gap-2">
                        <input v-model.number="editForm.thresholds.memWarn" type="number" class="admin-input" />
                        <input v-model.number="editForm.thresholds.memCrit" type="number" class="admin-input" />
                      </div>
                    </label>
                    <label class="flex flex-col gap-1 text-xs text-admin-subtext">
                      Memory low (%) / for days (downgrade hint)
                      <div class="flex gap-2">
                        <input v-model.number="editForm.thresholds.memLowPct" type="number" min="0" max="100" class="admin-input" placeholder="e.g. 20" />
                        <input v-model.number="editForm.thresholds.memLowDays" type="number" min="1" max="60" class="admin-input" placeholder="7" />
                      </div>
                    </label>
                    <label class="flex flex-col gap-1 text-xs text-admin-subtext">
                      Disk warn / crit (%)
                      <div class="flex gap-2">
                        <input v-model.number="editForm.thresholds.diskWarn" type="number" class="admin-input" />
                        <input v-model.number="editForm.thresholds.diskCrit" type="number" class="admin-input" />
                      </div>
                    </label>
                  </div>
                  <label class="mt-3 flex flex-col gap-1 text-xs text-admin-subtext">
                    Runbook (upgrade steps, least-downtime path)
                    <textarea v-model="editForm.runbookMarkdown" rows="5" class="admin-input font-mono text-xs" />
                  </label>
                  <div class="mt-3 flex gap-2">
                    <button
                      type="button"
                      class="admin-btn-primary"
                      :disabled="savingConfig"
                      @click="saveEdit(r.resourceKey)"
                    >
                      {{ savingConfig ? 'Saving…' : 'Save' }}
                    </button>
                    <button type="button" class="admin-btn-secondary" @click="cancelEdit">Cancel</button>
                  </div>
                  <p v-if="r.runbookMarkdown" class="mt-3 whitespace-pre-wrap text-xs text-admin-subtext">
                    {{ r.runbookMarkdown }}
                  </p>
                </td>
              </tr>
            </template>
            <tr v-if="loadingResources">
              <td colspan="8" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!resources.length">
              <td colspan="8" class="py-10 text-center text-admin-muted">No resources configured</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Flags -->
    <section class="admin-card">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-medium">Flags</h2>
        <select v-model="flagFilter" class="admin-input w-auto" @change="loadFlags()">
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
          <option value="">All</option>
        </select>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Metric</th>
              <th>Value / threshold</th>
              <th>Severity</th>
              <th>Status</th>
              <th>First detected</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in flags" :key="f.id">
              <td class="text-sm">{{ f.resourceKey }}</td>
              <td class="text-sm">{{ f.metric }}</td>
              <td class="tabular-nums text-sm">{{ f.value }} / {{ f.threshold }}</td>
              <td>
                <span
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :class="f.severity === 'CRITICAL' ? 'bg-admin-danger/10 text-admin-danger' : 'bg-admin-warning/10 text-admin-warning'"
                >
                  {{ f.severity }}
                </span>
              </td>
              <td class="text-sm">{{ f.status }}</td>
              <td class="whitespace-nowrap text-xs text-admin-muted">
                {{ format(new Date(f.firstDetectedAt), 'dd MMM yyyy HH:mm') }}
              </td>
              <td>
                <button
                  v-if="f.status !== 'RESOLVED'"
                  type="button"
                  class="text-xs text-admin-accent hover:underline"
                  @click="resolveFlag(f.id)"
                >
                  Resolve
                </button>
              </td>
            </tr>
            <tr v-if="loadingFlags">
              <td colspan="7" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!flags.length">
              <td colspan="7" class="py-10 text-center text-admin-muted">No flags</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Cost by service -->
    <section class="admin-card">
      <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-lg font-medium">Cost by service — {{ monthLabel }}</h2>
        <div class="flex items-end gap-2">
          <label class="flex flex-col gap-1 text-xs text-admin-subtext">
            Month (UTC)
            <input v-model="monthValue" type="month" class="admin-input w-auto" @change="loadCost()" />
          </label>
          <p v-if="costByService?.fetchedAt" class="text-xs text-admin-muted">
            Fetched {{ format(new Date(costByService.fetchedAt), 'dd MMM HH:mm:ss') }}
          </p>
        </div>
      </div>

      <p v-if="costError" class="rounded-md bg-admin-danger/10 p-3 text-sm text-admin-danger">
        {{ costError }}
      </p>

      <template v-else>
        <div class="mb-4">
          <p class="text-xs text-admin-subtext">Total</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-admin-accent">
            {{ loadingCost ? '…' : costTotal != null ? formatUsd(costTotal) : '—' }}
          </p>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Service" sort-key="service" :active-key="costSortKey" :direction="costSortDir" @sort="toggleCostSort" />
                <SortableTh label="Amount" sort-key="amount" :active-key="costSortKey" :direction="costSortDir" @sort="toggleCostSort" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedCostRows" :key="row.service">
                <td>{{ row.service }}</td>
                <td class="tabular-nums text-sm">{{ formatUsd(row.amount) }}</td>
              </tr>
              <tr v-if="loadingCost">
                <td colspan="2" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!sortedCostRows.length">
                <td colspan="2" class="py-10 text-center text-admin-muted">No spend recorded for this month</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>
