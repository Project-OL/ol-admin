<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { format } from 'date-fns'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import { useAgencyPayrollStore } from '@/stores/agencyPayroll'
import { agencyAdminApi } from '@/api/agencyAdmin'
import type { AgencyListItem } from '@/types/agency'
import { formatLocalMoney, formatPoints, formatUsd } from '@/utils/format'
import { showToast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()
const store = useAgencyPayrollStore()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const assignmentId = computed(() => route.params.assignmentId as string)
const detail = computed(() => store.detail)

const reverseOpen = ref(false)
const assignOpen = ref(false)
const assignAgencyId = ref('')
const favourAgentOpen = ref(false)
const favourHostOpen = ref(false)
const favourHostAgencyUserId = ref('')
const actingLocal = ref(false)

const completeOpen = ref(false)
const completeAgencyQuery = ref('')
const completeAgencyResults = ref<AgencyListItem[]>([])
const completeAgencyUserId = ref('')
const completeFile = ref<File | null>(null)
const completeReason = ref('')

const editProofOpen = ref(false)
const editProofFile = ref<File | null>(null)
const editProofReason = ref('')

const canReverse = computed(() => detail.value?.withdrawal.canRevert === true)

// A withdrawal only sits PENDING while it has one open (PENDING/WAITING) assignment - assigning
// again would just hit 409 ALREADY_ASSIGNED. PENDING_PLATFORM is the only state with no open
// assignment (no eligible agency, or attempts exhausted), so it's the only state that can assign.
const canAssign = computed(() => detail.value?.withdrawal.status === 'PENDING_PLATFORM')

const canCompleteManually = computed(
  () => detail.value?.withdrawal.canCompletePayrollManually === true,
)

const isDisputed = computed(() => detail.value?.withdrawal.status === 'DISPUTED')

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

async function load() {
  if (!assignmentId.value) return
  try {
    await store.fetchDetail(assignmentId.value)
  } catch {
    store.clearDetail()
  }
}

async function handleAssign() {
  if (!detail.value || actingLocal.value) return
  const raw = assignAgencyId.value.trim().replace(/^#/, '')
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
    await store.assignWithdrawal(detail.value.withdrawal.withdrawalId, agency)
    assignOpen.value = false
    assignAgencyId.value = ''
  } catch (err) {
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
      if (body?.code === 'ALREADY_ASSIGNED') {
        showToast(body.message || 'Withdrawal already has an active assignment', 'error')
        await load()
        return
      }
      if (body?.message) {
        showToast(body.message, 'error')
        return
      }
    }
    showToast('Failed to assign withdrawal', 'error')
  } finally {
    actingLocal.value = false
  }
}

async function searchCompleteAgency() {
  const q = completeAgencyQuery.value.trim()
  if (!q) {
    completeAgencyResults.value = []
    return
  }
  try {
    const { data } = await agencyAdminApi.listAgencies({ q, take: 10, status: 'ACTIVE' })
    completeAgencyResults.value = data.items
  } catch {
    completeAgencyResults.value = []
  }
}

function pickCompleteAgency(hit: AgencyListItem) {
  completeAgencyUserId.value = hit.agencyUserId
  completeAgencyQuery.value = `${hit.userName} · #${hit.userPublicId}`
  completeAgencyResults.value = []
}

function clearCompleteAgency() {
  completeAgencyUserId.value = ''
  completeAgencyQuery.value = ''
  completeAgencyResults.value = []
}

function onCompleteFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  completeFile.value = input.files?.[0] ?? null
}

function resetCompleteForm() {
  completeOpen.value = false
  clearCompleteAgency()
  completeFile.value = null
  completeReason.value = ''
}

