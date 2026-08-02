<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { format, parseISO } from 'date-fns'
import axios from 'axios'
import { ledgerAuditApi } from '@/api/ledgerAudit'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import type {
  LedgerAuditCategory,
  LedgerAuditCode,
  LedgerAuditFlag,
  LedgerAuditSearchType,
  LedgerAuditSeverity,
  LedgerAuditStatus,
} from '@/types/ledgerAudit'
import { formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'

const CODE_OPTIONS: { value: LedgerAuditCode | ''; label: string }[] = [
  { value: '', label: 'All codes' },
  { value: 'VIP_EXPIRY_MISMATCH', label: 'VIP expiry mismatch' },
  { value: 'VIP_ACTIVE_WITHOUT_PURCHASE', label: 'VIP active without purchase' },
  { value: 'VIP_PURCHASE_WITHOUT_LEDGER', label: 'VIP purchase without ledger' },
  { value: 'VIP_LEDGER_WITHOUT_PURCHASE', label: 'VIP ledger without purchase' },
  { value: 'NON_APP_ADMIN_LEDGER', label: 'Admin ledger (INFO)' },
  { value: 'NON_APP_UNKNOWN_LEDGER', label: 'Unknown ledger' },
  { value: 'LEDGER_BALANCE_CHAIN_BREAK', label: 'Balance chain break' },
]

const CATEGORY_OPTIONS: { value: LedgerAuditCategory | ''; label: string }[] = [
  { value: '', label: 'All categories' },
  { value: 'VIP', label: 'VIP' },
  { value: 'COIN', label: 'Coin' },
  { value: 'POINT', label: 'Point' },
  { value: 'TRADING_COIN', label: 'Trading coin' },
]

const SEVERITY_OPTIONS: { value: LedgerAuditSeverity | ''; label: string }[] = [
  { value: '', label: 'All severities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'INFO', label: 'Info' },
]

const QTYPE_OPTIONS: { value: LedgerAuditSearchType; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'displayId', label: 'Display ID' },
  { value: 'publicId', label: 'Public ID' },
  { value: 'userId', label: 'User UUID' },
]

const STATUS_TABS: { value: LedgerAuditStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'DISMISSED', label: 'Dismissed' },
]

const PRESETS: { id: string; label: string; category?: LedgerAuditCategory; code?: LedgerAuditCode }[] =
  [
    { id: 'vip', label: 'VIP problems', category: 'VIP' },
    { id: 'chain', label: 'Balance integrity', code: 'LEDGER_BALANCE_CHAIN_BREAK' },
    { id: 'admin', label: 'Admin money trail', code: 'NON_APP_ADMIN_LEDGER' },
    { id: 'unknown', label: 'Suspicious money', code: 'NON_APP_UNKNOWN_LEDGER' },
  ]

const route = useRoute()
const router = useRouter()

