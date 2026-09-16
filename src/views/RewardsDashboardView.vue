<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import { useRewardsAdminStore } from '@/stores/rewardsAdmin'
import { rewardsAdminApi } from '@/api/rewardsAdmin'
import { formatPoints } from '@/utils/format'
import { showToast } from '@/utils/toast'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import type { RewardClaim, RewardClaimType } from '@/types/rewards'

const store = useRewardsAdminStore()

const filters = reactive({
  country: '',
  type: '' as '' | RewardClaimType,
  from: '',
  to: '',
})

const exporting = ref(false)
const revertTarget = ref<{ ledgerEntryId: string; label: string } | null>(null)

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
  void loadClaims(1)
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
        <input v-model="filters.from" type="date" class="admin-input w-auto" title="From" />
        <input v-model="filters.to" type="date" class="admin-input w-auto" title="To" />
        <button type="button" class="admin-btn-primary" :disabled="store.loading" @click="applyFilters">
          {{ store.loading ? 'Loading…' : 'Search' }}
        </button>
        <button type="button" class="admin-btn-secondary text-xs" @click="resetFilters">Reset</button>
      </div>
    </div>

    <div v-if="!store.users.length && !store.loading" class="admin-card py-10 text-center text-admin-muted">
      No reward claims found for this filter
    </div>

    <div v-for="user in store.users" :key="user.userId" class="admin-card">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="font-medium">{{ user.username }}</p>
          <p class="text-xs text-admin-subtext">
            Public ID {{ user.publicId }} · {{ user.country ?? 'Unknown country' }}
          </p>
        </div>
        <div class="text-right">
          <p class="tabular-nums text-lg font-semibold">{{ formatPoints(Number(user.totalPoints)) }} pts</p>
          <p class="text-xs text-admin-subtext">{{ user.claimCount }} claim(s)</p>
        </div>
      </div>

      <div class="admin-table-wrap">
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
  </div>
</template>
