<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import { useRewardsAdminStore } from '@/stores/rewardsAdmin'
import { rewardsAdminApi } from '@/api/rewardsAdmin'
import { agencyAdminApi } from '@/api/agencyAdmin'
import { formatPoints } from '@/utils/format'
import { showToast } from '@/utils/toast'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import type { RewardClaim, RewardClaimType } from '@/types/rewards'
import type { AgencyListItem } from '@/types/agency'

const store = useRewardsAdminStore()

const filters = reactive({
  country: '',
  type: '' as '' | RewardClaimType,
  from: '',
  to: '',
})

const exporting = ref(false)
const revertTarget = ref<{ ledgerEntryId: string; label: string } | null>(null)
const expandedUserIds = ref<Set<string>>(new Set())
const selectedUserIds = ref<Set<string>>(new Set())
const bulkDebitOpen = ref(false)

const agencyQuery = ref('')
const agencyResults = ref<AgencyListItem[]>([])
const selectedAgency = ref<{ agencyUserId: string; label: string } | null>(null)

function toIsoFrom(date: string) {
  return date ? new Date(`${date}T00:00:00.000Z`).toISOString() : undefined
}
function toIsoTo(date: string) {
  return date ? new Date(`${date}T23:59:59.999Z`).toISOString() : undefined
}

function currentQuery(page = 1) {
  return {
    country: filters.country.trim() || undefined,
    type: filters.type || undefined,
    agencyUserId: selectedAgency.value?.agencyUserId,
    from: toIsoFrom(filters.from),
    to: toIsoTo(filters.to),
    page,
    limit: store.limit,
  }
}

async function loadClaims(page = 1) {
  try {
    await store.fetchClaims(currentQuery(page))
  } catch (err) {
    showToast(errorMessage(err, 'Failed to load reward claims'), 'error')
  }
}

function applyFilters() {
  void loadClaims(1)
}

function resetFilters() {
  filters.country = ''
  filters.type = ''
  filters.from = ''
  filters.to = ''
  clearAgencyFilter()
  void loadClaims(1)
}

async function searchAgency() {
  const q = agencyQuery.value.trim()
  if (!q) {
    agencyResults.value = []
    return
  }
  try {
    const { data } = await agencyAdminApi.listAgencies({ q, take: 10, status: 'ACTIVE' })
    agencyResults.value = data.items
  } catch {
    agencyResults.value = []
  }
}

function pickAgency(hit: AgencyListItem) {
  selectedAgency.value = { agencyUserId: hit.agencyUserId, label: `${hit.userName} · #${hit.userPublicId}` }
  agencyQuery.value = selectedAgency.value.label
  agencyResults.value = []
  void loadClaims(1)
}

function clearAgencyFilter() {
  selectedAgency.value = null
  agencyQuery.value = ''
  agencyResults.value = []
}

function toggleExpanded(userId: string) {
  if (expandedUserIds.value.has(userId)) expandedUserIds.value.delete(userId)
  else expandedUserIds.value.add(userId)
  expandedUserIds.value = new Set(expandedUserIds.value)
}

function toggleSelected(userId: string) {
  if (selectedUserIds.value.has(userId)) selectedUserIds.value.delete(userId)
  else selectedUserIds.value.add(userId)
  selectedUserIds.value = new Set(selectedUserIds.value)
}

async function confirmBulkDebit(payload: { reason?: string; amount?: number }) {
  const reason = payload.reason?.trim()
  const amount = payload.amount
  if (!reason || !amount || amount <= 0) return
  try {
    const result = await store.bulkDebitPoints([...selectedUserIds.value], amount, reason)
    if (result.failed > 0) {
      showToast(`${result.succeeded} succeeded, ${result.failed} failed`, result.succeeded ? 'success' : 'error')
    } else {
      showToast(`Debited ${formatPoints(amount)} pts from ${result.succeeded} user(s)`, 'success')
    }
    bulkDebitOpen.value = false
    selectedUserIds.value = new Set()
    await loadClaims(store.page)
  } catch (err) {
    showToast(errorMessage(err, 'Bulk debit failed'), 'error')
  }
}

