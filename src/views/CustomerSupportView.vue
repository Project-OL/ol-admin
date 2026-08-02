<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { format } from 'date-fns'
import { useRouter } from 'vue-router'
import { customerSupportApi } from '@/api/customerSupport'
import { useAuthStore } from '@/stores/auth'
import { useSupportNotificationsStore } from '@/stores/supportNotifications'
import type {
  AdminStatus,
  CsaAdmin,
  CsaOverview,
  CsaPerformance,
  ReportStatus,
  SupportReport,
  SupportTicketListItem,
  SupportTicketPriority,
  SupportTicketStage,
  SupportTicketStatus,
} from '@/types/customerSupport'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import AssignCsaViewsDialog from '@/components/support/AssignCsaViewsDialog.vue'
import { formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'

const router = useRouter()
const auth = useAuthStore()
const notifStore = useSupportNotificationsStore()

const isSuperAdmin = computed(() => auth.isSuperAdmin)
const isModeratorOnly = computed(() => auth.role === 'MODERATOR')
const canWorkTickets = computed(() => auth.isSuperAdmin || auth.isCustomerSupport)
const defaultTab = computed(() => {
  if (isSuperAdmin.value) return 'agents' as const
  if (isModeratorOnly.value) return 'reports' as const
  return 'tickets' as const
})
const tab = ref<'agents' | 'tickets' | 'reports'>(defaultTab.value)

watch(
  () => auth.role,
  () => {
    if (!isSuperAdmin.value && tab.value === 'agents') {
      tab.value = isModeratorOnly.value ? 'reports' : 'tickets'
    }
    if (isModeratorOnly.value && tab.value === 'tickets') tab.value = 'reports'
  },
)

// --- Agents (SUPER_ADMIN) ---
const overview = ref<CsaOverview | null>(null)
const csas = ref<CsaAdmin[]>([])
const csasTotal = ref(0)
const csasPage = ref(1)
const loadingCsas = ref(false)
const csaFilters = reactive({
  status: '' as '' | AdminStatus,
  country: '',
  search: '',
})
const createCsaOpen = ref(false)
const editCsa = ref<CsaAdmin | null>(null)
const viewsCsa = ref<CsaAdmin | null>(null)
const acting = ref(false)
const csaForm = reactive({
  name: '',
  username: '',
  email: '',
  password: '',
  phone: '',
  phoneCountryCode: '+91',
  gender: '' as '' | 'male' | 'female' | 'other',
  country: '',
})
const csaFormErrors = reactive({
  name: '',
  username: '',
  email: '',
  password: '',
  phone: '',
  phoneCountryCode: '',
  country: '',
})

// --- Tickets ---
const tickets = ref<SupportTicketListItem[]>([])
const ticketsTotal = ref(0)
const ticketsPage = ref(1)
const loadingTickets = ref(false)
const myStats = ref<CsaPerformance | null>(null)
const ticketQueue = ref<'me' | 'unassigned' | 'all'>('me')
const ticketFilters = reactive({
  status: '' as '' | SupportTicketStatus,
  priority: '' as '' | SupportTicketPriority,
})

// --- Reports ---
const reports = ref<SupportReport[]>([])
const reportsTotal = ref(0)
const reportsPage = ref(1)
const loadingReports = ref(false)
const reportFilters = reactive({
  status: 'PENDING' as '' | ReportStatus,
  context: '' as '' | 'CHAT' | 'LIVE',
})
const selectedReport = ref<SupportReport | null>(null)
const reportNote = ref('')
const reportActing = ref(false)

function resetCsaForm() {
  csaForm.name = ''
  csaForm.username = ''
  csaForm.email = ''
  csaForm.password = ''
  csaForm.phone = ''
  csaForm.phoneCountryCode = '+91'
  csaForm.gender = ''
  csaForm.country = ''
  Object.keys(csaFormErrors).forEach((k) => {
    csaFormErrors[k as keyof typeof csaFormErrors] = ''
  })
}

function validateCsaForm(isEdit: boolean): boolean {
  Object.keys(csaFormErrors).forEach((k) => {
    csaFormErrors[k as keyof typeof csaFormErrors] = ''
  })
  let ok = true
  if (!csaForm.name.trim() || csaForm.name.trim().length < 2) {
    csaFormErrors.name = 'Name is required (min 2 chars)'
    ok = false
  }
  if (!csaForm.username.trim() || !/^[a-zA-Z0-9._-]{3,50}$/.test(csaForm.username.trim())) {
    csaFormErrors.username = 'Username: 3–50 chars, letters/digits/._-'
    ok = false
  }
  if (!isEdit) {
    if (!csaForm.email.trim() || !csaForm.email.includes('@')) {
      csaFormErrors.email = 'Valid email is required'
      ok = false
    }
    if (!csaForm.password || csaForm.password.length < 12) {
      csaFormErrors.password = 'Password must be at least 12 characters'
      ok = false
    }
  }
  if (!csaForm.phone.trim() || csaForm.phone.trim().length < 4) {
    csaFormErrors.phone = 'Phone is required'
    ok = false
  }
  if (!csaForm.phoneCountryCode.trim()) {
    csaFormErrors.phoneCountryCode = 'Country code is required'
    ok = false
  }
  if (!csaForm.country.trim() || csaForm.country.trim().length < 2) {
    csaFormErrors.country = 'Country is required (drives ticket routing)'
    ok = false
  }
  return ok
}

async function loadOverview() {
  if (!isSuperAdmin.value) return
  try {
    const { data } = await customerSupportApi.getCsaOverview()
    overview.value = data
  } catch {
    /* interceptor */
  }
}

async function loadCsas(page = 1) {
  if (!isSuperAdmin.value) return
  loadingCsas.value = true
  csasPage.value = page
  try {
    const { data } = await customerSupportApi.listCsas({
      page,
      limit: 20,
      status: csaFilters.status || undefined,
      country: csaFilters.country.trim() || undefined,
      search: csaFilters.search.trim() || undefined,
    })
    csas.value = data.csas ?? []
    csasTotal.value = data.total ?? 0
  } finally {
    loadingCsas.value = false
  }
}

function openCreateCsa() {
  resetCsaForm()
  createCsaOpen.value = true
}

function openAssignViews(csa: CsaAdmin) {
  viewsCsa.value = csa
}

function openEditCsa(csa: CsaAdmin) {
  editCsa.value = csa
  csaForm.name = csa.name
  csaForm.username = csa.username ?? ''
  csaForm.email = csa.email
  csaForm.password = ''
  csaForm.phone = csa.phone ?? ''
  csaForm.phoneCountryCode = csa.phoneCountryCode ?? '+91'
  csaForm.gender = (csa.gender as typeof csaForm.gender) || ''
  csaForm.country = csa.country ?? ''
  Object.keys(csaFormErrors).forEach((k) => {
    csaFormErrors[k as keyof typeof csaFormErrors] = ''
  })
}

async function submitCreateCsa() {
  if (!validateCsaForm(false)) {
    showToast('Fix validation errors', 'error')
    return
  }
  acting.value = true
  try {
    await customerSupportApi.createCsa({
      name: csaForm.name.trim(),
      username: csaForm.username.trim(),
      email: csaForm.email.trim(),
      password: csaForm.password,
      phone: csaForm.phone.trim(),
      phoneCountryCode: csaForm.phoneCountryCode.trim(),
      gender: csaForm.gender || undefined,
      country: csaForm.country.trim(),
    })
    showToast('Customer support agent created', 'success')
    createCsaOpen.value = false
    await Promise.all([loadCsas(1), loadOverview()])
  } catch {
    showToast('Failed to create CSA', 'error')
  } finally {
    acting.value = false
  }
}

async function submitEditCsa() {
  if (!editCsa.value) return
  if (!validateCsaForm(true)) {
    showToast('Fix validation errors', 'error')
    return
  }
  acting.value = true
  try {
    await customerSupportApi.updateCsa(editCsa.value.id, {
      name: csaForm.name.trim(),
      username: csaForm.username.trim(),
      phone: csaForm.phone.trim(),
      phoneCountryCode: csaForm.phoneCountryCode.trim(),
      gender: csaForm.gender || null,
      country: csaForm.country.trim(),
    })
    showToast('CSA updated', 'success')
    editCsa.value = null
    await loadCsas(csasPage.value)
  } catch {
    showToast('Failed to update CSA', 'error')
  } finally {
    acting.value = false
  }
}

async function setCsaStatus(csa: CsaAdmin, status: AdminStatus) {
  acting.value = true
  try {
    const { data } = await customerSupportApi.setCsaStatus(csa.id, status)
    const re = data.csa.reassignment
    if (re) {
      showToast(
        `Status → ${status}. Reassigned ${re.reassigned}, unassigned ${re.unassigned}`,
        re.unassigned > 0 ? 'error' : 'success',
      )
    } else {
      showToast(`CSA ${status.toLowerCase()}`, 'success')
    }
    await Promise.all([loadCsas(csasPage.value), loadOverview()])
  } finally {
    acting.value = false
  }
}

async function exportCsas() {
  try {
    const csv = await customerSupportApi.exportCsasCsv(csaFilters.status || undefined)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `csa-export-${csaFilters.status || 'all'}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Export downloaded', 'success')
  } catch {
    showToast('Export failed', 'error')
  }
}

async function loadMyStats() {
  try {
    const { data } = await customerSupportApi.myStats()
    myStats.value = data.stats
  } catch {
    /* CSA-only; SA may still call */
  }
}

async function loadTickets(page = 1) {
  loadingTickets.value = true
  ticketsPage.value = page
  try {
    const assignedTo = isSuperAdmin.value
      ? ticketQueue.value
      : ticketQueue.value === 'all'
        ? 'me'
        : ticketQueue.value
    const { data } = await customerSupportApi.listTickets({
      page,
      limit: 20,
      assignedTo,
      status: ticketFilters.status || undefined,
      priority: ticketFilters.priority || undefined,
    })
    tickets.value = data.tickets ?? []
    ticketsTotal.value = data.pagination?.total ?? 0
  } finally {
    loadingTickets.value = false
  }
}

function stageLabel(stage: SupportTicketStage) {
  const map: Record<SupportTicketStage, string> = {
    open: 'Open',
    assigned: 'In progress',
    pending_review: 'Pending review',
    closed: 'Closed',
  }
  return map[stage] ?? stage
}

function stageTone(stage: SupportTicketStage): 'active' | 'inactive' | 'warn' {
  if (stage === 'closed') return 'inactive'
  if (stage === 'pending_review') return 'warn'
  return 'active'
}

function priorityClass(p: SupportTicketPriority) {
  if (p === 'URGENT') return 'text-admin-danger'
  if (p === 'HIGH') return 'text-amber-400'
  return 'text-admin-subtext'
}

function openTicket(ticket: SupportTicketListItem) {
  router.push('/admin/support/tickets/' + ticket.id)
}

async function claimTicket(ticket: SupportTicketListItem, event: Event) {
  event.stopPropagation()
  try {
    await customerSupportApi.claim(ticket.id)
    showToast('Ticket claimed', 'success')
    await loadTickets(ticketsPage.value)
  } catch {
    showToast('Could not claim ticket', 'error')
  }
}

async function loadReports(page = 1) {
  loadingReports.value = true
  reportsPage.value = page
  try {
    const { data } = await customerSupportApi.listReports({
      page,
      limit: 20,
      status: reportFilters.status || undefined,
      context: reportFilters.context || undefined,
    })
    reports.value = data.reports ?? []
    reportsTotal.value = data.pagination?.total ?? data.total ?? reports.value.length
  } finally {
    loadingReports.value = false
  }
}

async function openReport(report: SupportReport) {
  try {
    const { data } = await customerSupportApi.getReport(report.id)
    selectedReport.value = data.report
    reportNote.value = ''
  } catch {
    selectedReport.value = report
  }
}

async function reviewReport(status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED') {
  if (!selectedReport.value) return
  reportActing.value = true
  try {
    await customerSupportApi.reviewReport(selectedReport.value.id, {
      status,
      resolutionNote: reportNote.value.trim() || undefined,
    })
    showToast('Report updated', 'success')
    selectedReport.value = null
    await loadReports(reportsPage.value)
  } catch {
    showToast('Failed to update report', 'error')
  } finally {
    reportActing.value = false
  }
}

async function escalateReport() {
  if (!selectedReport.value) return
  reportActing.value = true
  try {
    const { data } = await customerSupportApi.escalateReport(selectedReport.value.id)
    showToast('Escalated to ticket ' + (data.ticket.publicId ?? data.ticket.id), 'success')
    selectedReport.value = null
    await loadReports(reportsPage.value)
    if (data.ticket.id) router.push('/admin/support/tickets/' + data.ticket.id)
  } catch {
    showToast('Escalate failed', 'error')
  } finally {
    reportActing.value = false
  }
}

watch(tab, (t) => {
  if (t === 'agents') void Promise.all([loadOverview(), loadCsas()])
  if (t === 'tickets') void Promise.all([loadTickets(), loadMyStats()])
  if (t === 'reports') void loadReports()
})

onMounted(() => {
  tab.value = defaultTab.value
  if (tab.value === 'agents') void Promise.all([loadOverview(), loadCsas()])
  else if (tab.value === 'tickets') void Promise.all([loadTickets(), loadMyStats()])
  else void loadReports()
})
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Customer Support</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        {{
          isSuperAdmin
            ? 'Manage CSA agents, tickets, and user reports'
            : 'Ticket workbench and report review'
        }}
      </p>
    </div>

    <div class="admin-card">
      <div class="mb-4 flex flex-col gap-3 border-b border-admin-border pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex w-full gap-1 rounded-lg bg-admin-bg p-1 sm:w-auto">
          <button
            v-if="isSuperAdmin"
            type="button"
            :class="[
              'min-w-0 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
              tab === 'agents' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="tab = 'agents'"
          >
            Agents
          </button>
          <button
            v-if="canWorkTickets"
            type="button"
            :class="[
              'min-w-0 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
              tab === 'tickets' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="tab = 'tickets'"
          >
            Tickets
            <span
              v-if="notifStore.badge.myAwaitingReply"
              class="ml-1 rounded-full bg-admin-danger px-1.5 text-[10px] text-white"
            >
              {{ notifStore.badge.myAwaitingReply }}
            </span>
          </button>
          <button
            type="button"
            :class="[
              'min-w-0 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
              tab === 'reports' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="tab = 'reports'"
          >
            Reports
          </button>
        </div>
        <button
          v-if="tab === 'agents'"
          type="button"
          class="admin-btn-primary w-full text-sm sm:w-auto"
          @click="openCreateCsa"
        >
          Add CSA
        </button>
      </div>

      <!-- Agents -->
      <div v-show="tab === 'agents'" class="space-y-4">
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Total</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ formatNumber(overview?.totalCsa ?? 0) }}</p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Active</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-success">
              {{ formatNumber(overview?.activeCsa ?? 0) }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Online</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ formatNumber(overview?.onlineNow ?? 0) }}</p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Suspended</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-warn">
              {{ formatNumber(overview?.suspendedCsa ?? 0) }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Disabled</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ formatNumber(overview?.disabledCsa ?? 0) }}</p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Failed logins 24h</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">
              {{ formatNumber(overview?.failedLoginAttempts24h ?? 0) }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Locked</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-danger">
              {{ formatNumber(overview?.lockedAccounts ?? 0) }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <input
            v-model="csaFilters.search"
            class="admin-input min-w-0 w-full flex-1 sm:min-w-[160px]"
            placeholder="Search name, email, username…"
            @keydown.enter="loadCsas(1)"
          />
          <select v-model="csaFilters.status" class="admin-input w-auto" @change="loadCsas(1)">
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISABLED">Disabled</option>
          </select>
          <input
            v-model="csaFilters.country"
            class="admin-input w-36"
            placeholder="Country"
            @keydown.enter="loadCsas(1)"
          />
          <button type="button" class="admin-btn-primary" :disabled="loadingCsas" @click="loadCsas(1)">
            Search
          </button>
          <button type="button" class="admin-btn-secondary" @click="exportCsas">Export CSV</button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Contact</th>
                <th>Country</th>
                <th>Open</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="csa in csas" :key="csa.id">
                <td>
                  <div class="flex items-center gap-2">
                    <span
                      class="h-2 w-2 shrink-0 rounded-full"
                      :class="csa.isOnline ? 'bg-admin-success' : 'bg-admin-muted'"
                      :title="csa.isOnline ? 'Online' : 'Offline'"
                    />
                    <div>
                      <p class="font-medium">{{ csa.name }}</p>
                      <p class="font-mono text-xs text-admin-muted">@{{ csa.username }}</p>
                    </div>
                  </div>
                </td>
                <td class="text-sm">
                  <p>{{ csa.email }}</p>
                  <p class="text-xs text-admin-muted">
                    {{ csa.phoneCountryCode }} {{ csa.phone }}
                  </p>
                </td>
                <td class="text-sm">{{ csa.country ?? '—' }}</td>
                <td class="tabular-nums">{{ csa.openTicketCount ?? 0 }}</td>
                <td>
                  <StatusBadge
                    :status="csa.status === 'ACTIVE' ? 'active' : 'inactive'"
                    :label="csa.status"
                  />
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ csa.lastLoginAt ? format(new Date(csa.lastLoginAt), 'dd MMM yyyy HH:mm') : '—' }}
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <button type="button" class="admin-btn-secondary py-1 text-xs" @click="openEditCsa(csa)">
                      Edit
                    </button>
                    <button
                      type="button"
                      class="admin-btn-secondary py-1 text-xs"
                      @click="openAssignViews(csa)"
                    >
                      Views
                    </button>
                    <button
                      v-if="csa.status !== 'ACTIVE'"
                      type="button"
                      class="admin-btn-primary py-1 text-xs"
                      :disabled="acting"
                      @click="setCsaStatus(csa, 'ACTIVE')"
                    >
                      Enable
                    </button>
                    <button
                      v-if="csa.status === 'ACTIVE'"
                      type="button"
                      class="admin-btn-secondary py-1 text-xs"
                      :disabled="acting"
                      @click="setCsaStatus(csa, 'SUSPENDED')"
                    >
                      Suspend
                    </button>
                    <button
                      v-if="csa.status !== 'DISABLED'"
                      type="button"
                      class="admin-btn-danger py-1 text-xs"
                      :disabled="acting"
                      @click="setCsaStatus(csa, 'DISABLED')"
                    >
                      Disable
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!csas.length && !loadingCsas">
                <td colspan="7" class="py-10 text-center text-admin-muted">No CSA agents yet</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination">
          <span>{{ csasTotal }} total</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="csasPage <= 1"
              @click="loadCsas(csasPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="csasPage * 20 >= csasTotal"
              @click="loadCsas(csasPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Tickets -->
      <div v-show="tab === 'tickets'" class="space-y-4">
        <div v-if="myStats" class="admin-stats-grid">
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">My open</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ myStats.openTickets }}</p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Awaiting reply</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-amber-400">
              {{ notifStore.badge.myAwaitingReply }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Resolved</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-success">
              {{ myStats.resolvedTotal }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Rejected</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ myStats.rejectedTotal }}</p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Avg rating</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">
              {{ myStats.avgRating != null ? myStats.avgRating.toFixed(1) : '—' }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Resolved 30d</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ myStats.resolved30d }}</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <div class="flex gap-1 rounded-lg bg-admin-bg p-1">
            <button
              type="button"
              :class="[
                'rounded-md px-3 py-1.5 text-xs font-medium',
                ticketQueue === 'me' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
              ]"
              @click="ticketQueue = 'me'; loadTickets(1)"
            >
              My queue
            </button>
            <button
              type="button"
              :class="[
                'rounded-md px-3 py-1.5 text-xs font-medium',
                ticketQueue === 'unassigned' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
              ]"
              @click="ticketQueue = 'unassigned'; loadTickets(1)"
            >
              Unassigned
            </button>
            <button
              v-if="isSuperAdmin"
              type="button"
              :class="[
                'rounded-md px-3 py-1.5 text-xs font-medium',
                ticketQueue === 'all' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
              ]"
              @click="ticketQueue = 'all'; loadTickets(1)"
            >
              All
            </button>
          </div>
          <select v-model="ticketFilters.status" class="admin-input w-auto" @change="loadTickets(1)">
            <option value="">All status</option>
            <option value="OPEN">OPEN</option>
            <option value="AWAITING_REPLY">AWAITING_REPLY</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="PENDING_REVIEW">PENDING_REVIEW</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <select v-model="ticketFilters.priority" class="admin-input w-auto" @change="loadTickets(1)">
            <option value="">All priority</option>
            <option value="URGENT">URGENT</option>
            <option value="HIGH">HIGH</option>
            <option value="NORMAL">NORMAL</option>
            <option value="LOW">LOW</option>
          </select>
          <button type="button" class="admin-btn-primary" :disabled="loadingTickets" @click="loadTickets(1)">
            Refresh
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>User</th>
                <th>Priority</th>
                <th>Stage</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in tickets"
                :key="t.id"
                class="cursor-pointer hover:bg-admin-bg/50"
                @click="openTicket(t)"
              >
                <td>
                  <p class="font-medium">{{ t.publicId ?? t.id }}</p>
                  <p class="text-xs text-admin-muted">
                    {{ t.type }}{{ t.subType ? ' / ' + t.subType : '' }}
                  </p>
                  <p v-if="t.messages?.[0]?.content" class="mt-0.5 max-w-[240px] truncate text-xs text-admin-subtext">
                    {{ t.messages[0].content }}
                  </p>
                </td>
                <td class="text-sm">
                  <p>{{ t.user?.name || t.user?.username || '—' }}</p>
                  <p class="font-mono text-xs text-admin-muted">{{ t.user?.publicId ?? t.user?.id }}</p>
                </td>
                <td :class="['text-xs font-semibold', priorityClass(t.priority)]">{{ t.priority }}</td>
                <td>
                  <StatusBadge :status="stageTone(t.stage)" :label="stageLabel(t.stage)" />
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ format(new Date(t.updatedAt), 'dd MMM HH:mm') }}
                </td>
                <td>
                  <button
                    v-if="ticketQueue === 'unassigned' && t.stage === 'open'"
                    type="button"
                    class="admin-btn-primary py-1 text-xs"
                    @click="claimTicket(t, $event)"
                  >
                    Claim
                  </button>
                  <button v-else type="button" class="admin-btn-secondary py-1 text-xs" @click.stop="openTicket(t)">
                    Open
                  </button>
                </td>
              </tr>
              <tr v-if="!tickets.length && !loadingTickets">
                <td colspan="6" class="py-10 text-center text-admin-muted">No tickets in this queue</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination">
          <span>{{ ticketsTotal }} total</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="ticketsPage <= 1"
              @click="loadTickets(ticketsPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="ticketsPage * 20 >= ticketsTotal"
              @click="loadTickets(ticketsPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Reports -->
      <div v-show="tab === 'reports'" class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <select v-model="reportFilters.status" class="admin-input w-auto" @change="loadReports(1)">
            <option value="">All status</option>
            <option value="PENDING">PENDING</option>
            <option value="REVIEWED">REVIEWED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
          <select v-model="reportFilters.context" class="admin-input w-auto" @change="loadReports(1)">
            <option value="">All context</option>
            <option value="CHAT">CHAT</option>
            <option value="LIVE">LIVE</option>
          </select>
          <button type="button" class="admin-btn-primary" :disabled="loadingReports" @click="loadReports(1)">
            Refresh
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Reporter</th>
                <th>Reported</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in reports"
                :key="r.id"
                class="cursor-pointer hover:bg-admin-bg/50"
                @click="openReport(r)"
              >
                <td>
                  <p class="font-mono text-xs">{{ r.id.slice(0, 8) }}…</p>
                  <p class="text-xs text-admin-muted">{{ r.context ?? '—' }}</p>
                </td>
                <td class="text-sm">{{ r.reporter?.name || r.reporter?.username || '—' }}</td>
                <td class="text-sm">{{ r.reportedUser?.name || r.reportedUser?.username || '—' }}</td>
                <td class="text-xs">{{ r.reason ?? '—' }}</td>
                <td>
                  <StatusBadge
                    :status="r.status === 'PENDING' ? 'warn' : r.status === 'RESOLVED' ? 'active' : 'inactive'"
                    :label="r.status"
                  />
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ format(new Date(r.createdAt), 'dd MMM yyyy') }}
                </td>
              </tr>
              <tr v-if="!reports.length && !loadingReports">
                <td colspan="6" class="py-10 text-center text-admin-muted">No reports</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <AssignCsaViewsDialog
      :open="!!viewsCsa"
      :csa="viewsCsa"
      @close="viewsCsa = null"
    />

    <!-- Create / Edit CSA -->
    <BaseDialog
      :open="createCsaOpen || !!editCsa"
      :title="editCsa ? 'Edit CSA' : 'Add Customer Support Agent'"
      size="lg"
      @close="createCsaOpen = false; editCsa = null"
    >
      <template #body>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Name *</label>
            <input v-model="csaForm.name" class="admin-input" />
            <p v-if="csaFormErrors.name" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.name }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Username *</label>
            <input v-model="csaForm.username" class="admin-input font-mono" />
            <p v-if="csaFormErrors.username" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.username }}</p>
          </div>
          <div v-if="!editCsa">
            <label class="mb-1 block text-xs text-admin-subtext">Email *</label>
            <input v-model="csaForm.email" type="email" class="admin-input" />
            <p v-if="csaFormErrors.email" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.email }}</p>
          </div>
          <div v-if="!editCsa">
            <label class="mb-1 block text-xs text-admin-subtext">Password * (min 12)</label>
            <input v-model="csaForm.password" type="password" class="admin-input" />
            <p v-if="csaFormErrors.password" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.password }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Phone country code *</label>
            <input v-model="csaForm.phoneCountryCode" class="admin-input" placeholder="+91" />
            <p v-if="csaFormErrors.phoneCountryCode" class="mt-1 text-xs text-admin-danger">
              {{ csaFormErrors.phoneCountryCode }}
            </p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Phone *</label>
            <input v-model="csaForm.phone" class="admin-input" />
            <p v-if="csaFormErrors.phone" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.phone }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Gender</label>
            <select v-model="csaForm.gender" class="admin-input">
              <option value="">—</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Country * (routing)</label>
            <input v-model="csaForm.country" class="admin-input" placeholder="India" />
            <p v-if="csaFormErrors.country" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.country }}</p>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="createCsaOpen = false; editCsa = null">
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting"
          @click="editCsa ? submitEditCsa() : submitCreateCsa()"
        >
          {{ editCsa ? 'Save' : 'Create' }}
        </button>
      </template>
    </BaseDialog>

    <!-- Report detail -->
    <BaseDialog
      :open="!!selectedReport"
      title="Report review"
      size="lg"
      @close="selectedReport = null"
    >
      <template #body>
        <div v-if="selectedReport" class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs text-admin-subtext">Status</p>
              <p class="font-medium">{{ selectedReport.status }}</p>
            </div>
            <div>
              <p class="text-xs text-admin-subtext">Context / Reason</p>
              <p class="font-medium">{{ selectedReport.context ?? '—' }} · {{ selectedReport.reason ?? '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-admin-subtext">Reporter</p>
              <p>{{ selectedReport.reporter?.name || selectedReport.reporter?.username || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-admin-subtext">Reported user</p>
              <p>{{ selectedReport.reportedUser?.name || selectedReport.reportedUser?.username || '—' }}</p>
            </div>
          </div>
          <p v-if="selectedReport.details" class="rounded border border-admin-border bg-admin-bg/40 p-3">
            {{ selectedReport.details }}
          </p>
          <div v-if="selectedReport.liveSessionId" class="text-xs text-admin-muted">
            Live session: {{ selectedReport.liveSessionId }}
            <span v-if="selectedReport.hostUserId"> · Host: {{ selectedReport.hostUserId }}</span>
          </div>
          <div v-if="selectedReport.evidenceUrls?.length" class="flex flex-wrap gap-2">
            <a
              v-for="(url, i) in selectedReport.evidenceUrls"
              :key="i"
              :href="url"
              target="_blank"
              rel="noopener"
              class="text-xs text-admin-accent underline"
            >
              Evidence {{ i + 1 }}
            </a>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Resolution note</label>
            <textarea v-model="reportNote" rows="3" class="admin-input resize-none" />
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="selectedReport = null">Close</button>
        <button
          v-if="selectedReport?.status === 'PENDING' && (auth.isSuperAdmin || auth.isCustomerSupport)"
          type="button"
          class="admin-btn-secondary"
          :disabled="reportActing"
          @click="escalateReport"
        >
          Escalate to ticket
        </button>
        <button
          type="button"
          class="admin-btn-secondary"
          :disabled="reportActing"
          @click="reviewReport('DISMISSED')"
        >
          Dismiss
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="reportActing"
          @click="reviewReport('RESOLVED')"
        >
          Resolve
        </button>
      </template>
    </BaseDialog>
  </div>
</template>
