<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { format } from 'date-fns'
import {
  liveFailuresApi,
  LIVE_FAILURE_AREA_LABELS,
  LIVE_FAILURE_KIND_LABELS,
  LIVE_FAILURE_SEVERITY_LABELS,
  type LiveFailureArea,
  type LiveFailureDay,
  type LiveFailureEvent,
  type LiveFailureKind,
  type LiveFailureSeverity,
} from '@/api/liveFailures'
import { formatNumber } from '@/utils/format'

/**
 * Live and call failures recorded by Live-server (backlog LIVE-06, hardening BE-01..11):
 * rejected /go-live and /join calls, app-reported events and connect errors, ghost-sweep and
 * heartbeat-lost auto-ends, abandoned go-lives and dropped calls, each with a severity
 * (S0 critical .. S4 info). Newest first; Live-server keeps the last 5,000 events here
 * (90 days in the live_failure_events table).
 */
const props = defineProps<{ userId?: string }>()

const PAGE_SIZE = 50
const KINDS = Object.keys(LIVE_FAILURE_KIND_LABELS) as LiveFailureKind[]
const SEVERITIES = Object.keys(LIVE_FAILURE_SEVERITY_LABELS) as LiveFailureSeverity[]
const AREAS = Object.keys(LIVE_FAILURE_AREA_LABELS) as LiveFailureArea[]

const kind = ref<'' | LiveFailureKind>('')
const severity = ref<'' | LiveFailureSeverity>('')
const area = ref<'' | LiveFailureArea>('')
const code = ref('')
const streamId = ref('')
const page = ref(1)
const loading = ref(false)
const loadError = ref('')
const items = ref<LiveFailureEvent[]>([])
const total = ref(0)
const retained = ref(0)
const maxRetained = ref(0)
const summary = ref<LiveFailureDay[]>([])
const expandedId = ref<string | null>(null)

const todayTotal = computed(() => summary.value[0]?.total ?? 0)
const weekBySeverity = computed(() => {
  const out = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<LiveFailureSeverity, number>
  for (const d of summary.value) for (const s of SEVERITIES) out[s] += d.bySeverity?.[s] ?? 0
  return out
})

async function load(nextPage = 1) {
  loading.value = true
  loadError.value = ''
  page.value = nextPage
  try {
    const data = await liveFailuresApi.list({
      kind: kind.value || undefined,
      severity: severity.value || undefined,
      area: area.value || undefined,
      userId: props.userId?.trim() || undefined,
      streamId: streamId.value.trim() || undefined,
      code: code.value.trim() || undefined,
      page: nextPage,
      limit: PAGE_SIZE,
    })
    items.value = data.items ?? []
    total.value = data.pagination?.total ?? items.value.length
    retained.value = data.retained ?? 0
    maxRetained.value = data.maxRetained ?? 0
    summary.value = data.summary ?? []
  } catch {
    items.value = []
    total.value = 0
    loadError.value = 'Could not load failures from the live backend.'
  } finally {
    loading.value = false
  }
}

defineExpose({ load })

onMounted(() => void load(1))
watch([kind, severity, area], () => void load(1))

function kindClass(k: LiveFailureKind) {
  switch (k) {
    case 'CLIENT_CONNECT_FAILED':
    case 'GHOST_STREAM_ENDED':
    case 'CALL_NET_LOST':
    case 'CALL_CONNECT_FAIL':
      return 'text-admin-danger'
    case 'HEARTBEAT_LOST':
    case 'GOLIVE_ABANDONED':
      return 'text-admin-warn'
    default:
      return 'text-admin-text'
  }
}

function severityClass(s?: LiveFailureSeverity) {
  switch (s) {
    case 'S0':
    case 'S1':
      return 'bg-admin-danger/15 text-admin-danger'
    case 'S2':
      return 'bg-admin-warn/15 text-admin-warn'
    case 'S3':
      return 'bg-admin-accent/15 text-admin-accent'
    default:
      return 'bg-admin-subtext/10 text-admin-subtext'
  }
}

/** Meta plus the BE-01 context fields (app version, device, network, source, role, call). */
function metaEntries(row: LiveFailureEvent) {
  const extra: [string, string | number | boolean][] = []
  for (const k of ['source', 'role', 'callId', 'appVersion', 'platform', 'deviceModel', 'network'] as const) {
    const v = row[k]
    if (v) extra.push([k, v])
  }
  if (row.occurredAt && row.source === 'app') extra.push(['occurredAt', row.occurredAt])
  return [...extra, ...Object.entries(row.meta ?? {}).filter(([k]) => k !== 'ua')]
}

function userLabel(row: LiveFailureEvent) {
  if (row.user) return row.user.name || row.user.username || row.user.id.slice(0, 8)
  return row.userId ? row.userId.slice(0, 8) : '—'
}
</script>

