<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import axios from 'axios'
import { format } from 'date-fns'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'
import { useAgencyPayrollStore } from '@/stores/agencyPayroll'
import { formatLocalMoney, formatPoints, formatUsd } from '@/utils/format'
import { showToast } from '@/utils/toast'
import type { AdminPayrollAssignmentsQuery } from '@/types/agencyPayroll'

const store = useAgencyPayrollStore()
const router = useRouter()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const activeTab = ref<'assignments' | 'disputed' | 'admin-pay' | 'assign-queue'>('assignments')

const statusFilter = ref('')
const agencyFilter = ref('')
const hostFilter = ref('')
const withdrawalId = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const assignTargetId = ref<string | null>(null)
const assignAgencyUserId = ref('')
const payTargetId = ref<string | null>(null)
const payFile = ref<File | null>(null)
const favourHostTargetId = ref<string | null>(null)
const favourHostAgencyUserId = ref('')
const favourAgentTargetId = ref<string | null>(null)
const actingLocal = ref(false)

const ASSIGNMENT_STATUSES = ['PENDING', 'WAITING', 'COMPLETED', 'REJECTED', 'EXPIRED'] as const

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm')
  } catch {
    return value
  }
}

function formatPts(value: string | null | undefined) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? formatPoints(n) : value
}

function parseIdFilter(
  raw: string,
  label: 'agency' | 'host',
):
  | { ok: true; userId?: string; publicId?: string }
  | { ok: false; message: string } {
  const q = raw.trim().replace(/^#/, '')
  if (!q) return { ok: true }
  if (UUID_RE.test(q)) return { ok: true, userId: q }
  if (/^\d+$/.test(q)) return { ok: true, publicId: q }
  return {
    ok: false,
    message:
      label === 'agency'
        ? 'Enter an agency UUID or numeric public / display ID'
        : 'Enter a host UUID or numeric public / display ID',
  }
}

function assignmentQuery(): AdminPayrollAssignmentsQuery | null {
  const agency = parseIdFilter(agencyFilter.value, 'agency')
  const host = parseIdFilter(hostFilter.value, 'host')
  if (!agency.ok) {
    showToast(agency.message, 'error')
    return null
  }
  if (!host.ok) {
    showToast(host.message, 'error')
    return null
  }
  return {
    status: statusFilter.value || undefined,
    agencyUserId: agency.userId,
    agencyPublicId: agency.publicId,
    hostUserId: host.userId,
    hostPublicId: host.publicId,
    withdrawalId: withdrawalId.value.trim() || undefined,
    from: dateFrom.value ? new Date(dateFrom.value).toISOString() : undefined,
    to: dateTo.value ? new Date(dateTo.value + 'T23:59:59').toISOString() : undefined,
  }
}

function toastPayrollError(err: unknown, fallback = 'Failed to load payroll assignments') {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { code?: string; message?: string } | undefined
    if (body?.code === 'AGENCY_NOT_FOUND') {
      showToast(body.message || 'Agency not found', 'error')
      return
    }
    if (body?.code === 'PAYROLL_AGENCY_INELIGIBLE') {
      showToast(body.message || 'Agency is not eligible for payroll', 'error')
      return
    }
    if (body?.code === 'PAYROLL_SELF_ASSIGN_FORBIDDEN') {
      showToast(body.message || 'Cannot assign to the host or their own agency', 'error')
      return
    }
    if (body?.code === 'COUNTRY_MISMATCH') {
      showToast(body.message || 'Agency country does not match the host', 'error')
      return
    }
    if (body?.code === 'USER_NOT_FOUND') {
      showToast(body.message || 'Host not found', 'error')
      return
    }
    if (body?.code === 'EPAY_PLATFORM_PAYOUT') {
      showToast(body.message || 'EPAY withdrawals are paid by the platform', 'error')
      return
    }
    if (body?.code === 'INVALID_REQUEST') {
      showToast(body.message || 'Invalid payroll request', 'error')
      return
    }
    if (body?.message) {
      showToast(body.message, 'error')
      return
    }
  }
  showToast(fallback, 'error')
}

async function loadAssignments() {
  const params = assignmentQuery()
  if (!params) return
  try {
    await store.fetchAssignments(params, false)
  } catch (err) {
    store.assignments = []
    toastPayrollError(err)
  }
}