async function handleCompleteManually() {
  if (!detail.value || actingLocal.value) return
  if (!completeAgencyUserId.value) {
    showToast('Search and select an agency', 'error')
    return
  }
  if (!completeFile.value) {
    showToast('Attach a proof screenshot', 'error')
    return
  }
  actingLocal.value = true
  try {
    const result = await store.completePayrollManually(
      detail.value.withdrawal.withdrawalId,
      completeFile.value,
      { agencyUserId: completeAgencyUserId.value },
      completeReason.value,
    )
    resetCompleteForm()
    // Completing supersedes the currently-open assignment and creates a fresh one for the
    // chosen agency - if we were viewing the superseded one, follow to the new assignment.
    if (result?.assignmentId && result.assignmentId !== assignmentId.value) {
      await router.push(`/admin/agency-payroll/${result.assignmentId}`)
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data as { code?: string; message?: string } | undefined
      if (body?.code === 'PAYROLL_AGENCY_INELIGIBLE') {
        showToast(body.message || 'Agency is not eligible for payroll', 'error')
        return
      }
      if (body?.code === 'PAYROLL_SELF_ASSIGN_FORBIDDEN') {
        showToast(body.message || 'Cannot assign to the host or their own agency', 'error')
        return
      }
      if (body?.message) {
        showToast(body.message, 'error')
        return
      }
    }
    showToast('Failed to mark payroll complete', 'error')
  } finally {
    actingLocal.value = false
  }
}

function onEditProofFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  editProofFile.value = input.files?.[0] ?? null
}

function resetEditProofForm() {
  editProofOpen.value = false
  editProofFile.value = null
  editProofReason.value = ''
}

async function handleEditProof() {
  if (!detail.value || actingLocal.value) return
  if (!editProofFile.value) {
    showToast('Choose a screenshot', 'error')
    return
  }
  actingLocal.value = true
  try {
    await store.updatePayrollProof(
      detail.value.withdrawal.withdrawalId,
      editProofFile.value,
      { assignmentId: detail.value.assignmentId },
      editProofReason.value,
    )
    resetEditProofForm()
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Failed to update screenshot', 'error')
  } finally {
    actingLocal.value = false
  }
}

async function handleReverse(payload: { reason?: string }) {
  if (!detail.value || !payload.reason) return
  actingLocal.value = true
  try {
    await store.reverseWithdrawal(detail.value.withdrawal.withdrawalId, payload.reason)
    reverseOpen.value = false
  } finally {
    actingLocal.value = false
  }
}

async function handleFavourAgent(payload: { reason?: string }) {
  if (!detail.value || !payload.reason) return
  actingLocal.value = true
  try {
    await store.resolveFavourAgent(detail.value.withdrawal.withdrawalId, payload.reason)
    favourAgentOpen.value = false
  } finally {
    actingLocal.value = false
  }
}

async function handleFavourHost(payload: { reason?: string }) {
  if (!detail.value || !payload.reason) return
  actingLocal.value = true
  try {
    await store.resolveFavourHost(
      detail.value.withdrawal.withdrawalId,
      payload.reason,
      favourHostAgencyUserId.value.trim() || undefined,
    )
    favourHostOpen.value = false
    favourHostAgencyUserId.value = ''
  } finally {
    actingLocal.value = false
  }
}

