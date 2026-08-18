<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { format } from 'date-fns'
import axios from 'axios'
import { useAgencyAdminStore } from '@/stores/agencyAdmin'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import AgencyHostEarningsPanel from '@/components/agency/AgencyHostEarningsPanel.vue'
import AgencyCommissionHistoryPanel from '@/components/agency/AgencyCommissionHistoryPanel.vue'
import { COMMISSION_TIERS, type AgencyRecomputeLevelResponse } from '@/types/agency'
import { formatPoints, formatUsd } from '@/utils/format'
import { showToast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()
const store = useAgencyAdminStore()

const identifier = computed(() => route.params.id as string)
const agency = computed(() => store.detail)

type DetailTab = 'overview' | 'hosts' | 'commission'
const activeTab = ref<DetailTab>('overview')
const commissionHostPublicId = ref<string | undefined>()
const commissionPanel = ref<{ setHostFilter: (id: string) => void } | null>(null)

const tierDialog = ref(false)
const messageDialog = ref(false)
const addHostDialog = ref(false)
const transferDialog = ref(false)
const suspendDialog = ref(false)
const deleteDialog = ref(false)
const banDialog = ref(false)
const payrollOffDialog = ref(false)
const recomputeResult = ref<AgencyRecomputeLevelResponse | null>(null)

const newTier = ref('D')
const messageText = ref('')
const hostUserId = ref('')
const targetAgencyId = ref('')
const transferHostIds = ref('')
const suspendDays = ref(7)
const suspendUntil = ref('')
const useSuspendUntil = ref(false)
const acting = ref(false)
const recomputing = ref(false)
const togglingPayroll = ref(false)

function usdLabel(usd: string | undefined, points: string) {
  if (usd != null && usd !== '') return formatUsd(Number(usd))
  return formatUsd(Number(points) / 10_000)
}

function parseTab(raw: unknown): DetailTab | null {
  if (raw === 'overview' || raw === 'hosts' || raw === 'commission') return raw
  return null
}

onMounted(async () => {
  const tab = parseTab(route.query.tab)
  if (tab) activeTab.value = tab
  if (typeof route.query.hostPublicId === 'string') {
    commissionHostPublicId.value = route.query.hostPublicId
    activeTab.value = 'commission'
  }
  await store.fetchDetail(identifier.value)
  if (agency.value) newTier.value = agency.value.commissionTier
})

watch(identifier, async (id) => {
  commissionHostPublicId.value = undefined
  await store.fetchDetail(id)
  if (agency.value) newTier.value = agency.value.commissionTier
})

function setTab(tab: DetailTab) {
  activeTab.value = tab
  router.replace({
    query: {
      ...route.query,
      tab: tab === 'overview' ? undefined : tab,
      hostPublicId: tab === 'commission' ? route.query.hostPublicId : undefined,
    },
  })
}

function openHostCommission(host: { hostPublicId: string; displayName: string }) {
  commissionHostPublicId.value = host.hostPublicId
  activeTab.value = 'commission'
  router.replace({
    query: { ...route.query, tab: 'commission', hostPublicId: host.hostPublicId },
  })
  // Panel may already be mounted from a previous visit
  queueMicrotask(() => commissionPanel.value?.setHostFilter(host.hostPublicId))
}

async function reload() {
  await store.fetchDetail(identifier.value)
  if (agency.value) newTier.value = agency.value.commissionTier
}

async function saveTier() {
  acting.value = true
  try {
    await store.updateCommissionTier(identifier.value, newTier.value)
    tierDialog.value = false
  } finally {
    acting.value = false
  }
}

async function sendMessage() {
  if (!messageText.value.trim() || !agency.value) return
  acting.value = true
  try {
    await store.sendSystemMessageToOwner(agency.value.agencyUserId, messageText.value.trim())
    messageDialog.value = false
    messageText.value = ''
  } finally {
    acting.value = false
  }
}

async function addHost() {
  if (!hostUserId.value.trim()) return
  acting.value = true
  try {
    await store.addHost(identifier.value, hostUserId.value.trim())
    addHostDialog.value = false
    hostUserId.value = ''
  } finally {
    acting.value = false
  }
}

async function transferHosts() {
  const ids = transferHostIds.value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
  if (!targetAgencyId.value.trim() || !ids.length) return
  acting.value = true
  try {
    await store.transferHosts(identifier.value, targetAgencyId.value.trim(), ids)
    transferDialog.value = false
    targetAgencyId.value = ''
    transferHostIds.value = ''
  } finally {
    acting.value = false
  }
}

async function suspend() {
  acting.value = true
  try {
    if (useSuspendUntil.value && suspendUntil.value) {
      await store.suspendAgency(identifier.value, {
        pausedUntil: new Date(suspendUntil.value).toISOString(),
      })
    } else {
      await store.suspendAgency(identifier.value, { suspendDays: suspendDays.value })
    }
    suspendDialog.value = false
  } finally {
    acting.value = false
  }
}

async function unpause() {
  if (!agency.value) return
  acting.value = true
  try {
    await store.unpauseAgency(agency.value.agencyUserId, identifier.value)
  } finally {
    acting.value = false
  }
}

async function deleteAgency() {
  acting.value = true
  try {
    await store.deleteAgency(identifier.value)
    deleteDialog.value = false
    router.push('/admin/agency')
  } finally {
    acting.value = false
  }
}

async function banAgency(payload: { reason?: string }) {
  acting.value = true
  try {
    await store.banAgency(identifier.value, { reason: payload.reason || undefined })
    banDialog.value = false
    router.push('/admin/agency')
  } finally {
    acting.value = false
  }
}

async function togglePayrollPrivilege() {
  if (!agency.value || togglingPayroll.value) return
  if (agency.value.payrollPrivilegeGranted) {
    payrollOffDialog.value = true
    return
  }
  togglingPayroll.value = true
  try {
    await store.setPayrollPrivilege(identifier.value, true)
  } finally {
    togglingPayroll.value = false
  }
}

async function confirmPayrollPrivilegeRevoke() {
  togglingPayroll.value = true
  try {
    await store.setPayrollPrivilege(identifier.value, false)
    payrollOffDialog.value = false
  } finally {
    togglingPayroll.value = false
  }
}

async function recomputeTier() {
  if (recomputing.value) return
  recomputing.value = true
  try {
    const data = await store.recomputeLevel(identifier.value)
    recomputeResult.value = data
  } catch (err) {
    const msg = axios.isAxiosError(err)
      ? (err.response?.data as { message?: string } | undefined)?.message
      : undefined
    showToast(msg || 'Failed to recompute tier', 'error')
  } finally {
    recomputing.value = false
  }
}
</script>

<template>
  <div class="admin-page max-w-[1200px]">
    <button type="button" class="admin-btn-secondary mb-4 text-xs" @click="router.push('/admin/agency')">
      ← Back to agencies
    </button>

    <div v-if="store.loadingDetail && !agency" class="flex min-h-[40vh] items-center justify-center">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
    </div>

    <template v-else-if="agency">
      <!-- Header -->
      <div class="admin-card mb-4 sm:mb-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold sm:text-2xl">{{ agency.userName }}</h1>
              <StatusBadge :status="agency.status === 'SUSPENDED' ? 'suspended' : 'active'" />
              <span class="rounded bg-admin-accent/15 px-2 py-0.5 text-sm font-semibold text-admin-accent">
                Tier {{ agency.commissionTier }}
              </span>
              <span
                :class="[
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  agency.payrollPrivilegeGranted
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-admin-muted/20 text-admin-subtext',
                ]"
              >
                Privilege {{ agency.payrollPrivilegeGranted ? 'ON' : 'OFF' }}
              </span>
              <span
                :class="[
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  agency.payrollEnabled
                    ? 'bg-admin-accent/15 text-admin-accent'
                    : 'bg-admin-muted/20 text-admin-subtext',
                ]"
              >
                Accept {{ agency.payrollEnabled ? 'ON' : 'OFF' }}
              </span>
            </div>
            <p class="mt-1 break-all font-mono text-xs text-admin-subtext sm:text-sm">
              Agency ID {{ agency.agencyPublicId }} · Owner {{ agency.userPublicId }}
            </p>
            <p v-if="agency.pausedUntil" class="mt-1 text-sm text-admin-warn">
              Suspended until {{ format(new Date(agency.pausedUntil), 'dd MMM yyyy HH:mm') }}
            </p>
            <p
              v-if="agency.tierLockLevel && agency.tierLockUntil"
              class="mt-1 text-sm text-admin-subtext"
            >
              Base tier {{ agency.tierLockLevel }} locked until
              {{ format(new Date(agency.tierLockUntil), 'dd MMM yyyy HH:mm') }}
              <span v-if="agency.effectiveWindowTotalPoints" class="text-admin-muted">
                · effective {{ formatPoints(Number(agency.effectiveWindowTotalPoints)) }} pts
              </span>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="admin-btn-secondary text-xs" @click="reload">Refresh</button>
            <button
              type="button"
              class="admin-btn-primary text-xs"
              :disabled="recomputing"
              @click="recomputeTier"
            >
              {{ recomputing ? 'Recomputing…' : 'Recompute tier' }}
            </button>
            <button
              v-if="agency.status === 'SUSPENDED'"
              type="button"
              class="admin-btn-primary text-xs"
              :disabled="acting"
              @click="unpause"
            >
              Reactivate
            </button>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-md bg-admin-bg/60 p-3">
            <p class="text-xs text-admin-subtext">Total Hosts</p>
            <p class="text-xl font-semibold tabular-nums">{{ agency.totalHosts }}</p>
          </div>
          <div class="rounded-md bg-admin-bg/60 p-3">
            <p class="text-xs text-admin-subtext">Earning Hosts</p>
            <p class="text-xl font-semibold tabular-nums">{{ agency.totalEarningHosts }}</p>
          </div>
          <div class="rounded-md bg-admin-bg/60 p-3">
            <p class="text-xs text-admin-subtext">Lifetime Earnings</p>
            <p class="text-lg font-semibold tabular-nums">
              {{ usdLabel(agency.totalEarningsUsd, agency.totalEarningsPoints) }}
            </p>
            <p class="mt-0.5 text-[10px] text-admin-muted">
              {{ formatPoints(Number(agency.totalEarningsPoints)) }} pts
            </p>
          </div>
          <div class="rounded-md bg-admin-bg/60 p-3">
            <p class="text-xs text-admin-subtext">This Month (UTC)</p>
            <p class="text-lg font-semibold tabular-nums">
              {{ usdLabel(agency.thisMonthEarningsUsd, agency.thisMonthEarningsPoints) }}
            </p>
            <p class="mt-0.5 text-[10px] text-admin-muted">
              {{ formatPoints(Number(agency.thisMonthEarningsPoints)) }} pts · calendar ≠ tier window
            </p>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div
        class="-mx-3 mb-4 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0"
        style="-webkit-overflow-scrolling: touch"
      >
        <div class="inline-flex min-w-full gap-1 rounded-lg border border-admin-border bg-admin-surface p-1 sm:flex sm:min-w-0">
          <button
            v-for="tab in [
              { id: 'overview' as const, label: 'Overview' },
              { id: 'hosts' as const, label: 'Hosts & earnings' },
              { id: 'commission' as const, label: 'Commission log' },
            ]"
            :key="tab.id"
            type="button"
            :class="[
              'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-admin-accent/15 text-admin-accent'
                : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="setTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div v-show="activeTab === 'overview'" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Contact & KYC -->
        <div class="admin-card space-y-4">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">Contact & KYC</h2>
          <div class="space-y-1 text-sm">
            <div class="admin-kv-row">
              <span class="admin-kv-label">Phone</span>
              <span class="admin-kv-value">{{ agency.contactPhone ?? '—' }}</span>
            </div>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Email</span>
              <span class="admin-kv-value break-all">{{ agency.contactEmail ?? '—' }}</span>
            </div>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Country</span>
              <span class="admin-kv-value">{{ agency.country ?? '—' }}</span>
            </div>
            <div class="admin-kv-row">
              <span class="admin-kv-label">KYC Verified</span>
              <div class="admin-kv-value sm:flex sm:justify-end">
                <StatusBadge :status="agency.kycVerified ? 'verified' : 'none'" />
              </div>
            </div>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Face Verified</span>
              <div class="admin-kv-value sm:flex sm:justify-end">
                <StatusBadge :status="agency.faceVerified ? 'verified' : 'none'" />
              </div>
            </div>
            <div class="admin-kv-row border-0">
              <span class="admin-kv-label">Approved</span>
              <span class="admin-kv-value text-xs">{{ format(new Date(agency.approvedAt), 'dd MMM yyyy') }}</span>
            </div>
          </div>
          <a
            v-if="agency.kycDocuments.govtIdUrl"
            :href="agency.kycDocuments.govtIdUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="admin-btn-secondary inline-flex text-xs"
          >
            View Govt ID Document
          </a>
        </div>

        <!-- Actions -->
        <div class="admin-card space-y-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">Agency Actions</h2>

          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium">Payroll privilege</p>
                <p class="mt-0.5 text-xs text-admin-muted">
                  Admin grant only. Agent accept-toggle needs privilege; assignments need both.
                </p>
                <p class="mt-1 text-xs text-admin-subtext">
                  Privilege:
                  <span class="font-medium">{{ agency.payrollPrivilegeGranted ? 'granted' : 'revoked' }}</span>
                  · Accept:
                  <span class="font-medium">{{ agency.payrollEnabled ? 'on' : 'off' }}</span>
                  <template v-if="!agency.payrollPrivilegeGranted">
                    (accept forced off; agent gets 403 if they try to enable)
                  </template>
                </p>
              </div>
              <button
                type="button"
                class="admin-btn-secondary shrink-0 text-xs"
                :disabled="togglingPayroll"
                @click="togglePayrollPrivilege"
              >
                {{
                  togglingPayroll
                    ? '…'
                    : agency.payrollPrivilegeGranted
                      ? 'Revoke'
                      : 'Grant'
                }}
              </button>
            </div>
          </div>

          <button
            type="button"
            class="admin-btn-primary w-full text-sm"
            :disabled="recomputing"
            @click="recomputeTier"
          >
            {{ recomputing ? 'Recomputing…' : 'Recompute tier' }}
          </button>
          <p class="text-xs text-admin-muted">
            Forces rolling 30-day window recompute (yesterday back). Daily cron needs
            <code class="rounded bg-admin-bg px-1">AGENCY_LEVEL_RECOMPUTE_ENABLED=true</code>
            on the worker.
          </p>
          <button type="button" class="admin-btn-secondary w-full text-sm" @click="tierDialog = true">
            Edit Commission Tier
          </button>
          <button type="button" class="admin-btn-secondary w-full text-sm" @click="messageDialog = true">
            Send System Message
          </button>
          <button type="button" class="admin-btn-primary w-full text-sm" @click="addHostDialog = true">
            Add Host
          </button>
          <button type="button" class="admin-btn-secondary w-full text-sm" @click="transferDialog = true">
            Transfer Hosts
          </button>
          <button
            v-if="agency.status !== 'SUSPENDED'"
            type="button"
            class="admin-btn-warn w-full text-sm"
            @click="suspendDialog = true"
          >
            Suspend Agency
          </button>
          <button type="button" class="admin-btn-danger w-full text-sm" @click="banDialog = true">
            Ban Agency
          </button>
          <button type="button" class="admin-btn-danger w-full text-sm" @click="deleteDialog = true">
            Delete Agency
          </button>
          <p class="text-xs text-admin-muted">
            Suspend = temporary pause. Ban = teardown + bar re-apply. Delete = teardown without bar.
          </p>
        </div>
      </div>

      <section v-if="activeTab === 'hosts'" class="admin-card">
        <AgencyHostEarningsPanel :identifier="identifier" @open-commission="openHostCommission" />
      </section>

      <section v-if="activeTab === 'commission'" class="admin-card">
        <AgencyCommissionHistoryPanel
          ref="commissionPanel"
          :identifier="identifier"
          :initial-host-public-id="commissionHostPublicId"
        />
      </section>
    </template>

    <div v-else class="py-16 text-center text-admin-subtext">Agency not found</div>

    <!-- Dialogs -->
    <BaseDialog
      :open="!!recomputeResult"
      title="Tier recompute result"
      @close="recomputeResult = null"
    >
      <template #body>
        <div v-if="recomputeResult" class="space-y-3 text-sm">
          <p>
            Tier
            <span class="font-semibold text-admin-accent">{{ recomputeResult.before.currentLevel }}</span>
            →
            <span class="font-semibold text-admin-accent">{{ recomputeResult.after.currentLevel }}</span>
          </p>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <div class="admin-kv-row">
              <span class="admin-kv-label">Window</span>
              <span class="admin-kv-value">
                {{ recomputeResult.levelWindow.from }} → {{ recomputeResult.levelWindow.to }}
              </span>
            </div>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Points before</span>
              <span class="admin-kv-value tabular-nums">
                {{ formatPoints(Number(recomputeResult.before.currentWindowTotalPoints)) }}
              </span>
            </div>
            <div class="admin-kv-row border-0">
              <span class="admin-kv-label">Points after</span>
              <span class="admin-kv-value tabular-nums">
                {{ formatPoints(Number(recomputeResult.after.currentWindowTotalPoints)) }}
              </span>
            </div>
            <div
              v-if="recomputeResult.after.tierLockUntil"
              class="admin-kv-row border-0"
            >
              <span class="admin-kv-label">Tier lock</span>
              <span class="admin-kv-value">
                Base {{ recomputeResult.after.tierLockLevel }} until
                {{ format(new Date(recomputeResult.after.tierLockUntil), 'dd MMM yyyy HH:mm') }}
              </span>
            </div>
          </div>
          <p v-if="recomputeResult.levelWindow.note" class="text-xs text-admin-muted">
            {{ recomputeResult.levelWindow.note }}
          </p>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-primary" @click="recomputeResult = null">Done</button>
      </template>
    </BaseDialog>

    <BaseDialog :open="tierDialog" title="Edit Commission Tier" @close="tierDialog = false">
      <template #body>
        <select v-model="newTier" class="admin-input">
          <option v-for="tier in COMMISSION_TIERS" :key="tier" :value="tier">{{ tier }}</option>
        </select>
        <p class="mt-2 text-xs text-admin-muted">
          Sets a base tier for one rolling-window duration from now. Recomputes cannot drop below
          this tier until then, but the agency can still rise if earnings qualify. After the window,
          tier follows actual earnings only.
        </p>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="tierDialog = false">Cancel</button>
        <button type="button" class="admin-btn-primary" :disabled="acting" @click="saveTier">Save</button>
      </template>
    </BaseDialog>

    <BaseDialog :open="messageDialog" title="Send System Message to Agency Owner" @close="messageDialog = false">
      <template #body>
        <p class="mb-3 text-sm text-admin-subtext">
          Sends a SYSTEM message to the agency owner's platform inbox thread.
        </p>
        <textarea v-model="messageText" rows="4" class="admin-input resize-none" placeholder="Message to agency owner…" maxlength="4000" />
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="messageDialog = false">Cancel</button>
        <button type="button" class="admin-btn-primary" :disabled="acting || !messageText.trim()" @click="sendMessage">
          Send
        </button>
      </template>
    </BaseDialog>

    <BaseDialog :open="addHostDialog" title="Add Host" @close="addHostDialog = false">
      <template #body>
        <label class="mb-1 block text-xs text-admin-subtext">Host UUID or public / display ID</label>
        <input
          v-model="hostUserId"
          type="text"
          class="admin-input font-mono"
          placeholder="34216592"
        />
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="addHostDialog = false">Cancel</button>
        <button type="button" class="admin-btn-primary" :disabled="acting || !hostUserId.trim()" @click="addHost">
          Add Host
        </button>
      </template>
    </BaseDialog>

    <BaseDialog :open="transferDialog" title="Transfer Hosts" @close="transferDialog = false">
      <template #body>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Target agency (public ID or UUID)</label>
            <input v-model="targetAgencyId" type="text" class="admin-input" placeholder="34216592" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">
              Host UUIDs or public IDs (comma or space separated)
            </label>
            <textarea
              v-model="transferHostIds"
              rows="3"
              class="admin-input resize-none font-mono text-xs"
              placeholder="34216592, 88100221"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="transferDialog = false">Cancel</button>
        <button type="button" class="admin-btn-primary" :disabled="acting" @click="transferHosts">Transfer</button>
      </template>
    </BaseDialog>

    <BaseDialog :open="suspendDialog" title="Suspend Agency" @close="suspendDialog = false">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-admin-subtext">
            Temporary pause: no new commission, trading coins blocked, no payroll assignments, owner
            wallets frozen. Hosts stay in the agency; owner can still log in.
          </p>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="useSuspendUntil" type="checkbox" class="accent-admin-accent" />
            Use specific end date
          </label>
          <input v-if="useSuspendUntil" v-model="suspendUntil" type="datetime-local" class="admin-input" />
          <div v-else class="flex flex-wrap gap-2">
            <label
              v-for="days in [1, 7, 30, 365]"
              :key="days"
              class="flex cursor-pointer items-center gap-1.5 rounded-md border border-admin-border px-2.5 py-1.5 text-xs"
              :class="suspendDays === days ? 'border-admin-accent bg-admin-accent/10' : ''"
            >
              <input v-model="suspendDays" type="radio" :value="days" class="accent-admin-accent" />
              {{ days }} days
            </label>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="suspendDialog = false">Cancel</button>
        <button type="button" class="admin-btn-warn" :disabled="acting" @click="suspend">Suspend</button>
      </template>
    </BaseDialog>

    <ConfirmActionDialog
      :open="payrollOffDialog"
      title="Revoke payroll privilege"
      message="Sets payrollPrivilegeGranted=false and forces payrollEnabled=false. The agency stops receiving assignments immediately and cannot turn accept back on (403 PAYROLL_PRIVILEGE_DENIED) until you grant privilege again."
      confirm-label="Revoke privilege"
      variant="warn"
      @close="payrollOffDialog = false"
      @confirm="confirmPayrollPrivilegeRevoke"
    />

    <ConfirmActionDialog
      :open="banDialog"
      title="Ban Agency"
      message="Permanent teardown: frees all hosts, deletes the agency, freezes owner wallets, expires open payroll, and bars re-application. Login is not banned. Prefer Ban for policy removals (Delete does not set the bar)."
      confirm-label="Ban Agency"
      variant="danger"
      :require-reason="true"
      :require-confirm-text="true"
      @close="banDialog = false"
      @confirm="banAgency"
    />

    <ConfirmActionDialog
      :open="deleteDialog"
      title="Delete Agency"
      message="Teardown without barring: frees hosts and deletes the agency. Does not set agency_barred_at. Prefer Ban for policy removals."
      confirm-label="Delete Agency"
      variant="danger"
      :require-confirm-text="true"
      @close="deleteDialog = false"
      @confirm="deleteAgency"
    />
  </div>
</template>