<template>
  <div class="space-y-3">
    <div class="admin-stats-grid">
      <div class="admin-card">
        <p class="text-xs text-admin-muted">Today (UTC)</p>
        <p class="text-lg font-semibold tabular-nums">{{ formatNumber(todayTotal) }}</p>
      </div>
      <button
        v-for="s in SEVERITIES"
        :key="s"
        type="button"
        class="admin-card text-left"
        :class="severity === s ? 'ring-1 ring-admin-accent' : ''"
        :title="`Show only ${LIVE_FAILURE_SEVERITY_LABELS[s]}`"
        @click="severity = severity === s ? '' : s"
      >
        <p class="text-xs text-admin-muted">{{ LIVE_FAILURE_SEVERITY_LABELS[s] }} · 7d</p>
        <p class="text-lg font-semibold tabular-nums" :class="severityClass(s).split(' ').at(-1)">
          {{ formatNumber(weekBySeverity[s]) }}
        </p>
      </button>
    </div>

    <div class="admin-filter-bar">
      <select v-model="severity" class="admin-input w-auto">
        <option value="">All severities</option>
        <option v-for="s in SEVERITIES" :key="s" :value="s">{{ LIVE_FAILURE_SEVERITY_LABELS[s] }}</option>
      </select>
      <select v-model="area" class="admin-input w-auto">
        <option value="">All areas</option>
        <option v-for="a in AREAS" :key="a" :value="a">{{ LIVE_FAILURE_AREA_LABELS[a] }}</option>
      </select>
      <select v-model="kind" class="admin-input w-auto">
        <option value="">All failure types</option>
        <option v-for="k in KINDS" :key="k" :value="k">{{ LIVE_FAILURE_KIND_LABELS[k] }}</option>
      </select>
      <input
        v-model="code"
        class="admin-input w-48"
        placeholder="Code (e.g. KICKED)"
        @keyup.enter="load(1)"
      />
      <input
        v-model="streamId"
        class="admin-input w-64"
        placeholder="Stream / room id"
        @keyup.enter="load(1)"
      />
      <button type="button" class="admin-btn-secondary" :disabled="loading" @click="load(1)">
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
      <span class="text-xs text-admin-muted">
        {{ formatNumber(total) }} matching · last {{ formatNumber(retained) }} of
        {{ formatNumber(maxRetained) }} kept
      </span>
    </div>

    <p v-if="loadError" class="text-sm text-admin-danger">{{ loadError }}</p>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Severity</th>
            <th>Type</th>
            <th>User</th>
            <th>Code / status</th>
            <th>Message</th>
            <th>Context</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="whitespace-nowrap text-xs">{{ format(new Date(row.at), 'dd MMM yyyy HH:mm:ss') }}</td>
            <td class="whitespace-nowrap text-xs">
              <span
                v-if="row.severity"
                class="rounded px-1.5 py-0.5 font-semibold"
                :class="severityClass(row.severity)"
                :title="LIVE_FAILURE_SEVERITY_LABELS[row.severity]"
              >
                {{ row.severity }}
              </span>
              <span v-else class="text-admin-muted">—</span>
              <p v-if="row.area" class="mt-0.5 text-[11px] text-admin-muted">{{ row.area }}</p>
            </td>
            <td class="text-xs font-medium" :class="kindClass(row.kind)">
              {{ LIVE_FAILURE_KIND_LABELS[row.kind] ?? row.kind }}
            </td>
            <td class="text-sm">
              <RouterLink
                v-if="row.userId"
                class="text-admin-accent hover:underline"
                :to="`/admin/users/${row.userId}`"
              >
                {{ userLabel(row) }}
              </RouterLink>
              <span v-else class="text-admin-muted">—</span>
              <p v-if="row.user?.country" class="text-xs text-admin-muted">{{ row.user.country }}</p>
            </td>
            <td class="whitespace-nowrap text-xs">
              {{ row.code || '—' }}<span v-if="row.status" class="text-admin-muted"> · {{ row.status }}</span>
            </td>
            <td class="max-w-xs break-words text-xs">
              {{ row.message || '—' }}
              <p v-if="row.streamId" class="font-mono text-[11px] text-admin-muted">{{ row.streamId }}</p>
            </td>
            <td class="text-xs">
              <template v-if="metaEntries(row).length">
                <button
                  type="button"
                  class="text-admin-accent hover:underline"
                  @click="expandedId = expandedId === row.id ? null : row.id"
                >
                  {{ expandedId === row.id ? 'Hide' : `${metaEntries(row).length} fields` }}
                </button>
                <dl v-if="expandedId === row.id" class="mt-1 space-y-0.5">
                  <div v-for="[k, v] in metaEntries(row)" :key="k" class="flex gap-1">
                    <dt class="text-admin-muted">{{ k }}:</dt>
                    <dd class="break-all">{{ v }}</dd>
                  </div>
                </dl>
              </template>
              <span v-else class="text-admin-muted">—</span>
            </td>
          </tr>
          <tr v-if="!items.length && !loading">
            <td colspan="7" class="py-10 text-center text-admin-muted">No failures recorded</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > PAGE_SIZE" class="flex justify-end gap-2">
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
        :disabled="page * PAGE_SIZE >= total || loading"
        @click="load(page + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>