async function loadMoreAssignments() {
  const params = assignmentQuery()
  if (!params) return
  try {
    await store.fetchAssignments(params, true)
  } catch (err) {
    toastPayrollError(err)
  }
}

function openAssignment(id: string) {
  router.push(`/admin/agency-payroll/${id}`)
}

function openWithdrawal(id: string) {
  router.push(`/admin/agency-payroll/w/${id}`)
}

function isPlatformPay(row: { methodType?: string | null; payoutHandler?: string | null }) {
  return row.payoutHandler === 'PLATFORM' || row.methodType === 'EPAY'
}

function onPayFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  payFile.value = input.files?.[0] ?? null
}

async function handlePay() {
  if (!payTargetId.value || !payFile.value || actingLocal.value) return
  actingLocal.value = true
  try {
    await store.completePlatformPayout(payTargetId.value, payFile.value)
    payTargetId.value = null
    payFile.value = null
  } catch (err) {
    toastPayrollError(err, 'Failed to upload payout screenshot')
  } finally {
    actingLocal.value = false
  }
}

async function handleAssign() {
  if (!assignTargetId.value || actingLocal.value) return
  const raw = assignAgencyUserId.value.trim().replace(/^#/, '')
  let agency: { agencyUserId?: string; agencyPublicId?: string } | undefined
  if (raw) {
    if (UUID_RE.test(raw)) agency = { agencyUserId: raw }
    else if (/^\d+$/.test(raw)) agency = { agencyPublicId: raw }
    else {
      showToast('Enter an agency UUID or numeric public / display ID', 'error')
      return
    }
  }
  actingLocal.value = true
  try {
    await store.assignWithdrawal(assignTargetId.value, agency)
    assignTargetId.value = null
    assignAgencyUserId.value = ''
    if (activeTab.value === 'assign-queue') await store.fetchPendingAssign()
    else await loadAssignments()
  } catch (err) {
    toastPayrollError(err, 'Failed to assign withdrawal')
  } finally {
    actingLocal.value = false
  }
}

async function handleFavourAgent(payload: { reason?: string }) {
  if (!favourAgentTargetId.value || !payload.reason) return
  actingLocal.value = true
  try {
    await store.resolveFavourAgent(favourAgentTargetId.value, payload.reason)
    favourAgentTargetId.value = null
  } finally {
    actingLocal.value = false
  }
}

async function handleFavourHost(payload: { reason?: string }) {
  if (!favourHostTargetId.value || !payload.reason) return
  actingLocal.value = true
  try {
    await store.resolveFavourHost(
      favourHostTargetId.value,
      payload.reason,
      favourHostAgencyUserId.value.trim() || undefined,
    )
    favourHostTargetId.value = null
    favourHostAgencyUserId.value = ''
  } finally {
    actingLocal.value = false
  }
}

const assignmentsRows = computed(() => store.assignments)
const {
  sortKey: assignmentsSortKey,
  sortDir: assignmentsSortDir,
  sortedRows: sortedAssignments,
  toggleSort: toggleAssignmentsSort,
} = useSortableRows(assignmentsRows, (row, key) => {
  switch (key) {
    case 'agent':
      return row.agent.displayName?.toLowerCase() ?? ''
    case 'host':
      return row.host.displayName?.toLowerCase() ?? ''
    case 'status':
      return row.status ?? ''
    case 'withdrawalStatus':
      return row.withdrawal.status ?? ''
    case 'grossPoints':
      return Number(row.withdrawal.grossPoints ?? 0)
    case 'hostPayoutPoints':
      return Number(row.withdrawal.hostPayoutPoints ?? 0)
    case 'agentRewardPoints':
      return Number(row.withdrawal.agentRewardPoints ?? 0)
    case 'assignedAt':
      return row.assignedAt ? new Date(row.assignedAt).getTime() : 0
    default:
      return undefined
  }
})

const disputedRows = computed(() => store.disputed)
const {
  sortKey: disputedSortKey,
  sortDir: disputedSortDir,
  sortedRows: sortedDisputed,
  toggleSort: toggleDisputedSort,
} = useSortableRows(disputedRows, (row, key) => {
  switch (key) {
    case 'host':
      return row.hostDisplayName?.toLowerCase() ?? ''
    case 'agent':
      return row.assignment?.agentDisplayName?.toLowerCase() ?? ''
    case 'methodType':
      return row.methodType ?? ''
    case 'grossPoints':
      return Number(row.grossPoints ?? 0)
    case 'hostPayoutUsd':
      return row.hostPayoutUsd != null ? Number(row.hostPayoutUsd) : -1
    case 'requestedAt':
      return row.requestedAt ? new Date(row.requestedAt).getTime() : 0
    default:
      return undefined
  }
})

const adminPayRows = computed(() => store.pendingAdminPay)
const {
  sortKey: adminPaySortKey,
  sortDir: adminPaySortDir,
  sortedRows: sortedAdminPay,
  toggleSort: toggleAdminPaySort,
} = useSortableRows(adminPayRows, (row, key) => {
  switch (key) {
    case 'id':
      return row.id ?? ''
    case 'methodType':
      return row.methodType ?? ''
    case 'status':
      return row.status ?? ''
    case 'grossPoints':
      return Number(row.grossPoints ?? 0)
    case 'hostPayoutUsd':
      return row.hostPayoutUsd != null ? Number(row.hostPayoutUsd) : -1
    case 'serviceFeePoints':
      return Number(row.serviceFeePoints ?? 0)
    case 'requestedAt':
      return row.requestedAt ? new Date(row.requestedAt).getTime() : 0
    default:
      return undefined
  }
})

const assignQueueRows = computed(() => store.pendingAssign)
const {
  sortKey: assignQueueSortKey,
  sortDir: assignQueueSortDir,
  sortedRows: sortedAssignQueue,
  toggleSort: toggleAssignQueueSort,
} = useSortableRows(assignQueueRows, (row, key) => {
  switch (key) {
    case 'id':
      return row.id ?? ''
    case 'methodType':
      return row.methodType ?? ''
    case 'status':
      return row.status ?? ''
    case 'grossPoints':
      return Number(row.grossPoints ?? 0)
    case 'hostPayoutUsd':
      return row.hostPayoutUsd != null ? Number(row.hostPayoutUsd) : -1
    case 'assignmentCount':
      return row.assignmentCount ?? 0
    case 'requestedAt':
      return row.requestedAt ? new Date(row.requestedAt).getTime() : 0
    default:
      return undefined
  }
})

watch(activeTab, (tab) => {
  if (tab === 'assignments' && !store.assignments.length) void loadAssignments()
  if (tab === 'disputed' && !store.disputed.length) void store.fetchDisputed()
  if (tab === 'admin-pay' && !store.pendingAdminPay.length) void store.fetchPendingAdminPay()
  if (tab === 'assign-queue' && !store.pendingAssign.length) void store.fetchPendingAssign()
})

onMounted(() => loadAssignments())
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Agency Payroll</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        BANK agency payroll, EPAY withdrawals for admin to pay, leftover BANK assign queue, and disputes.
        Filter agency or host by UUID, public ID, or display ID.
      </p>
    </div>

    <div class="admin-card">
      <div class="mb-4 flex flex-wrap gap-1 rounded-lg bg-admin-bg p-1">
        <button
          v-for="tab in [
            { id: 'assignments', label: 'Assignments' },
            { id: 'admin-pay', label: 'Admin to pay' },
            { id: 'assign-queue', label: 'Agency queue' },
            { id: 'disputed', label: 'Disputed' },
          ]"
          :key="tab.id"
          type="button"
          :class="[
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-admin-accent text-white'
              : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="activeTab = tab.id as typeof activeTab"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Assignments -->
      <div v-show="activeTab === 'assignments'">
        <div class="mb-4 flex flex-wrap gap-2">
          <select v-model="statusFilter" class="admin-input w-auto">
            <option value="">All statuses</option>
            <option v-for="s in ASSIGNMENT_STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
          <input
            v-model="agencyFilter"
            type="text"
            class="admin-input min-w-0 w-full sm:w-44"
            placeholder="Agency UUID or public / display ID"
            @keydown.enter="loadAssignments"
          />
          <input
            v-model="hostFilter"
            type="text"
            class="admin-input min-w-0 w-full sm:w-44"
            placeholder="Host UUID or public / display ID"
            @keydown.enter="loadAssignments"
          />
          <input
            v-model="withdrawalId"
            type="text"
            class="admin-input min-w-0 w-full sm:w-44"
            placeholder="Withdrawal UUID"
          />
          <input v-model="dateFrom" type="date" class="admin-input w-auto" />
          <input v-model="dateTo" type="date" class="admin-input w-auto" />
          <button
            type="button"
            class="admin-btn-primary"
            :disabled="store.loadingAssignments"
            @click="loadAssignments"
          >
            {{ store.loadingAssignments ? 'Loading…' : 'Search' }}
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Proof</th>
                <SortableTh label="Agent" sort-key="agent" :active-key="assignmentsSortKey" :direction="assignmentsSortDir" @sort="toggleAssignmentsSort" />
                <SortableTh label="Host" sort-key="host" :active-key="assignmentsSortKey" :direction="assignmentsSortDir" @sort="toggleAssignmentsSort" />
                <SortableTh label="Assignment" sort-key="status" :active-key="assignmentsSortKey" :direction="assignmentsSortDir" @sort="toggleAssignmentsSort" />
                <SortableTh label="Withdrawal" sort-key="withdrawalStatus" :active-key="assignmentsSortKey" :direction="assignmentsSortDir" @sort="toggleAssignmentsSort" />
                <SortableTh label="Gross" sort-key="grossPoints" :active-key="assignmentsSortKey" :direction="assignmentsSortDir" @sort="toggleAssignmentsSort" />
                <SortableTh label="Host payout" sort-key="hostPayoutPoints" :active-key="assignmentsSortKey" :direction="assignmentsSortDir" @sort="toggleAssignmentsSort" />
                <SortableTh label="Agent reward" sort-key="agentRewardPoints" :active-key="assignmentsSortKey" :direction="assignmentsSortDir" @sort="toggleAssignmentsSort" />
                <SortableTh label="Assigned" sort-key="assignedAt" :active-key="assignmentsSortKey" :direction="assignmentsSortDir" @sort="toggleAssignmentsSort" />
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedAssignments" :key="row.assignmentId">
                <td>
                  <img
                    v-if="row.proofImageUrl"
                    :src="row.proofImageUrl"
                    alt=""
                    class="h-10 w-10 rounded object-cover"
                  />
                  <div
                    v-else
                    class="flex h-10 w-10 items-center justify-center rounded bg-admin-muted/20 text-[10px] text-admin-muted"
                  >
                    —
                  </div>
                </td>
                <td>
                  <p class="font-medium">{{ row.agent.displayName }}</p>
                  <p class="font-mono text-xs text-admin-subtext">
                    {{ row.agent.displayPublicId || row.agent.publicId }}
                  </p>
                </td>
                <td>
                  <p class="font-medium">{{ row.host.displayName }}</p>
                  <p class="font-mono text-xs text-admin-subtext">
                    {{ row.host.displayPublicId || row.host.publicId }}
                  </p>
                </td>
                <td>
                  <StatusBadge :status="row.status.toLowerCase()" />
                  <p class="mt-0.5 text-xs text-admin-muted">#{{ row.assignmentNumber }}</p>
                </td>
                <td>
                  <StatusBadge :status="row.withdrawal.status.toLowerCase()" />
                </td>
                <td class="tabular-nums text-sm">{{ formatPts(row.withdrawal.grossPoints) }}</td>
                <td>
                  <p class="tabular-nums text-sm font-medium">
                    {{ formatPts(row.withdrawal.hostPayoutPoints) }}
                  </p>
                  <p class="text-xs text-admin-muted">
                    {{
                      row.withdrawal.hostPayoutUsd != null
                        ? formatUsd(Number(row.withdrawal.hostPayoutUsd))
                        : '—'
                    }}
                    ·
                    {{
                      formatLocalMoney(
                        row.withdrawal.localCurrencyAmount,
                        row.withdrawal.localCurrencyCode,
                      )
                    }}
                  </p>
                </td>
                <td class="tabular-nums text-sm">
                  {{ formatPts(row.withdrawal.agentRewardPoints) }}
                </td>
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.assignedAt) }}</td>
                <td class="text-right">
                  <button
                    type="button"
                    class="admin-btn-secondary text-xs"
                    @click="openAssignment(row.assignmentId)"
                  >
                    View
                  </button>
                </td>
              </tr>
              <tr v-if="store.loadingAssignments && !store.assignments.length">
                <td colspan="10" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!store.assignments.length">
                <td colspan="10" class="py-10 text-center text-admin-muted">No assignments</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="store.assignmentsHasMore" class="mt-4 flex justify-center">
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="store.loadingMoreAssignments"
            @click="loadMoreAssignments"
          >
            {{ store.loadingMoreAssignments ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </div>

      <!-- Disputed -->
      <div v-show="activeTab === 'disputed'">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Proof</th>
                <SortableTh label="Host" sort-key="host" :active-key="disputedSortKey" :direction="disputedSortDir" @sort="toggleDisputedSort" />
                <SortableTh label="Agent" sort-key="agent" :active-key="disputedSortKey" :direction="disputedSortDir" @sort="toggleDisputedSort" />
                <SortableTh label="Rail" sort-key="methodType" :active-key="disputedSortKey" :direction="disputedSortDir" @sort="toggleDisputedSort" />
                <SortableTh label="Gross" sort-key="grossPoints" :active-key="disputedSortKey" :direction="disputedSortDir" @sort="toggleDisputedSort" />
                <SortableTh label="Host payout" sort-key="hostPayoutUsd" :active-key="disputedSortKey" :direction="disputedSortDir" @sort="toggleDisputedSort" />
                <SortableTh label="Requested" sort-key="requestedAt" :active-key="disputedSortKey" :direction="disputedSortDir" @sort="toggleDisputedSort" />
                <th>Ticket</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedDisputed" :key="row.withdrawalId">
                <td>
                  <img
                    v-if="row.proofImageUrl"
                    :src="row.proofImageUrl"
                    alt=""
                    class="h-10 w-10 rounded object-cover"
                  />
                  <div
                    v-else
                    class="flex h-10 w-10 items-center justify-center rounded bg-admin-muted/20 text-[10px] text-admin-muted"
                  >
                    —
                  </div>
                </td>
                <td>
                  <RouterLink
                    :to="`/admin/users/${row.hostUserId}`"
                    class="font-medium text-admin-accent hover:underline"
                  >
                    {{ row.hostDisplayName }}
                  </RouterLink>
                  <p class="font-mono text-xs text-admin-subtext">{{ row.hostPublicId }}</p>
                </td>
                <td>
                  <template v-if="row.assignment">
                    <RouterLink
                      :to="`/admin/users/${row.assignment.agentUserId}`"
                      class="font-medium text-admin-accent hover:underline"
                    >
                      {{ row.assignment.agentDisplayName }}
                    </RouterLink>
                    <p class="font-mono text-xs text-admin-subtext">
                      {{ row.assignment.agentPublicId }}
                    </p>
                  </template>
                  <span v-else class="text-xs text-admin-muted">Platform (EPAY)</span>
                </td>
                <td class="text-xs font-medium">{{ row.methodType || '—' }}</td>
                <td class="tabular-nums text-sm">{{ formatPts(row.grossPoints) }}</td>
                <td class="text-sm">
                  {{
                    row.hostPayoutUsd != null ? formatUsd(Number(row.hostPayoutUsd)) : '—'
                  }}
                  <span class="block text-xs text-admin-muted"
                    >{{
                      formatLocalMoney(row.localCurrencyAmount, row.localCurrencyCode)
                    }}</span
                  >
                </td>
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.requestedAt) }}</td>
                <td>
                  <RouterLink
                    v-if="row.disputeTicketId"
                    :to="`/admin/support/tickets/${row.disputeTicketId}`"
                    class="font-mono text-xs text-admin-accent hover:underline"
                  >
                    {{ row.disputeTicketId.slice(0, 8) }}…
                  </RouterLink>
                  <span v-else class="text-admin-muted">—</span>
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <button
                      v-if="row.assignment"
                      type="button"
                      class="admin-btn-secondary text-xs"
                      @click="openAssignment(row.assignment.id)"
                    >
                      Assignment
                    </button>
                    <button
                      v-else
                      type="button"
                      class="admin-btn-secondary text-xs"
                      @click="openWithdrawal(row.withdrawalId)"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      class="admin-btn-primary text-xs"
                      @click="favourAgentTargetId = row.withdrawalId"
                    >
                      {{ isPlatformPay(row) ? 'Confirm paid' : 'Favour agent' }}
                    </button>
                    <button
                      type="button"
                      class="admin-btn-danger text-xs"
                      @click="favourHostTargetId = row.withdrawalId"
                    >
                      Favour host
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="store.loadingDisputed && !store.disputed.length">
                <td colspan="9" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!store.disputed.length">
                <td colspan="9" class="py-10 text-center text-admin-muted">No disputed payrolls</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="store.disputedHasMore" class="mt-4 flex justify-center">
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="store.loadingMoreDisputed"
            @click="store.fetchDisputed(true)"
          >
            {{ store.loadingMoreDisputed ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </div>

      <!-- Admin to pay (EPAY) -->
      <div v-show="activeTab === 'admin-pay'">
        <p class="mb-3 text-sm text-admin-subtext">
          EPAY withdrawals the platform must pay. Upload a screenshot to start the waiting window.
          No agency is assigned.
        </p>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Withdrawal" sort-key="id" :active-key="adminPaySortKey" :direction="adminPaySortDir" @sort="toggleAdminPaySort" />
                <SortableTh label="Rail" sort-key="methodType" :active-key="adminPaySortKey" :direction="adminPaySortDir" @sort="toggleAdminPaySort" />
                <SortableTh label="Status" sort-key="status" :active-key="adminPaySortKey" :direction="adminPaySortDir" @sort="toggleAdminPaySort" />
                <SortableTh label="Gross" sort-key="grossPoints" :active-key="adminPaySortKey" :direction="adminPaySortDir" @sort="toggleAdminPaySort" />
                <SortableTh label="Host payout" sort-key="hostPayoutUsd" :active-key="adminPaySortKey" :direction="adminPaySortDir" @sort="toggleAdminPaySort" />
                <SortableTh label="Service fee" sort-key="serviceFeePoints" :active-key="adminPaySortKey" :direction="adminPaySortDir" @sort="toggleAdminPaySort" />
                <SortableTh label="Requested" sort-key="requestedAt" :active-key="adminPaySortKey" :direction="adminPaySortDir" @sort="toggleAdminPaySort" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedAdminPay" :key="row.id">
                <td class="max-w-[140px] truncate font-mono text-xs" :title="row.id">
                  {{ row.id }}
                </td>
                <td class="text-xs font-medium">{{ row.methodType || 'EPAY' }}</td>
                <td><StatusBadge :status="row.status.toLowerCase()" /></td>
                <td class="tabular-nums text-sm">{{ formatPts(row.grossPoints) }}</td>
                <td class="text-sm">
                  {{
                    row.hostPayoutUsd != null ? formatUsd(Number(row.hostPayoutUsd)) : '—'
                  }}
                </td>
                <td class="tabular-nums text-sm">{{ formatPts(row.serviceFeePoints) }}</td>
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.requestedAt) }}</td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <button
                      type="button"
                      class="admin-btn-primary text-xs"
                      @click="payTargetId = row.id; payFile = null"
                    >
                      Pay
                    </button>
                    <button
                      type="button"
                      class="admin-btn-secondary text-xs"
                      @click="openWithdrawal(row.id)"
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="store.loadingAdminPay && !store.pendingAdminPay.length">
                <td colspan="8" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!store.pendingAdminPay.length">
                <td colspan="8" class="py-10 text-center text-admin-muted">
                  No EPAY withdrawals waiting for admin payout
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="store.pendingAdminPayHasMore" class="mt-4 flex justify-center">
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="store.loadingMoreAdminPay"
            @click="store.fetchPendingAdminPay(true)"
          >
            {{ store.loadingMoreAdminPay ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </div>

      <!-- Leftover BANK assign queue -->
      <div v-show="activeTab === 'assign-queue'">
        <p class="mb-3 text-sm text-admin-subtext">
          BANK withdrawals that could not be routed to an agency. Assign to an agent to continue payroll.
        </p>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Withdrawal" sort-key="id" :active-key="assignQueueSortKey" :direction="assignQueueSortDir" @sort="toggleAssignQueueSort" />
                <SortableTh label="Rail" sort-key="methodType" :active-key="assignQueueSortKey" :direction="assignQueueSortDir" @sort="toggleAssignQueueSort" />
                <SortableTh label="Status" sort-key="status" :active-key="assignQueueSortKey" :direction="assignQueueSortDir" @sort="toggleAssignQueueSort" />
                <SortableTh label="Gross" sort-key="grossPoints" :active-key="assignQueueSortKey" :direction="assignQueueSortDir" @sort="toggleAssignQueueSort" />
                <SortableTh label="Host payout" sort-key="hostPayoutUsd" :active-key="assignQueueSortKey" :direction="assignQueueSortDir" @sort="toggleAssignQueueSort" />
                <SortableTh label="Assignments" sort-key="assignmentCount" :active-key="assignQueueSortKey" :direction="assignQueueSortDir" @sort="toggleAssignQueueSort" />
                <SortableTh label="Requested" sort-key="requestedAt" :active-key="assignQueueSortKey" :direction="assignQueueSortDir" @sort="toggleAssignQueueSort" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedAssignQueue" :key="row.id">
                <td class="max-w-[140px] truncate font-mono text-xs" :title="row.id">
                  {{ row.id }}
                </td>
                <td class="text-xs font-medium">{{ row.methodType || 'BANK' }}</td>
                <td><StatusBadge :status="row.status.toLowerCase()" /></td>
                <td class="tabular-nums text-sm">{{ formatPts(row.grossPoints) }}</td>
                <td class="text-sm">
                  {{
                    row.hostPayoutUsd != null ? formatUsd(Number(row.hostPayoutUsd)) : '—'
                  }}
                </td>
                <td class="tabular-nums text-sm">{{ row.assignmentCount }}</td>
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.requestedAt) }}</td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <button
                      type="button"
                      class="admin-btn-primary text-xs"
                      @click="assignTargetId = row.id"
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      class="admin-btn-secondary text-xs"
                      @click="openWithdrawal(row.id)"
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="store.loadingAssignQueue && !store.pendingAssign.length">
                <td colspan="8" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!store.pendingAssign.length">
                <td colspan="8" class="py-10 text-center text-admin-muted">
                  No leftover BANK withdrawals to assign
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="store.pendingAssignHasMore" class="mt-4 flex justify-center">
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="store.loadingMoreAssignQueue"
            @click="store.fetchPendingAssign(true)"
          >
            {{ store.loadingMoreAssignQueue ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </div>
    </div>

    <BaseDialog
      :open="!!assignTargetId"
      title="Assign withdrawal"
      @close="assignTargetId = null; assignAgencyUserId = ''"
    >
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-admin-subtext">
            Paste an agency UUID or public / display ID to assign to that agency (any country).
            Leave empty for automatic same-country assignment.
          </p>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Agency UUID or public / display ID</label>
            <input
              v-model="assignAgencyUserId"
              type="text"
              class="admin-input"
              placeholder="Agency UUID or public / display ID"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <button
          type="button"
          class="admin-btn-secondary"
          @click="assignTargetId = null; assignAgencyUserId = ''"
        >
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="actingLocal"
          @click="handleAssign"
        >
          Assign
        </button>
      </template>
    </BaseDialog>

    <BaseDialog
      :open="!!payTargetId"
      title="Pay EPAY withdrawal"
      @close="payTargetId = null; payFile = null"
    >
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-admin-subtext">
            Upload a screenshot of the fiat payment. The withdrawal then enters the waiting window.
            No agency is credited.
          </p>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Payment screenshot</label>
            <input
              type="file"
              accept="image/*"
              class="admin-input"
              @change="onPayFile"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <button
          type="button"
          class="admin-btn-secondary"
          @click="payTargetId = null; payFile = null"
        >
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="actingLocal || !payFile"
          @click="handlePay"
        >
          {{ actingLocal ? 'Uploading…' : 'Mark paid' }}
        </button>
      </template>
    </BaseDialog>

    <ConfirmActionDialog
      :open="!!favourAgentTargetId"
      title="Confirm payout"
      message="Close the dispute as paid. EPAY rows credit no agency; BANK rows credit the agent."
      confirm-label="Confirm paid"
      variant="warn"
      :require-reason="true"
      @close="favourAgentTargetId = null"
      @confirm="handleFavourAgent"
    />

    <ConfirmActionDialog
      :open="!!favourHostTargetId"
      title="Resolve favour host"
      message="Refund the host. EPAY is not reassigned to an agency. BANK may be reassigned."
      confirm-label="Favour host"
      variant="danger"
      :require-reason="true"
      @close="favourHostTargetId = null; favourHostAgencyUserId = ''"
      @confirm="handleFavourHost"
    />
  </div>
</template>
