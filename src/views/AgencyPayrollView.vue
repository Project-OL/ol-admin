<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { format } from 'date-fns'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import { useAgencyPayrollStore } from '@/stores/agencyPayroll'
import { formatPoints, formatUsd } from '@/utils/format'
import type { AdminPayrollAssignmentsQuery } from '@/types/agencyPayroll'

const store = useAgencyPayrollStore()
const router = useRouter()

const activeTab = ref<'assignments' | 'disputed' | 'pending'>('assignments')

const statusFilter = ref('')
const agencyUserId = ref('')
const hostUserId = ref('')
const withdrawalId = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const assignTargetId = ref<string | null>(null)
const assignAgencyUserId = ref('')
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

function assignmentQuery(): AdminPayrollAssignmentsQuery {
  return {
    status: statusFilter.value || undefined,
    agencyUserId: agencyUserId.value.trim() || undefined,
    hostUserId: hostUserId.value.trim() || undefined,
    withdrawalId: withdrawalId.value.trim() || undefined,
    from: dateFrom.value ? new Date(dateFrom.value).toISOString() : undefined,
    to: dateTo.value ? new Date(dateTo.value + 'T23:59:59').toISOString() : undefined,
  }
}

async function loadAssignments() {
  await store.fetchAssignments(assignmentQuery(), false)
}

function openAssignment(id: string) {
  router.push(`/admin/agency-payroll/${id}`)
}

async function handleAssign() {
  if (!assignTargetId.value || actingLocal.value) return
  actingLocal.value = true
  try {
    await store.assignWithdrawal(
      assignTargetId.value,
      assignAgencyUserId.value.trim() || undefined,
    )
    assignTargetId.value = null
    assignAgencyUserId.value = ''
    if (activeTab.value === 'pending') await store.fetchPendingPlatform()
    else await loadAssignments()
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

watch(activeTab, (tab) => {
  if (tab === 'assignments' && !store.assignments.length) void loadAssignments()
  if (tab === 'disputed' && !store.disputed.length) void store.fetchDisputed()
  if (tab === 'pending' && !store.pendingPlatform.length) void store.fetchPendingPlatform()
})

onMounted(() => loadAssignments())
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Agency Payroll</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Payroll assignments, disputed withdrawals, and pending platform queue
      </p>
    </div>

    <div class="admin-card">
      <div class="mb-4 flex flex-wrap gap-1 rounded-lg bg-admin-bg p-1">
        <button
          v-for="tab in [
            { id: 'assignments', label: 'Assignments' },
            { id: 'disputed', label: 'Disputed' },
            { id: 'pending', label: 'Pending platform' },
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
            v-model="agencyUserId"
            type="text"
            class="admin-input min-w-0 w-full sm:w-44"
            placeholder="Agency user UUID"
          />
          <input
            v-model="hostUserId"
            type="text"
            class="admin-input min-w-0 w-full sm:w-44"
            placeholder="Host user UUID"
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
                <th>Agent</th>
                <th>Host</th>
                <th>Assignment</th>
                <th>Withdrawal</th>
                <th>Gross</th>
                <th>Host payout</th>
                <th>Agent reward</th>
                <th>Assigned</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in store.assignments" :key="row.assignmentId">
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
                    · ₹{{ row.withdrawal.localCurrencyAmount }}
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
            @click="store.fetchAssignments(assignmentQuery(), true)"
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
                <th>Host</th>
                <th>Agent</th>
                <th>Gross</th>
                <th>Host payout</th>
                <th>Requested</th>
                <th>Ticket</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in store.disputed" :key="row.withdrawalId">
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
                  <RouterLink
                    :to="`/admin/users/${row.assignment.agentUserId}`"
                    class="font-medium text-admin-accent hover:underline"
                  >
                    {{ row.assignment.agentDisplayName }}
                  </RouterLink>
                  <p class="font-mono text-xs text-admin-subtext">
                    {{ row.assignment.agentPublicId }}
                  </p>
                </td>
                <td class="tabular-nums text-sm">{{ formatPts(row.grossPoints) }}</td>
                <td class="text-sm">
                  {{
                    row.hostPayoutUsd != null ? formatUsd(Number(row.hostPayoutUsd)) : '—'
                  }}
                  <span class="block text-xs text-admin-muted"
                    >₹{{ row.localCurrencyAmount }}</span
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
                      type="button"
                      class="admin-btn-secondary text-xs"
                      @click="openAssignment(row.assignment.id)"
                    >
                      Assignment
                    </button>
                    <button
                      type="button"
                      class="admin-btn-primary text-xs"
                      @click="favourAgentTargetId = row.withdrawalId"
                    >
                      Favour agent
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
                <td colspan="7" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!store.disputed.length">
                <td colspan="7" class="py-10 text-center text-admin-muted">No disputed payrolls</td>
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

      <!-- Pending platform -->
      <div v-show="activeTab === 'pending'">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Withdrawal</th>
                <th>Status</th>
                <th>Gross</th>
                <th>Assignments</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in store.pendingPlatform" :key="row.id">
                <td class="max-w-[140px] truncate font-mono text-xs" :title="row.id">
                  {{ row.id }}
                </td>
                <td><StatusBadge :status="row.status.toLowerCase()" /></td>
                <td class="tabular-nums text-sm">{{ formatPts(row.grossPoints) }}</td>
                <td class="tabular-nums text-sm">{{ row.assignmentCount }}</td>
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.requestedAt) }}</td>
                <td>
                  <button
                    type="button"
                    class="admin-btn-primary text-xs"
                    @click="assignTargetId = row.id"
                  >
                    Assign
                  </button>
                </td>
              </tr>
              <tr v-if="store.loadingPending && !store.pendingPlatform.length">
                <td colspan="6" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!store.pendingPlatform.length">
                <td colspan="6" class="py-10 text-center text-admin-muted">
                  No pending platform withdrawals
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="store.pendingHasMore" class="mt-4 flex justify-center">
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="store.loadingMorePending"
            @click="store.fetchPendingPlatform(true)"
          >
            {{ store.loadingMorePending ? 'Loading…' : 'Load more' }}
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
            Leave agency UUID empty to use automatic assignment.
          </p>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Agency user UUID (optional)</label>
            <input v-model="assignAgencyUserId" type="text" class="admin-input" />
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

    <ConfirmActionDialog
      :open="!!favourAgentTargetId"
      title="Resolve favour agent"
      message="Credit the agency agent and close the dispute."
      confirm-label="Favour agent"
      variant="warn"
      :require-reason="true"
      @close="favourAgentTargetId = null"
      @confirm="handleFavourAgent"
    />

    <ConfirmActionDialog
      :open="!!favourHostTargetId"
      title="Resolve favour host"
      message="Resolve dispute in favour of the host. Optionally set agency user for reassignment."
      confirm-label="Favour host"
      variant="danger"
      :require-reason="true"
      @close="favourHostTargetId = null; favourHostAgencyUserId = ''"
      @confirm="handleFavourHost"
    />
  </div>
</template>