onMounted(() => load())
watch(assignmentId, () => load())
onUnmounted(() => store.clearDetail())
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-center gap-3">
      <button type="button" class="admin-btn-secondary text-sm" @click="router.push('/admin/agency-payroll')">
        ← Back
      </button>
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Payroll assignment</h1>
        <p v-if="detail" class="mt-0.5 font-mono text-xs text-admin-subtext">
          {{ detail.assignmentId }}
        </p>
      </div>
    </div>

    <div v-if="store.loadingDetail && !detail" class="flex justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
    </div>

    <div v-else-if="!detail" class="admin-card py-12 text-center text-admin-muted">
      Assignment not found
    </div>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Agent -->
        <div class="admin-card flex gap-3">
          <img
            v-if="detail.agent.avatarUrl"
            :src="detail.agent.avatarUrl"
            alt=""
            class="h-12 w-12 rounded-full object-cover"
          />
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-wide text-admin-subtext">Agent</p>
            <RouterLink
              :to="`/admin/users/${detail.agent.userId}`"
              class="font-semibold text-admin-accent hover:underline"
            >
              {{ detail.agent.displayName }}
            </RouterLink>
            <p class="font-mono text-xs text-admin-subtext">
              {{ detail.agent.displayPublicId || detail.agent.publicId }}
            </p>
            <p class="text-xs text-admin-muted">{{ detail.agent.country || '—' }}</p>
          </div>
        </div>

        <!-- Host -->
        <div class="admin-card flex gap-3">
          <img
            v-if="detail.host.avatarUrl"
            :src="detail.host.avatarUrl"
            alt=""
            class="h-12 w-12 rounded-full object-cover"
          />
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-wide text-admin-subtext">Host</p>
            <RouterLink
              :to="`/admin/users/${detail.host.userId}`"
              class="font-semibold text-admin-accent hover:underline"
            >
              {{ detail.host.displayName }}
            </RouterLink>
            <p class="font-mono text-xs text-admin-subtext">
              {{ detail.host.displayPublicId || detail.host.publicId }}
            </p>
            <p class="text-xs text-admin-muted">{{ detail.host.country || '—' }}</p>
          </div>
        </div>
      </div>

      <!-- Money strip -->
      <div class="admin-card grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p class="text-xs text-admin-subtext">Gross</p>
          <p class="mt-0.5 text-sm font-semibold tabular-nums">
            {{ formatPts(detail.withdrawal.grossPoints) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-admin-subtext">Platform fee</p>
          <p class="mt-0.5 text-sm font-semibold tabular-nums">
            {{ formatPts(detail.withdrawal.platformFeePoints) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-admin-subtext">Host payout</p>
          <p class="mt-0.5 text-sm font-semibold tabular-nums">
            {{ formatPts(detail.withdrawal.hostPayoutPoints) }}
          </p>
          <p class="text-xs text-admin-muted">
            {{
              detail.withdrawal.hostPayoutUsd != null
                ? formatUsd(Number(detail.withdrawal.hostPayoutUsd))
                : '—'
            }}
            ·
            {{
              formatLocalMoney(
                detail.withdrawal.localCurrencyAmount,
                detail.withdrawal.localCurrencyCode,
              )
            }}
          </p>
        </div>
        <div>
          <p class="text-xs text-admin-subtext">
            {{ detail.withdrawal.payoutHandler === 'PLATFORM' ? 'Service fee' : 'Agent reward' }}
          </p>
          <p class="mt-0.5 text-sm font-semibold tabular-nums">
            {{
              formatPts(
                detail.withdrawal.payoutHandler === 'PLATFORM'
                  ? detail.withdrawal.serviceFeePoints
                  : detail.withdrawal.agentRewardPoints,
              )
            }}
          </p>
          <p
            v-if="detail.withdrawal.methodType"
            class="text-xs text-admin-muted"
          >
            {{ detail.withdrawal.methodType }}
            ·
            {{ detail.withdrawal.payoutHandler === 'PLATFORM' ? 'Platform payout' : 'Agency payroll' }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Proof -->
        <div class="admin-card space-y-2">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold">Payment proof</h2>
            <StatusBadge :status="detail.status.toLowerCase()" />
          </div>
          <div
            class="flex min-h-[200px] items-center justify-center overflow-hidden rounded-lg border border-admin-border bg-admin-bg"
          >
            <a
              v-if="detail.proofImageUrl"
              :href="detail.proofImageUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="block h-full w-full"
            >
              <img
                :src="detail.proofImageUrl"
                alt="Payment proof"
                class="max-h-80 w-full object-contain"
              />
            </a>
            <span v-else class="text-sm text-admin-muted">No proof uploaded</span>
          </div>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            @click="editProofOpen = true"
          >
            {{ detail.proofImageUrl ? 'Edit screenshot' : 'Add screenshot' }}
          </button>
        </div>

        <!-- Timeline + payment -->
        <div class="space-y-4">
          <div class="admin-card space-y-2">
            <h2 class="text-sm font-semibold">Timeline</h2>
            <div class="space-y-1.5 text-sm">
              <p>
                <span class="text-admin-subtext">Assigned</span>
                · {{ formatDate(detail.assignedAt) }} (#{{ detail.assignmentNumber }})
              </p>
              <p>
                <span class="text-admin-subtext">Expires</span>
                · {{ formatDate(detail.expiresAt) }}
              </p>
              <p>
                <span class="text-admin-subtext">Waiting until</span>
                · {{ formatDate(detail.waitingExpiresAt) }}
              </p>
              <p>
                <span class="text-admin-subtext">Completed</span>
                · {{ formatDate(detail.completedAt) }}
              </p>
              <p>
                <span class="text-admin-subtext">Rejected</span>
                · {{ formatDate(detail.rejectedAt) }}
              </p>
              <p v-if="detail.rejectionReason" class="text-admin-warn">
                Reason: {{ detail.rejectionReason }}
              </p>
            </div>
            <div class="border-t border-admin-border pt-2">
              <p class="text-xs text-admin-subtext">Withdrawal</p>
              <StatusBadge :status="detail.withdrawal.status.toLowerCase()" />
              <p class="mt-1 font-mono text-xs text-admin-muted">
                {{ detail.withdrawal.withdrawalId }}
              </p>
              <RouterLink
                v-if="detail.withdrawal.disputeTicketId"
                :to="`/admin/support/tickets/${detail.withdrawal.disputeTicketId}`"
                class="mt-1 inline-block text-xs text-admin-accent hover:underline"
              >
                Dispute ticket
              </RouterLink>
            </div>
          </div>

          <div class="admin-card space-y-2">
            <h2 class="text-sm font-semibold">Payment method</h2>
            <template v-if="detail.paymentMethod">
              <p class="text-sm font-medium">{{ detail.paymentMethod.methodType }}</p>
              <p v-if="detail.paymentMethod.methodType === 'EPAY'" class="text-sm">
                {{ detail.paymentMethod.epayEmail || '—' }}
              </p>
              <template v-else>
                <p class="text-sm">{{ detail.paymentMethod.holderName || '—' }}</p>
                <p class="text-xs text-admin-subtext">
                  {{ detail.paymentMethod.bankName || '—' }}
                  · {{ detail.paymentMethod.accountNumber || '—' }}
                </p>
                <p class="text-xs text-admin-muted">
                  IFSC {{ detail.paymentMethod.ifscCode || '—' }}
                  · UPI {{ detail.paymentMethod.upiId || '—' }}
                </p>
              </template>
            </template>
            <p v-else class="text-sm text-admin-muted">No payment method</p>
          </div>

          <div class="admin-card flex flex-wrap gap-2">
            <button
              v-if="canAssign"
              type="button"
              class="admin-btn-primary text-sm"
              @click="assignOpen = true"
            >
              Assign
            </button>
            <button
              v-if="canCompleteManually"
              type="button"
              class="admin-btn-secondary text-sm"
              @click="completeOpen = true"
            >
              Attach proof &amp; complete
            </button>
            <button
              v-if="canReverse"
              type="button"
              class="admin-btn-danger text-sm"
              @click="reverseOpen = true"
            >
              Reverse
            </button>
            <button
              v-if="isDisputed"
              type="button"
              class="admin-btn-primary text-sm"
              @click="favourAgentOpen = true"
            >
              {{
                detail.withdrawal.payoutHandler === 'PLATFORM' ? 'Confirm paid' : 'Favour agent'
              }}
            </button>
            <button
              v-if="isDisputed"
              type="button"
              class="admin-btn-danger text-sm"
              @click="favourHostOpen = true"
            >
              Favour host
            </button>
          </div>
        </div>
      </div>
    </template>

    <BaseDialog
      :open="assignOpen"
      title="Assign withdrawal"
      @close="assignOpen = false; assignAgencyId = ''"
    >
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-admin-subtext">
            Paste an agency UUID or public / display ID to assign to that agency (any country).
            Leave empty for automatic same-country assignment.
          </p>
          <input
            v-model="assignAgencyId"
            type="text"
            class="admin-input"
            placeholder="Agency UUID or public / display ID"
            @keydown.enter="handleAssign"
          />
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="assignOpen = false">Cancel</button>
        <button type="button" class="admin-btn-primary" :disabled="actingLocal" @click="handleAssign">
          Assign
        </button>
      </template>
    </BaseDialog>

    <BaseDialog
      :open="completeOpen"
      title="Attach proof & mark complete"
      @close="resetCompleteForm"
    >
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-admin-subtext">
            Use this when an agency actually paid the host but the SLA expired (or it got
            reassigned) before they could attach proof themselves. This supersedes whatever
            assignment currently holds this withdrawal and credits the agency picked below -
            same host review window as a normal agent completion.
          </p>
          <div class="relative">
            <label class="mb-1 block text-xs text-admin-subtext">Agency</label>
            <input
              v-model="completeAgencyQuery"
              type="text"
              class="admin-input w-full"
              placeholder="Search agency by name or public ID"
              @input="searchCompleteAgency"
            />
            <button
              v-if="completeAgencyUserId"
              type="button"
              class="absolute right-2 top-8 text-xs text-admin-muted hover:text-admin-text"
              @click="clearCompleteAgency"
            >
              Clear
            </button>
            <div
              v-if="completeAgencyResults.length"
              class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-admin-border bg-admin-surface shadow-lg"
            >
              <button
                v-for="hit in completeAgencyResults"
                :key="hit.agencyUserId"
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-admin-bg"
                @click="pickCompleteAgency(hit)"
              >
                <span class="font-medium">{{ hit.userName }}</span>
                <span class="text-xs text-admin-muted">#{{ hit.userPublicId }} · {{ hit.country || '—' }}</span>
                <span v-if="!hit.payrollEnabled || !hit.payrollPrivilegeGranted" class="text-xs text-admin-warn">
                  (payroll off)
                </span>
              </button>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Proof screenshot</label>
            <input type="file" accept="image/*" class="admin-input w-full" @change="onCompleteFile" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Reason (optional)</label>
            <textarea
              v-model="completeReason"
              rows="2"
              class="admin-input w-full"
              placeholder="e.g. Agency A paid via bank transfer, but was reassigned before attaching proof"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="resetCompleteForm">Cancel</button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="actingLocal"
          @click="handleCompleteManually"
        >
          {{ actingLocal ? 'Submitting…' : 'Mark complete' }}
        </button>
      </template>
    </BaseDialog>

    <BaseDialog
      :open="editProofOpen"
      title="Add or edit screenshot"
      @close="resetEditProofForm"
    >
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-admin-subtext">
            Replaces this assignment's proof screenshot - works regardless of status, so you can
            correct a wrong screenshot even after it's already Completed / the withdrawal is Paid.
            Does not change status or credits.
          </p>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Proof screenshot</label>
            <input type="file" accept="image/*" class="admin-input w-full" @change="onEditProofFile" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Reason (optional)</label>
            <textarea
              v-model="editProofReason"
              rows="2"
              class="admin-input w-full"
              placeholder="e.g. Agency uploaded the wrong screenshot"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="resetEditProofForm">Cancel</button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="actingLocal"
          @click="handleEditProof"
        >
          {{ actingLocal ? 'Uploading…' : 'Save screenshot' }}
        </button>
      </template>
    </BaseDialog>

    <ConfirmActionDialog
      :open="reverseOpen"
      title="Reverse withdrawal"
      message="Reverse this withdrawal. Requires a reason."
      confirm-label="Reverse"
      variant="danger"
      :require-reason="true"
      @close="reverseOpen = false"
      @confirm="handleReverse"
    />

    <ConfirmActionDialog
      :open="favourAgentOpen"
      title="Confirm payout"
      :message="
        detail?.withdrawal.payoutHandler === 'PLATFORM'
          ? 'Mark this EPAY dispute as paid. No agency is credited.'
          : 'Close the dispute in favour of the agency agent.'
      "
      confirm-label="Confirm paid"
      variant="warn"
      :require-reason="true"
      @close="favourAgentOpen = false"
      @confirm="handleFavourAgent"
    />

    <ConfirmActionDialog
      :open="favourHostOpen"
      title="Resolve favour host"
      :message="
        detail?.withdrawal.payoutHandler === 'PLATFORM'
          ? 'Refund the host the full gross. This EPAY row is not assigned to an agency.'
          : 'Close the dispute in favour of the host.'
      "
      confirm-label="Favour host"
      variant="danger"
      :require-reason="true"
      @close="favourHostOpen = false; favourHostAgencyUserId = ''"
      @confirm="handleFavourHost"
    />
  </div>
</template>