function prevPage() {
  if (store.page <= 1) return
  void loadClaims(store.page - 1)
}
function nextPage() {
  if (store.page * store.limit >= store.total) return
  void loadClaims(store.page + 1)
}

async function exportClaims() {
  exporting.value = true
  try {
    const { data } = await rewardsAdminApi.exportClaims({
      country: filters.country.trim() || undefined,
      type: filters.type || undefined,
      agencyUserId: selectedAgency.value?.agencyUserId,
      from: toIsoFrom(filters.from),
      to: toIsoTo(filters.to),
    })
    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `reward-claims-${date}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    showToast(errorMessage(err, 'Export failed'), 'error')
  } finally {
    exporting.value = false
  }
}

function openRevert(ledgerEntryId: string, username: string, claim: RewardClaim) {
  if (claim.reverted) return
  revertTarget.value = {
    ledgerEntryId,
    label: `${claim.typeLabel} claim of ${formatPoints(Number(claim.pointsAmount))} pts from ${username} (${claim.date})`,
  }
}

async function confirmRevert(payload: { reason?: string }) {
  const target = revertTarget.value
  const reason = payload.reason?.trim()
  if (!target || !reason) return
  try {
    await store.revertClaim(target.ledgerEntryId, reason)
    showToast('Claim reverted', 'success')
    revertTarget.value = null
  } catch (err) {
    showToast(errorMessage(err, 'Failed to revert claim'), 'error')
  }
}

function errorMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  const code = (err.response?.data as { code?: string } | undefined)?.code
  switch (code) {
    case 'ALREADY_REVERTED':
      return 'This claim was already reverted'
    case 'NOT_REVERTABLE':
      return 'This entry cannot be reverted here'
    case 'INSUFFICIENT_POINTS':
      return 'User no longer has enough points to revert this claim'
    case 'LEDGER_ENTRY_NOT_FOUND':
      return 'Ledger entry not found'
    case 'EXPORT_TOO_LARGE':
      return 'Too many rows for that filter — narrow the date range'
    default:
      return (err.response?.data as { message?: string } | undefined)?.message || fallback
  }
}

onMounted(() => {
  void loadClaims(1)
})
</script>

<template>
  <div class="space-y-4">
    <div class="admin-card">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">
          Reward Claims
        </h2>
        <button
          type="button"
          class="admin-btn-secondary text-xs"
          :disabled="exporting"
          @click="exportClaims"
        >
          {{ exporting ? 'Exporting…' : 'Export to Excel' }}
        </button>
      </div>

      <div class="admin-filter-bar">
        <input
          v-model="filters.country"
          type="text"
          class="admin-input w-32"
          placeholder="Country"
          @keydown.enter="applyFilters"
        />
        <select v-model="filters.type" class="admin-input w-auto">
          <option value="">All reward types</option>
          <option value="NORMAL_HOST">Normal Host</option>
          <option value="ROYAL_HOST">Royal Host</option>
          <option value="LIVESTREAM_STREAK">Livestream Streak</option>
        </select>
        <div class="relative">
          <input
            v-model="agencyQuery"
            type="text"
            class="admin-input w-48"
            placeholder="Filter by agency"
            @input="searchAgency"
          />
          <button
            v-if="selectedAgency"
            type="button"
            class="absolute right-2 top-2 text-xs text-admin-muted hover:text-admin-text"
            @click="clearAgencyFilter(); applyFilters()"
          >
            ×
          </button>
          <div
            v-if="agencyResults.length"
            class="absolute z-20 mt-1 max-h-56 w-64 overflow-auto rounded-md border border-admin-border bg-admin-surface shadow-lg"
          >
            <button
              v-for="hit in agencyResults"
              :key="hit.agencyUserId"
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-admin-bg"
              @click="pickAgency(hit)"
            >
              <span class="font-medium">{{ hit.userName }}</span>
              <span class="text-xs text-admin-muted">#{{ hit.userPublicId }} · {{ hit.country || '—' }}</span>
            </button>
          </div>
        </div>
        <input v-model="filters.from" type="date" class="admin-input w-auto" title="From" />
        <input v-model="filters.to" type="date" class="admin-input w-auto" title="To" />
        <button type="button" class="admin-btn-primary" :disabled="store.loading" @click="applyFilters">
          {{ store.loading ? 'Loading…' : 'Search' }}
        </button>
        <button type="button" class="admin-btn-secondary text-xs" @click="resetFilters">Reset</button>
      </div>
    </div>

    <div v-if="selectedUserIds.size > 0" class="admin-card flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm font-medium">{{ selectedUserIds.size }} user(s) selected</span>
      <div class="flex gap-2">
        <button type="button" class="admin-btn-secondary text-xs" @click="selectedUserIds = new Set()">
          Clear selection
        </button>
        <button type="button" class="admin-btn-warn text-xs" @click="bulkDebitOpen = true">
          Debit points from selected
        </button>
      </div>
    </div>

    <div v-if="!store.users.length && !store.loading" class="admin-card py-10 text-center text-admin-muted">
      No reward claims found for this filter
    </div>

    <div v-for="user in store.users" :key="user.userId" class="admin-card">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <input
            type="checkbox"
            class="accent-admin-accent"
            :checked="selectedUserIds.has(user.userId)"
            @change="toggleSelected(user.userId)"
          />
          <button type="button" class="flex items-center gap-2 text-left" @click="toggleExpanded(user.userId)">
            <span class="text-xs text-admin-subtext">{{ expandedUserIds.has(user.userId) ? '▾' : '▸' }}</span>
            <div>
              <p class="font-medium">{{ user.username }}</p>
              <p class="text-xs text-admin-subtext">
                Public ID {{ user.publicId }} · {{ user.country ?? 'Unknown country' }}
              </p>
            </div>
          </button>
        </div>
        <div class="text-right">
          <p class="tabular-nums text-lg font-semibold">{{ formatPoints(Number(user.totalPoints)) }} pts</p>
          <p class="text-xs text-admin-subtext">{{ user.claimCount }} claim(s)</p>
        </div>
      </div>

      <div v-if="expandedUserIds.has(user.userId)" class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Date</th>
              <th>Points</th>
              <th>Claimed At</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="claim in user.claims" :key="claim.ledgerEntryId">
              <td>{{ claim.typeLabel }}</td>
              <td>{{ claim.date }}</td>
              <td class="tabular-nums">{{ formatPoints(Number(claim.pointsAmount)) }}</td>
              <td class="text-xs whitespace-nowrap">{{ new Date(claim.claimedAt).toLocaleString() }}</td>
              <td class="text-right">
                <span v-if="claim.reverted" class="text-xs text-admin-muted">Reverted</span>
                <button
                  v-else
                  type="button"
                  class="admin-btn-warn text-xs"
                  :disabled="store.reverting === claim.ledgerEntryId"
                  @click="openRevert(claim.ledgerEntryId, user.username, claim)"
                >
                  Revert
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="store.total > 0" class="admin-pagination">
      <span>{{ store.total }} user(s) total</span>
      <div class="flex gap-2">
        <button type="button" class="admin-btn-secondary text-xs" :disabled="store.page <= 1" @click="prevPage">
          Previous
        </button>
        <button
          type="button"
          class="admin-btn-secondary text-xs"
          :disabled="store.page * store.limit >= store.total"
          @click="nextPage"
        >
          Next
        </button>
      </div>
    </div>

    <ConfirmActionDialog
      :open="!!revertTarget"
      title="Revert reward claim"
      :message="revertTarget?.label"
      confirm-label="Revert"
      variant="warn"
      require-reason
      @close="revertTarget = null"
      @confirm="confirmRevert"
    />

    <ConfirmActionDialog
      :open="bulkDebitOpen"
      title="Debit points from selected users"
      :message="`Debit the same amount from all ${selectedUserIds.size} selected user(s). Users with insufficient balance are skipped and reported.`"
      confirm-label="Debit"
      variant="warn"
      amount-input
      require-reason
      @close="bulkDebitOpen = false"
      @confirm="confirmBulkDebit"
    />
  </div>
</template>