const flags = ref<LedgerAuditFlag[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const loading = ref(false)
const running = ref(false)
const acting = ref(false)

const statusTab = ref<LedgerAuditStatus>('OPEN')
const activePreset = ref<string | null>(null)

const filters = reactive({
  category: '' as LedgerAuditCategory | '',
  code: '' as LedgerAuditCode | '',
  severity: '' as LedgerAuditSeverity | '',
  q: '',
  qType: 'auto' as LedgerAuditSearchType,
  from: '',
  to: '',
})

const selected = ref<LedgerAuditFlag | null>(null)
const resolveOpen = ref(false)
const resolveAction = ref<'ACKNOWLEDGED' | 'DISMISSED' | 'OPEN'>('ACKNOWLEDGED')
const resolveNote = ref('')

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function userDisplayName(flag: LedgerAuditFlag) {
  const u = flag.user
  if (!u) return flag.evidence.username ?? '—'
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
  return name || u.username
}

function severityClass(severity: LedgerAuditSeverity) {
  if (severity === 'CRITICAL') return 'bg-admin-danger/20 text-admin-danger'
  if (severity === 'WARNING') return 'bg-admin-warn/20 text-admin-warn'
  return 'bg-admin-accent/15 text-admin-accent'
}

function categoryLabel(cat: string) {
  if (cat === 'TRADING_COIN') return 'Trading coin'
  return cat
}

function listParams(p = page.value) {
  return {
    page: p,
    limit,
    status: statusTab.value,
    category: filters.category || undefined,
    code: filters.code || undefined,
    severity: filters.severity || undefined,
    q: filters.q.trim() || undefined,
    qType: filters.q.trim() ? filters.qType : undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
  }
}

async function loadFlags(p = 1) {
  loading.value = true
  page.value = p
  try {
    const { data } = await ledgerAuditApi.listFlags(listParams(p))
    flags.value = data.items ?? []
    total.value = data.total ?? 0
  } catch {
    flags.value = []
    total.value = 0
    showToast('Failed to load ledger audit flags', 'error')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  activePreset.value = null
  loadFlags(1)
}

function resetFilters() {
  filters.category = ''
  filters.code = ''
  filters.severity = ''
  filters.q = typeof route.query.q === 'string' ? route.query.q : ''
  filters.qType =
    route.query.qType === 'userId' ||
    route.query.qType === 'publicId' ||
    route.query.qType === 'displayId'
      ? route.query.qType
      : 'auto'
  filters.from = ''
  filters.to = ''
  activePreset.value = null
  loadFlags(1)
}

function applyPreset(preset: (typeof PRESETS)[number]) {
  filters.category = preset.category ?? ''
  filters.code = preset.code ?? ''
  filters.severity = ''
  activePreset.value = preset.id
  loadFlags(1)
}

function setStatusTab(status: LedgerAuditStatus) {
  statusTab.value = status
  selected.value = null
  router.replace({ query: { ...route.query, status } })
  loadFlags(1)
}

function openDetail(flag: LedgerAuditFlag) {
  selected.value = flag
}

function closeDetail() {
  selected.value = null
}

function openResolve(action: 'ACKNOWLEDGED' | 'DISMISSED' | 'OPEN') {
  if (!selected.value) return
  resolveAction.value = action
  resolveNote.value = ''
  resolveOpen.value = true
}

const resolveTitle = computed(() => {
  if (resolveAction.value === 'ACKNOWLEDGED') return 'Acknowledge flag'
  if (resolveAction.value === 'DISMISSED') return 'Dismiss flag'
  return 'Re-open flag'
})

const resolveConfirmLabel = computed(() => {
  if (resolveAction.value === 'ACKNOWLEDGED') return 'Acknowledge'
  if (resolveAction.value === 'DISMISSED') return 'Dismiss'
  return 'Re-open'
})

async function confirmResolve() {
  if (!selected.value || acting.value) return
  acting.value = true
  try {
    const { data } = await ledgerAuditApi.patchFlag(selected.value.id, {
      status: resolveAction.value,
      note: resolveNote.value.trim() || null,
    })
    showToast(
      resolveAction.value === 'OPEN'
        ? 'Flag re-opened'
        : resolveAction.value === 'ACKNOWLEDGED'
          ? 'Flag acknowledged'
          : 'Flag dismissed',
      'success',
    )
    resolveOpen.value = false
    selected.value = data
    await loadFlags(page.value)
    if (data.status !== statusTab.value) {
      selected.value = null
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'LEDGER_AUDIT_FLAG_NOT_FOUND') {
        showToast('Flag not found', 'error')
        selected.value = null
        await loadFlags(page.value)
        return
      }
    }
    showToast('Failed to update flag', 'error')
  } finally {
    acting.value = false
  }
}

async function runAuditNow() {
  if (running.value) return
  running.value = true
  try {
    const { data } = await ledgerAuditApi.runAudit()
    showToast(`Audit queued · ${data.jobId}`, 'success')
    setTimeout(() => {
      void loadFlags(1)
    }, 4000)
  } catch {
    showToast('Failed to queue audit run', 'error')
  } finally {
    running.value = false
  }
}

const evidenceJson = computed(() => {
  if (!selected.value?.evidence) return ''
  try {
    return JSON.stringify(selected.value.evidence, null, 2)
  } catch {
    return String(selected.value.evidence)
  }
})

const isVipMismatch = computed(
  () => selected.value?.code === 'VIP_EXPIRY_MISMATCH',
)

const isChainBreak = computed(
  () => selected.value?.code === 'LEDGER_BALANCE_CHAIN_BREAK',
)

const isLedgerProvenance = computed(() => {
  const code = selected.value?.code
  return code === 'NON_APP_ADMIN_LEDGER' || code === 'NON_APP_UNKNOWN_LEDGER'
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && selected.value && !resolveOpen.value) closeDetail()
}

watch(
  () => selected.value,
  (flag) => {
    document.body.style.overflow = flag ? 'hidden' : ''
  },
)

onMounted(async () => {
  document.addEventListener('keydown', onKeydown)

  if (route.query.status === 'ACKNOWLEDGED' || route.query.status === 'DISMISSED') {
    statusTab.value = route.query.status
  }
  if (typeof route.query.q === 'string') filters.q = route.query.q
  if (
    route.query.qType === 'userId' ||
    route.query.qType === 'publicId' ||
    route.query.qType === 'displayId'
  ) {
    filters.qType = route.query.qType
  }
  if (typeof route.query.code === 'string') filters.code = route.query.code
  if (
    route.query.category === 'VIP' ||
    route.query.category === 'COIN' ||
    route.query.category === 'POINT' ||
    route.query.category === 'TRADING_COIN'
  ) {
    filters.category = route.query.category
  }
  if (
    route.query.severity === 'INFO' ||
    route.query.severity === 'WARNING' ||
    route.query.severity === 'CRITICAL'
  ) {
    filters.severity = route.query.severity
  }

  await loadFlags(1)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Ledger &amp; VIP Audit</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Overnight and on-demand flags for VIP integrity and wallet ledger irregularities
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="admin-btn-secondary text-sm"
          :disabled="loading"
          @click="loadFlags(page)"
        >
          Refresh
        </button>
        <button
          type="button"
          class="admin-btn-primary text-sm"
          :disabled="running"
          @click="runAuditNow"
        >
          {{ running ? 'Queuing…' : 'Run audit now' }}
        </button>
      </div>
    </div>

    <!-- Status tabs -->
    <div class="flex gap-1 rounded-lg border border-admin-border bg-admin-surface p-1 w-fit">
      <button
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        type="button"
        :class="[
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          statusTab === tab.value
            ? 'bg-admin-accent/15 text-admin-accent'
            : 'text-admin-subtext hover:text-admin-text',
        ]"
        @click="setStatusTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Presets -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="preset in PRESETS"
        :key="preset.id"
        type="button"
        :class="[
          'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
          activePreset === preset.id
            ? 'border-admin-accent bg-admin-accent/15 text-admin-accent'
            : 'border-admin-border bg-admin-surface text-admin-subtext hover:text-admin-text',
        ]"
        @click="applyPreset(preset)"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- Filters -->
    <section class="admin-card">
      <div class="mb-4 flex flex-wrap gap-2">
        <select v-model="filters.category" class="admin-input w-auto">
          <option v-for="opt in CATEGORY_OPTIONS" :key="opt.value || 'all'" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="filters.severity" class="admin-input w-auto">
          <option v-for="opt in SEVERITY_OPTIONS" :key="opt.value || 'all'" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="filters.code" class="admin-input w-auto max-w-[220px]">
          <option v-for="opt in CODE_OPTIONS" :key="opt.value || 'all'" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <input
          v-model="filters.q"
          type="text"
          class="admin-input min-w-0 w-full flex-1 sm:min-w-[160px]"
          placeholder="Search user…"
          @keydown.enter="applyFilters"
        />
        <select v-model="filters.qType" class="admin-input w-auto">
          <option v-for="opt in QTYPE_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <input v-model="filters.from" type="date" class="admin-input w-auto" title="From" />
        <input v-model="filters.to" type="date" class="admin-input w-auto" title="To" />
        <button type="button" class="admin-btn-primary" :disabled="loading" @click="applyFilters">
          {{ loading ? 'Loading…' : 'Search' }}
        </button>
        <button type="button" class="admin-btn-secondary" :disabled="loading" @click="resetFilters">
          Reset
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Code</th>
              <th>User</th>
              <th>Summary</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="flag in flags"
              :key="flag.id"
              class="cursor-pointer transition-colors hover:bg-admin-bg/80"
              :class="selected?.id === flag.id ? 'bg-admin-accent/10' : ''"
              @click="openDetail(flag)"
            >
              <td>
                <span
                  :class="[
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    severityClass(flag.severity),
                  ]"
                >
                  {{ flag.severity }}
                </span>
              </td>
              <td>
                <p class="font-mono text-xs font-medium">{{ flag.code }}</p>
                <p class="text-xs text-admin-muted">{{ categoryLabel(flag.category) }}</p>
              </td>
              <td>
                <p class="text-sm font-medium">{{ userDisplayName(flag) }}</p>
                <p class="font-mono text-xs text-admin-subtext">
                  {{ flag.user?.displayId ?? flag.evidence.publicId ?? '—' }}
                  <span v-if="flag.user?.username"> · @{{ flag.user.username }}</span>
                </p>
              </td>
              <td>
                <p class="max-w-[360px] truncate text-sm" :title="flag.summary">{{ flag.summary }}</p>
              </td>
              <td class="whitespace-nowrap text-xs">{{ formatDt(flag.createdAt) }}</td>
            </tr>
            <tr v-if="loading && !flags.length">
              <td colspan="5" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!flags.length">
              <td colspan="5" class="py-10 text-center text-admin-muted">
                No {{ statusTab.toLowerCase() }} flags found
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
            @click="loadFlags(page - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="page * limit >= total || loading"
            @click="loadFlags(page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <!-- Detail drawer -->
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="selected" class="fixed inset-0 z-50 flex justify-end">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeDetail" />
          <aside
            class="relative flex h-full w-full max-w-lg flex-col border-l border-admin-border bg-admin-surface shadow-2xl sm:max-w-lg"
            role="dialog"
            aria-modal="true"
          >
            <div class="flex items-start justify-between gap-3 border-b border-admin-border px-5 py-4">
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    :class="[
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      severityClass(selected.severity),
                    ]"
                  >
                    {{ selected.severity }}
                  </span>
                  <span class="rounded-md bg-admin-bg px-2 py-0.5 text-xs text-admin-subtext">
                    {{ categoryLabel(selected.category) }}
                  </span>
                  <span class="rounded-md bg-admin-bg px-2 py-0.5 text-xs text-admin-subtext">
                    {{ selected.status }}
                  </span>
                </div>
                <h2 class="truncate font-mono text-sm font-semibold">{{ selected.code }}</h2>
                <p class="mt-1 text-sm text-admin-subtext">{{ selected.summary }}</p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-md p-1 text-admin-subtext hover:bg-admin-border hover:text-admin-text"
                aria-label="Close"
                @click="closeDetail"
              >
                ✕
              </button>
            </div>

            <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <!-- User -->
              <section>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  User
                </h3>
                <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                  <p class="font-medium">{{ userDisplayName(selected) }}</p>
                  <p class="font-mono text-xs text-admin-subtext">
                    Display ID:
                    {{ selected.user?.displayId ?? selected.evidence.publicId ?? '—' }}
                  </p>
                  <p v-if="selected.user?.username" class="text-xs text-admin-subtext">
                    @{{ selected.user.username }}
                  </p>
                  <RouterLink
                    :to="`/admin/users/${selected.userId}`"
                    class="mt-2 inline-block text-xs font-medium text-admin-accent hover:underline"
                  >
                    Open user profile →
                  </RouterLink>
                </div>
              </section>

              <!-- VIP mismatch -->
              <section v-if="isVipMismatch">
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Expiry comparison
                </h3>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div class="rounded-md border border-admin-border p-3">
                    <p class="text-xs text-admin-muted">Expected</p>
                    <p class="mt-1 font-medium tabular-nums">
                      {{ formatDt(selected.evidence.expectedExpiresAt) }}
                    </p>
                  </div>
                  <div class="rounded-md border border-admin-warn/40 bg-admin-warn/5 p-3">
                    <p class="text-xs text-admin-muted">Actual</p>
                    <p class="mt-1 font-medium tabular-nums">
                      {{ formatDt(selected.evidence.actualExpiresAt) }}
                    </p>
                  </div>
                </div>
                <p class="mt-2 text-xs text-admin-muted">
                  Purchases: {{ selected.evidence.purchaseCount ?? selected.evidence.purchases?.length ?? 0 }}
                </p>
                <div
                  v-if="selected.evidence.purchases?.length"
                  class="mt-3 admin-table-wrap"
                >
                  <table class="admin-table text-xs">
                    <thead>
                      <tr>
                        <th>Created</th>
                        <th>Days</th>
                        <th>Cost</th>
                        <th>Expires after</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="p in selected.evidence.purchases" :key="p.id">
                        <td class="whitespace-nowrap">{{ formatDt(p.createdAt) }}</td>
                        <td>{{ p.periodDays }}</td>
                        <td class="font-mono">{{ p.coinCost }}</td>
                        <td class="whitespace-nowrap">{{ formatDt(p.expiresAtAfter) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <!-- Chain break -->
              <section v-if="isChainBreak">
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Balance chain
                </h3>
                <div class="space-y-2 rounded-md border border-admin-danger/30 bg-admin-danger/5 p-3 text-sm">
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Currency</span>
                    <span class="font-medium">{{ selected.evidence.currencyType ?? '—' }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Direction</span>
                    <span class="font-medium">
                      {{ selected.evidence.direction ?? '—' }}
                      <span v-if="selected.evidence.txType" class="text-admin-subtext">
                        · {{ selected.evidence.txType }}
                      </span>
                    </span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Amount</span>
                    <span class="font-mono font-medium">{{ selected.evidence.amount ?? '—' }}</span>
                  </div>
                  <div class="my-2 border-t border-admin-border" />
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Before</span>
                    <span class="font-mono">{{ selected.evidence.balanceBefore ?? '—' }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Expected after</span>
                    <span class="font-mono text-admin-success">
                      {{ selected.evidence.expectedBalanceAfter ?? '—' }}
                    </span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Actual after</span>
                    <span class="font-mono text-admin-danger">
                      {{ selected.evidence.actualBalanceAfter ?? '—' }}
                    </span>
                  </div>
                  <p
                    v-if="selected.evidence.balanceCarriesForward"
                    class="text-xs text-admin-warn"
                  >
                    Escrow soft marker — balance should carry forward unchanged
                  </p>
                </div>
                <div class="mt-2 space-y-1 font-mono text-[10px] text-admin-muted">
                  <p v-if="selected.evidence.ledgerEntryId">
                    entry: {{ selected.evidence.ledgerEntryId }}
                  </p>
                  <p v-if="selected.evidence.priorLedgerEntryId">
                    prior: {{ selected.evidence.priorLedgerEntryId }}
                  </p>
                </div>
              </section>

              <!-- Ledger provenance -->
              <section v-if="isLedgerProvenance">
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Ledger entry
                </h3>
                <div class="space-y-2 rounded-md border border-admin-border p-3 text-sm">
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Origin</span>
                    <span class="font-medium">{{ selected.evidence.origin ?? '—' }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Currency</span>
                    <span>{{ selected.evidence.currencyType ?? '—' }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Type / dir</span>
                    <span>
                      {{ selected.evidence.txType ?? '—' }} ·
                      {{ selected.evidence.direction ?? '—' }}
                    </span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Amount</span>
                    <span class="font-mono font-medium">{{ selected.evidence.amount ?? '—' }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-admin-muted">Balance after</span>
                    <span class="font-mono">{{ selected.evidence.balanceAfter ?? '—' }}</span>
                  </div>
                  <p
                    v-if="selected.evidence.idempotencyKey"
                    class="break-all font-mono text-[10px] text-admin-muted"
                  >
                    key: {{ selected.evidence.idempotencyKey }}
                  </p>
                  <p v-if="selected.evidence.description" class="text-xs text-admin-subtext">
                    {{ selected.evidence.description }}
                  </p>
                </div>
              </section>

              <!-- Meta -->
              <section>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Flag meta
                </h3>
                <dl class="space-y-1.5 text-xs">
                  <div class="flex justify-between gap-2">
                    <dt class="text-admin-muted">Window</dt>
                    <dd class="text-right">
                      {{ formatDt(selected.windowStart) }} → {{ formatDt(selected.windowEnd) }}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt class="text-admin-muted">Created</dt>
                    <dd>{{ formatDt(selected.createdAt) }}</dd>
                  </div>
                  <div v-if="selected.resolvedAt" class="flex justify-between gap-2">
                    <dt class="text-admin-muted">Resolved</dt>
                    <dd>{{ formatDt(selected.resolvedAt) }}</dd>
                  </div>
                  <div v-if="selected.resolutionNote" class="pt-1">
                    <dt class="text-admin-muted">Note</dt>
                    <dd class="mt-0.5 text-admin-text">{{ selected.resolutionNote }}</dd>
                  </div>
                  <div class="pt-1">
                    <dt class="text-admin-muted">Fingerprint</dt>
                    <dd class="mt-0.5 break-all font-mono text-[10px] text-admin-subtext">
                      {{ selected.fingerprint }}
                    </dd>
                  </div>
                </dl>
              </section>

              <!-- Raw evidence -->
              <section>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Evidence (JSON)
                </h3>
                <pre
                  class="max-h-64 overflow-auto rounded-md border border-admin-border bg-admin-bg p-3 font-mono text-[11px] leading-relaxed text-admin-subtext"
                >{{ evidenceJson }}</pre>
              </section>
            </div>

            <div class="flex flex-wrap gap-2 border-t border-admin-border px-5 py-4">
              <template v-if="selected.status === 'OPEN'">
                <button
                  type="button"
                  class="admin-btn-primary flex-1 text-sm"
                  @click="openResolve('ACKNOWLEDGED')"
                >
                  Acknowledge
                </button>
                <button
                  type="button"
                  class="admin-btn-secondary flex-1 text-sm"
                  @click="openResolve('DISMISSED')"
                >
                  Dismiss
                </button>
              </template>
              <button
                v-else
                type="button"
                class="admin-btn-warn w-full text-sm"
                @click="openResolve('OPEN')"
              >
                Re-open
              </button>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <BaseDialog :open="resolveOpen" :title="resolveTitle" size="sm" @close="resolveOpen = false">
      <template #body>
        <p class="mb-3 text-sm text-admin-subtext">
          <span class="font-mono text-admin-text">{{ selected?.code }}</span>
          · optional note (max 2000)
        </p>
        <textarea
          v-model="resolveNote"
          rows="3"
          maxlength="2000"
          class="admin-input resize-none"
          placeholder="Resolution note…"
        />
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="resolveOpen = false">Cancel</button>
        <button
          type="button"
          :class="resolveAction === 'DISMISSED' ? 'admin-btn-warn' : 'admin-btn-primary'"
          :disabled="acting"
          @click="confirmResolve"
        >
          {{ acting ? 'Saving…' : resolveConfirmLabel }}
        </button>
      </template>
    </BaseDialog>
  </div>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-active aside,
.drawer-leave-active aside {
  transition: transform 0.25s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from aside,
.drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
