<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { format } from 'date-fns'
import { useAgencyAdminStore } from '@/stores/agencyAdmin'
import AgencyStatsCards from '@/components/agency/AgencyStatsCards.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import { COMMISSION_TIERS, type PendingApplication } from '@/types/agency'
import { formatPoints, formatUsd } from '@/utils/format'
import axios from 'axios'
import { showToast } from '@/utils/toast'

const router = useRouter()
const store = useAgencyAdminStore()

const activeTab = ref<'agencies' | 'pending'>('agencies')
const searchQuery = ref('')
const statusFilter = ref<'ACTIVE' | 'SUSPENDED' | ''>('')
const countryFilter = ref('')

const approveTarget = ref<PendingApplication | null>(null)
const rejectTarget = ref<PendingApplication | null>(null)
const recomputeMasterDialog = ref(false)
const commissionTier = ref('D')
const rejectAdminNote = ref('')
const rejectUserNote = ref('')
const acting = ref(false)
const recomputingMaster = ref(false)
const approveBarred = ref(false)
const unbarUserId = ref('')
const unbarring = ref(false)

function usdLabel(value: string | undefined, points: string) {
  if (value != null && value !== '') return formatUsd(Number(value))
  // Fallback if older API payload omitted USD (10_000 pts = $1)
  return formatUsd(Number(points) / 10_000)
}

async function loadAgencies(page = 0) {
  await store.fetchAgencies({
    skip: page * store.agenciesTake,
    take: store.agenciesTake,
    q: searchQuery.value.trim() || undefined,
    status: statusFilter.value || undefined,
    country: countryFilter.value.trim() || undefined,
  })
}

async function loadPending(page = 0) {
  await store.fetchPending({ skip: page * 20, take: 20 })
}

function openAgency(item: { agencyPublicId: string }) {
  router.push(`/admin/agency/${item.agencyPublicId}`)
}

async function handleApprove() {
  const target = approveTarget.value
  if (!target) return
  acting.value = true
  approveBarred.value = false
  try {
    const result = await store.approveApplication(target.applicantUserId, {
      applicationId: target.applicationId,
      commissionTier: commissionTier.value || undefined,
    })
    approveTarget.value = null
    router.push(`/admin/agency/${result.agencyPublicId}`)
  } catch (err) {
    const code = axios.isAxiosError(err)
      ? (err.response?.data as { code?: string } | undefined)?.code
      : undefined
    if (code === 'AGENCY_BARRED') {
      approveBarred.value = true
      unbarUserId.value = target.applicantUserId
    }
  } finally {
    acting.value = false
  }
}

async function handleUnbarFromApprove() {
  const userId = unbarUserId.value || approveTarget.value?.applicantUserId
  if (!userId || unbarring.value) return
  unbarring.value = true
  try {
    await store.unbarUser(userId)
    approveBarred.value = false
    showToast('Bar cleared — you can approve now', 'success')
  } catch {
    // toast from store
  } finally {
    unbarring.value = false
  }
}

async function handleUnbarBanned() {
  if (!store.lastBannedAgencyUserId || unbarring.value) return
  unbarring.value = true
  try {
    await store.unbarUser(store.lastBannedAgencyUserId)
  } finally {
    unbarring.value = false
  }
}

async function handleReject(payload: { reason?: string }) {
  if (!rejectTarget.value) return
  acting.value = true
  try {
    await store.rejectApplication(rejectTarget.value.applicantUserId, {
      adminNote: payload.reason ?? rejectAdminNote.value,
      userNote: rejectUserNote.value || undefined,
    })
    rejectTarget.value = null
    rejectAdminNote.value = ''
    rejectUserNote.value = ''
  } finally {
    acting.value = false
  }
}

async function handleRecomputeMaster() {
  if (recomputingMaster.value) return
  recomputingMaster.value = true
  try {
    await store.recomputeMaster()
    recomputeMasterDialog.value = false
  } catch {
    // toast from interceptor / leave dialog open for retry
  } finally {
    recomputingMaster.value = false
  }
}

const agenciesPage = ref(0)
const pendingPage = ref(0)

function prevAgenciesPage() {
  if (agenciesPage.value > 0) {
    agenciesPage.value -= 1
    loadAgencies(agenciesPage.value)
  }
}

function nextAgenciesPage() {
  if ((agenciesPage.value + 1) * store.agenciesTake < store.agenciesTotal) {
    agenciesPage.value += 1
    loadAgencies(agenciesPage.value)
  }
}

function prevPendingPage() {
  if (pendingPage.value > 0) {
    pendingPage.value -= 1
    loadPending(pendingPage.value)
  }
}

function nextPendingPage() {
  if ((pendingPage.value + 1) * 20 < store.pendingTotal) {
    pendingPage.value += 1
    loadPending(pendingPage.value)
  }
}

watch(activeTab, (tab) => {
  if (tab === 'pending' && !store.pending.length) loadPending()
})

