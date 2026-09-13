<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
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

const withdrawalId = computed(() => route.params.withdrawalId as string)
const detail = computed(() => store.withdrawalDetail)

const payOpen = ref(false)
const payFile = ref<File | null>(null)
const reverseOpen = ref(false)
const favourAgentOpen = ref(false)
const favourHostOpen = ref(false)
const actingLocal = ref(false)
const nowMs = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

const completeOpen = ref(false)
const completeAgencyQuery = ref('')
const completeAgencyResults = ref<AgencyListItem[]>([])
const completeAgencyUserId = ref('')
const completeFile = ref<File | null>(null)
const completeReason = ref('')

const editProofOpen = ref(false)
const editProofAgencyQuery = ref('')
const editProofAgencyResults = ref<AgencyListItem[]>([])
const editProofAgencyUserId = ref('')
const editProofFile = ref<File | null>(null)
const editProofReason = ref('')

const isPlatform = computed(
  () => detail.value?.payoutHandler === 'PLATFORM' || detail.value?.methodType === 'EPAY',
)
const canPay = computed(() => detail.value?.canPay === true)
const canReverse = computed(() => detail.value?.canRevert === true)
const canCompleteManually = computed(() => detail.value?.canCompletePayrollManually === true)
const isDisputed = computed(() => detail.value?.status === 'DISPUTED')
const isWaiting = computed(() => detail.value?.status === 'WAITING')

const waitingLabel = computed(() => {
  const expires = detail.value?.waitingExpiresAt
  if (!expires) return '—'
  const remaining = Math.max(0, Math.round((new Date(expires).getTime() - nowMs.value) / 1000))
  if (remaining <= 0) return 'Window elapsed'
  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  if (h > 0) return `${h}h ${m}m ${s}s left`
  if (m > 0) return `${m}m ${s}s left`
  return `${s}s left`
})

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
  if (!withdrawalId.value) return
  try {
    await store.fetchWithdrawalDetail(withdrawalId.value)
  } catch {
    store.withdrawalDetail = null
  }
}

function onPayFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  payFile.value = input.files?.[0] ?? null
}

async function handlePay() {
  if (!detail.value || !payFile.value || actingLocal.value) return
  actingLocal.value = true
  try {
    await store.completePlatformPayout(detail.value.id, payFile.value)
    payOpen.value = false
    payFile.value = null
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Failed to upload payout screenshot', 'error')
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
      detail.value.id,
      completeFile.value,
      { agencyUserId: completeAgencyUserId.value },
      completeReason.value,
    )
    resetCompleteForm()
    if (result?.assignmentId) {
      await router.push(`/admin/agency-payroll/${result.assignmentId}`)
    }
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Failed to mark payroll complete', 'error')
  } finally {
    actingLocal.value = false
  }
}

async function searchEditProofAgency() {
  const q = editProofAgencyQuery.value.trim()
  if (!q) {
    editProofAgencyResults.value = []
    return
  }
  try {
    const { data } = await agencyAdminApi.listAgencies({ q, take: 10, status: 'ACTIVE' })
    editProofAgencyResults.value = data.items
  } catch {
    editProofAgencyResults.value = []
  }
}

function pickEditProofAgency(hit: AgencyListItem) {
  editProofAgencyUserId.value = hit.agencyUserId
  editProofAgencyQuery.value = `${hit.userName} · #${hit.userPublicId}`
  editProofAgencyResults.value = []
}

function clearEditProofAgency() {
  editProofAgencyUserId.value = ''
  editProofAgencyQuery.value = ''
  editProofAgencyResults.value = []
}

function onEditProofFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  editProofFile.value = input.files?.[0] ?? null
}

function resetEditProofForm() {
  editProofOpen.value = false
  clearEditProofAgency()
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
      detail.value.id,
      editProofFile.value,
      editProofAgencyUserId.value ? { agencyUserId: editProofAgencyUserId.value } : {},
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
    await store.reverseWithdrawal(detail.value.id, payload.reason)
    reverseOpen.value = false
  } finally {
    actingLocal.value = false
  }
}

async function handleFavourAgent(payload: { reason?: string }) {
  if (!detail.value || !payload.reason) return
  actingLocal.value = true
  try {
    await store.resolveFavourAgent(detail.value.id, payload.reason)
    favourAgentOpen.value = false
  } finally {
    actingLocal.value = false
  }
}

async function handleFavourHost(payload: { reason?: string }) {
  if (!detail.value || !payload.reason) return
  actingLocal.value = true
  try {
    await store.resolveFavourHost(detail.value.id, payload.reason)
    favourHostOpen.value = false
  } finally {
    actingLocal.value = false
  }
}

