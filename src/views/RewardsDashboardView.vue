<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import { useRewardsAdminStore } from '@/stores/rewardsAdmin'
import { rewardsAdminApi } from '@/api/rewardsAdmin'
import { agencyAdminApi } from '@/api/agencyAdmin'
import { formatPoints, getInitials } from '@/utils/format'
import { showToast } from '@/utils/toast'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import type { RewardClaimType, RewardClaimUser } from '@/types/rewards'
import type { AgencyListItem } from '@/types/agency'

type ActivityRow = {
  kind: 'CREDIT' | 'DEBIT'
  ledgerEntryId: string
  label: string
  amount: string
  dateLabel: string
  recordedAt: string
  reverted: boolean
}

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

function userActivity(user: RewardClaimUser): ActivityRow[] {
  const credits: ActivityRow[] = user.claims.map((c) => ({
    kind: 'CREDIT',
    ledgerEntryId: c.ledgerEntryId,
    label: c.typeLabel,
    amount: c.pointsAmount,
    dateLabel: c.date,
    recordedAt: c.claimedAt,
    reverted: c.reverted,
  }))
  const debits: ActivityRow[] = user.deductions.map((d) => ({
    kind: 'DEBIT',
    ledgerEntryId: d.ledgerEntryId,
    label: d.description?.trim() || 'Admin deduction',
    amount: d.amount,
    dateLabel: d.createdAt.slice(0, 10),
    recordedAt: d.createdAt,
    reverted: d.reverted,
  }))
  return [...credits, ...debits].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )
}

function openRevertActivity(row: ActivityRow, username: string) {
  if (row.reverted) return
  const what = row.kind === 'CREDIT' ? `${row.label} claim` : row.label
  const direction = row.kind === 'CREDIT' ? 'from' : 'for'
  revertTarget.value = {
    ledgerEntryId: row.ledgerEntryId,
    label: `${what} of ${formatPoints(Number(row.amount))} pts ${direction} ${username} (${row.dateLabel})`,
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

    <div
      v-for="user in store.users"
      :key="user.userId"
      class="admin-card transition-all duration-200 hover:border-admin-accent/40 hover:shadow-lg hover:shadow-black/20"
    >
      <div
        class="-m-4 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4 transition-colors duration-200 hover:bg-admin-accent/5"
        role="button"
        tabindex="0"
        @click="toggleExpanded(user.userId)"
        @keydown.enter="toggleExpanded(user.userId)"
      >
        <div class="flex min-w-0 items-center gap-3">
          <input
            type="checkbox"
            class="accent-admin-accent"
            :checked="selectedUserIds.has(user.userId)"
            @click.stop
            @change="toggleSelected(user.userId)"
          />
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-admin-accent/15 text-xs font-semibold text-admin-accent"
          >
            {{ getInitials(user.username) }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-medium">{{ user.username }}</p>
            <p class="text-xs text-admin-subtext">
              Public ID {{ user.publicId }} · {{ user.country ?? 'Unknown country' }}
            </p>
          </div>
          <svg
            class="h-4 w-4 shrink-0 text-admin-subtext transition-transform duration-200"
            :class="{ 'rotate-90': expandedUserIds.has(user.userId) }"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="flex items-center gap-4 text-right">
          <div>
            <p class="text-[11px] uppercase tracking-wide text-admin-subtext">Credited</p>
            <p class="tabular-nums text-sm font-semibold text-admin-success">
              +{{ formatPoints(Number(user.totalPoints)) }}
            </p>
          </div>
          <div v-if="Number(user.deductionCount) > 0">
            <p class="text-[11px] uppercase tracking-wide text-admin-subtext">Deducted</p>
            <p class="tabular-nums text-sm font-semibold text-admin-danger">
              -{{ formatPoints(Number(user.totalDeducted)) }}
            </p>
          </div>
          <div>
            <p class="text-[11px] uppercase tracking-wide text-admin-subtext">Net</p>
            <p class="tabular-nums text-lg font-semibold">{{ formatPoints(Number(user.netPoints)) }} pts</p>
          </div>
        </div>
      </div>

      <Transition name="fade">
        <div v-if="expandedUserIds.has(user.userId)" class="admin-table-wrap mt-3">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Detail</th>
                <th>Date</th>
                <th>Points</th>
                <th>Recorded At</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in userActivity(user)" :key="row.ledgerEntryId">
                <td>
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    :class="
                      row.kind === 'CREDIT'
                        ? 'bg-admin-success/10 text-admin-success'
                        : 'bg-admin-danger/10 text-admin-danger'
                    "
                  >
                    {{ row.kind === 'CREDIT' ? 'Credit' : 'Debit' }}
                  </span>
                </td>
                <td>{{ row.label }}</td>
                <td>{{ row.dateLabel }}</td>
                <td
                  class="tabular-nums"
                  :class="row.kind === 'CREDIT' ? 'text-admin-success' : 'text-admin-danger'"
                >
                  {{ row.kind === 'CREDIT' ? '+' : '-' }}{{ formatPoints(Number(row.amount)) }}
                </td>
                <td class="text-xs whitespace-nowrap">{{ new Date(row.recordedAt).toLocaleString() }}</td>
                <td class="text-right">
                  <span v-if="row.reverted" class="text-xs text-admin-muted">Reverted</span>
                  <button
                    v-else
                    type="button"
                    class="admin-btn-warn text-xs"
                    :disabled="store.reverting === row.ledgerEntryId"
                    @click="openRevertActivity(row, user.username)"
                  >
                    Revert
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="userActivity(user).length === 0" class="p-4 text-center text-sm text-admin-muted">
            No activity recorded
          </p>
        </div>
      </Transition>
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
      title="Revert entry"
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

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