onMounted(async () => {
  await Promise.all([store.fetchStats(), loadAgencies(), store.fetchPending()])
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Agency Management</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Overview, agency list, pending applications, and lifecycle actions
        </p>
      </div>
      <button
        type="button"
        class="admin-btn-secondary text-sm"
        :disabled="recomputingMaster"
        @click="recomputeMasterDialog = true"
      >
        Recompute all tiers
      </button>
    </div>

    <AgencyStatsCards :stats="store.stats" :loading="store.loadingStats" />

    <div
      v-if="store.lastBannedAgencyUserId"
      class="admin-card flex flex-col gap-3 border-admin-warn/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-sm font-medium text-admin-warn">Recently banned agency</p>
        <p class="mt-0.5 break-all font-mono text-xs text-admin-subtext">
          Owner {{ store.lastBannedAgencyUserId }}
        </p>
        <p class="mt-1 text-xs text-admin-muted">
          Agency row is gone. Unbar clears re-apply lock (does not recreate the agency).
        </p>
      </div>
      <button
        type="button"
        class="admin-btn-secondary shrink-0 text-sm"
        :disabled="unbarring"
        @click="handleUnbarBanned"
      >
        {{ unbarring ? 'Unbarring…' : 'Unbar owner' }}
      </button>
    </div>

    <div class="admin-card">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-admin-border pb-4">
        <div class="flex gap-1 rounded-lg bg-admin-bg p-1">
          <button
            type="button"
            :class="[
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'agencies'
                ? 'bg-admin-accent text-white'
                : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="activeTab = 'agencies'"
          >
            Agencies
          </button>
          <button
            type="button"
            :class="[
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'pending'
                ? 'bg-admin-accent text-white'
                : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="activeTab = 'pending'"
          >
            Pending Applications
            <span
              v-if="store.pendingTotal"
              class="ml-1.5 rounded-full bg-admin-warn/20 px-1.5 py-0.5 text-xs text-admin-warn"
            >
              {{ store.pendingTotal }}
            </span>
          </button>
        </div>
      </div>

      <!-- Agencies tab -->
      <div v-show="activeTab === 'agencies'">
        <div class="mb-4 flex flex-wrap gap-2">
          <input
            v-model="searchQuery"
            type="text"
            class="admin-input min-w-0 w-full flex-1 sm:min-w-[200px]"
            placeholder="Search public ID or name (e.g. 34216592)"
            @keydown.enter="agenciesPage = 0; loadAgencies()"
          />
          <select v-model="statusFilter" class="admin-input w-auto" @change="agenciesPage = 0; loadAgencies()">
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <input
            v-model="countryFilter"
            type="text"
            class="admin-input w-24"
            placeholder="Country"
            maxlength="8"
            @keydown.enter="agenciesPage = 0; loadAgencies()"
          />
          <button type="button" class="admin-btn-primary" :disabled="store.loadingList" @click="agenciesPage = 0; loadAgencies()">
            {{ store.loadingList ? 'Loading…' : 'Search' }}
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Agency</th>
                <th>Public ID</th>
                <th>Hosts</th>
                <th>Country</th>
                <th>Month earnings</th>
                <th>Tier</th>
                <th>Payroll</th>
                <th>Status</th>
                <th>Approved</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="agency in store.agencies" :key="agency.agencyUserId">
                <td>
                  <p class="font-medium">{{ agency.userName }}</p>
                  <p class="text-xs text-admin-subtext">Owner {{ agency.userPublicId }}</p>
                </td>
                <td class="font-mono text-sm">{{ agency.agencyPublicId }}</td>
                <td class="tabular-nums">{{ agency.totalHosts }}</td>
                <td>{{ agency.country ?? '—' }}</td>
                <td>
                  <p class="tabular-nums text-sm font-medium">
                    {{ usdLabel(agency.earningsThisMonthUsd, agency.earningsThisMonthPoints) }}
                  </p>
                  <p
                    class="text-xs text-admin-muted"
                    :title="`${formatPoints(Number(agency.earningsThisMonthPoints))} pts`"
                  >
                    {{ formatPoints(Number(agency.earningsThisMonthPoints)) }} pts
                  </p>
                </td>
                <td>
                  <span class="rounded bg-admin-accent/15 px-2 py-0.5 text-xs font-semibold text-admin-accent">
                    {{ agency.commissionTier }}
                  </span>
                </td>
                <td>
                  <div class="flex flex-col gap-1">
                    <span
                      :class="[
                        'inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium',
                        agency.payrollPrivilegeGranted
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-admin-muted/20 text-admin-subtext',
                      ]"
                    >
                      Privilege {{ agency.payrollPrivilegeGranted ? 'ON' : 'OFF' }}
                    </span>
                    <span
                      :class="[
                        'inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium',
                        agency.payrollEnabled
                          ? 'bg-admin-accent/15 text-admin-accent'
                          : 'bg-admin-muted/20 text-admin-subtext',
                      ]"
                    >
                      Accept {{ agency.payrollEnabled ? 'ON' : 'OFF' }}
                    </span>
                  </div>
                </td>
                <td>
                  <StatusBadge :status="agency.status === 'SUSPENDED' ? 'suspended' : 'active'" />
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ format(new Date(agency.approvedAt), 'dd MMM yyyy') }}
                </td>
                <td class="text-right">
                  <button type="button" class="admin-btn-secondary text-xs" @click="openAgency(agency)">
                    View
                  </button>
                </td>
              </tr>
              <tr v-if="!store.agencies.length && !store.loadingList">
                <td colspan="10" class="py-10 text-center text-admin-muted">No agencies found</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination mt-4">
          <span>{{ store.agenciesTotal }} total</span>
          <div class="flex gap-2">
            <button type="button" class="admin-btn-secondary text-xs" :disabled="agenciesPage === 0" @click="prevAgenciesPage">
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="(agenciesPage + 1) * store.agenciesTake >= store.agenciesTotal"
              @click="nextAgenciesPage"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Pending tab -->
      <div v-show="activeTab === 'pending'">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Country</th>
                <th>KYC</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="app in store.pending" :key="app.applicationId">
                <td>
                  <p class="font-medium">{{ app.applicantUserName }}</p>
                  <p class="font-mono text-xs text-admin-subtext">{{ app.userPublicId }}</p>
                </td>
                <td>{{ app.country ?? '—' }}</td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <span
                      :class="[
                        'rounded px-1.5 py-0.5 text-xs',
                        app.kyc.govtIdUploaded ? 'bg-admin-success/20 text-admin-success' : 'bg-admin-muted/20',
                      ]"
                    >
                      ID
                    </span>
                    <span
                      :class="[
                        'rounded px-1.5 py-0.5 text-xs',
                        app.kyc.contactPhone || app.kyc.contactEmail
                          ? 'bg-admin-success/20 text-admin-success'
                          : 'bg-admin-muted/20',
                      ]"
                    >
                      Contact
                    </span>
                    <span
                      :class="[
                        'rounded px-1.5 py-0.5 text-xs',
                        app.kyc.faceVerified ? 'bg-admin-success/20 text-admin-success' : 'bg-admin-muted/20',
                      ]"
                    >
                      Face
                    </span>
                  </div>
                </td>
                <td>
                  <StatusBadge :status="app.status.toLowerCase()" />
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ format(new Date(app.appliedAt), 'dd MMM yyyy') }}
                </td>
                <td>
                  <div class="flex gap-1">
                    <button type="button" class="admin-btn-primary text-xs" @click="approveTarget = app">
                      Approve
                    </button>
                    <button type="button" class="admin-btn-danger text-xs" @click="rejectTarget = app">
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!store.pending.length && !store.loadingPending">
                <td colspan="6" class="py-10 text-center text-admin-muted">No pending applications</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination mt-4">
          <span>{{ store.pendingTotal }} pending</span>
          <div class="flex gap-2">
            <button type="button" class="admin-btn-secondary text-xs" :disabled="pendingPage === 0" @click="prevPendingPage">
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="(pendingPage + 1) * 20 >= store.pendingTotal"
              @click="nextPendingPage"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <BaseDialog
      :open="!!approveTarget"
      title="Approve Application"
      @close="approveTarget = null; approveBarred = false"
    >
      <template #body>
        <div v-if="approveTarget" class="space-y-3">
          <p class="text-sm">
            Approve <strong>{{ approveTarget.applicantUserName }}</strong> as agency owner?
          </p>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Commission tier</label>
            <select v-model="commissionTier" class="admin-input">
              <option v-for="tier in COMMISSION_TIERS" :key="tier" :value="tier">{{ tier }}</option>
            </select>
          </div>
          <div
            v-if="approveBarred"
            class="rounded-md border border-admin-danger/40 bg-admin-danger/5 p-3 text-sm"
          >
            <p class="font-medium text-admin-danger">Agency barred</p>
            <p class="mt-1 text-xs text-admin-subtext">
              This user cannot be approved until the bar is cleared.
            </p>
            <button
              type="button"
              class="admin-btn-warn mt-3 w-full text-xs"
              :disabled="unbarring"
              @click="handleUnbarFromApprove"
            >
              {{ unbarring ? 'Unbarring…' : 'Unbar then retry approve' }}
            </button>
          </div>
        </div>
      </template>
      <template #footer>
        <button
          type="button"
          class="admin-btn-secondary"
          @click="approveTarget = null; approveBarred = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting || approveBarred"
          @click="handleApprove"
        >
          Approve
        </button>
      </template>
    </BaseDialog>

    <ConfirmActionDialog
      :open="!!rejectTarget"
      title="Reject Application"
      message="Reject this agency application. Optionally provide notes."
      confirm-label="Reject"
      variant="danger"
      :require-reason="true"
      @close="rejectTarget = null"
      @confirm="handleReject"
    />

    <ConfirmActionDialog
      :open="recomputeMasterDialog"
      title="Recompute all agency tiers"
      message="Queues a force recompute job for every agency on the worker (rolling window ending yesterday). Requires the worker process to be running."
      confirm-label="Queue recompute"
      variant="warn"
      @close="recomputeMasterDialog = false"
      @confirm="handleRecomputeMaster"
    />
  </div>
</template>