onMounted(() => {
  void load()
  tick = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
})
watch(withdrawalId, () => load())
onUnmounted(() => {
  if (tick) clearInterval(tick)
  store.clearDetail()
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="admin-btn-secondary text-sm"
        @click="router.push('/admin/agency-payroll')"
      >
        ← Back
      </button>
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Platform withdrawal</h1>
        <p v-if="detail" class="mt-0.5 font-mono text-xs text-admin-subtext">
          {{ detail.id }}
        </p>
      </div>
    </div>

    <div v-if="store.loadingDetail && !detail" class="flex justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
    </div>

    <div v-else-if="!detail" class="admin-card py-12 text-center text-admin-muted">
      Withdrawal not found
    </div>

    <template v-else>
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
        <div class="ml-auto text-right">
          <StatusBadge :status="detail.status.toLowerCase()" />
          <p class="mt-1 text-xs text-admin-muted">
            {{ detail.methodType || '—' }}
            ·
            {{ isPlatform ? 'Platform payout' : 'Agency payroll' }}
          </p>
        </div>
      </div>

      <div class="admin-card grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p class="text-xs text-admin-subtext">Gross</p>
          <p class="mt-0.5 text-sm font-semibold tabular-nums">{{ formatPts(detail.grossPoints) }}</p>
        </div>
        <div>
          <p class="text-xs text-admin-subtext">Service fee</p>
          <p class="mt-0.5 text-sm font-semibold tabular-nums">
            {{ formatPts(detail.serviceFeePoints) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-admin-subtext">Host payout</p>
          <p class="mt-0.5 text-sm font-semibold tabular-nums">
            {{ formatPts(detail.hostPayoutPoints) }}
          </p>
          <p class="text-xs text-admin-muted">
            {{
              detail.hostPayoutUsd != null ? formatUsd(Number(detail.hostPayoutUsd)) : '—'
            }}
            ·
            {{ formatLocalMoney(detail.localCurrencyAmount, detail.localCurrencyCode) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-admin-subtext">Platform / agent share</p>
          <p class="mt-0.5 text-sm font-semibold tabular-nums">
            {{ formatPts(detail.platformFeePoints) }} / {{ formatPts(detail.agentRewardPoints) }}
          </p>
          <p v-if="isPlatform" class="text-xs text-admin-muted">No agency credit on EPAY</p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="admin-card space-y-2">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold">Payment proof</h2>
            <span v-if="isWaiting" class="text-xs text-admin-subtext">{{ waitingLabel }}</span>
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

        <div class="space-y-4">
          <div class="admin-card space-y-2">
            <h2 class="text-sm font-semibold">Timeline</h2>
            <div class="space-y-1.5 text-sm">
              <p>
                <span class="text-admin-subtext">Requested</span>
                · {{ formatDate(detail.requestedAt) }}
              </p>
              <p>
                <span class="text-admin-subtext">Waiting until</span>
                · {{ formatDate(detail.waitingExpiresAt) }}
                <span v-if="isWaiting" class="text-admin-muted"> ({{ waitingLabel }})</span>
              </p>
              <p>
                <span class="text-admin-subtext">Processed</span>
                · {{ formatDate(detail.processedAt) }}
              </p>
              <p v-if="detail.failReason" class="text-admin-warn">
                Reason: {{ detail.failReason }}
              </p>
            </div>
            <RouterLink
              v-if="detail.disputeTicketId"
              :to="`/admin/support/tickets/${detail.disputeTicketId}`"
              class="inline-block text-xs text-admin-accent hover:underline"
            >
              Dispute ticket
            </RouterLink>
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
              </template>
            </template>
            <p v-else class="text-sm text-admin-muted">No payment method</p>
          </div>

          <div class="admin-card flex flex-wrap gap-2">
            <button
              v-if="canPay"
              type="button"
              class="admin-btn-primary text-sm"
              @click="payOpen = true; payFile = null"
            >
              Pay
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
              Confirm paid
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

    <BaseDialog :open="payOpen" title="Pay EPAY withdrawal" @close="payOpen = false; payFile = null">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-admin-subtext">
            Upload a screenshot of the fiat payment. The withdrawal then enters the waiting window.
            No agency is credited.
          </p>
          <input type="file" accept="image/*" class="admin-input" @change="onPayFile" />
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="payOpen = false; payFile = null">
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
            Corrects a wrong or missing proof screenshot - works regardless of status. Leave the
            agency field empty to edit this withdrawal's own screenshot; pick an agency to edit
            that agency's specific assignment instead (agency is optional either way).
          </p>
          <div class="relative">
            <label class="mb-1 block text-xs text-admin-subtext">Agency (optional)</label>
            <input
              v-model="editProofAgencyQuery"
              type="text"
              class="admin-input w-full"
              placeholder="Leave empty for the withdrawal's own screenshot"
              @input="searchEditProofAgency"
            />
            <button
              v-if="editProofAgencyUserId"
              type="button"
              class="absolute right-2 top-8 text-xs text-admin-muted hover:text-admin-text"
              @click="clearEditProofAgency"
            >
              Clear
            </button>
            <div
              v-if="editProofAgencyResults.length"
              class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-admin-border bg-admin-surface shadow-lg"
            >
              <button
                v-for="hit in editProofAgencyResults"
                :key="hit.agencyUserId"
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-admin-bg"
                @click="pickEditProofAgency(hit)"
              >
                <span class="font-medium">{{ hit.userName }}</span>
                <span class="text-xs text-admin-muted">#{{ hit.userPublicId }} · {{ hit.country || '—' }}</span>
              </button>
            </div>
          </div>
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
      message="Refund the host the full gross. Requires a reason."
      confirm-label="Reverse"
      variant="danger"
      :require-reason="true"
      @close="reverseOpen = false"
      @confirm="handleReverse"
    />

    <ConfirmActionDialog
      :open="favourAgentOpen"
      title="Confirm payout"
      message="Mark this EPAY dispute as paid. No agency is credited."
      confirm-label="Confirm paid"
      variant="warn"
      :require-reason="true"
      @close="favourAgentOpen = false"
      @confirm="handleFavourAgent"
    />

    <ConfirmActionDialog
      :open="favourHostOpen"
      title="Resolve favour host"
      message="Refund the host the full gross. This EPAY row is not assigned to an agency."
      confirm-label="Favour host"
      variant="danger"
      :require-reason="true"
      @close="favourHostOpen = false"
      @confirm="handleFavourHost"
    />
  </div>
</template>
