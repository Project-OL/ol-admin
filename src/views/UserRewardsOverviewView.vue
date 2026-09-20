<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { userRewardsOverviewApi } from '@/api/userRewardsOverview'
import { transactionsApi } from '@/api/transactions'
import { formatDuration, formatPoints, getInitials } from '@/utils/format'
import { showToast } from '@/utils/toast'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import type { UserRewardsOverview } from '@/types/userRewardsOverview'

const route = useRoute()
const userId = computed(() => route.params.id as string)

const loading = ref(false)
const loadError = ref<string | null>(null)
const overview = ref<UserRewardsOverview | null>(null)
const reverting = ref<string | null>(null)
const revertTarget = ref<{ ledgerEntryId: string; label: string } | null>(null)

function errorMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  return (err.response?.data as { message?: string } | undefined)?.message || fallback
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const { data } = await userRewardsOverviewApi.get(userId.value)
    overview.value = data
  } catch (err) {
    loadError.value = errorMessage(err, 'Failed to load rewards overview')
  } finally {
    loading.value = false
  }
}

onMounted(load)

type ActivityRow = {
  kind: 'CREDIT' | 'DEBIT'
  ledgerEntryId: string
  label: string
  amount: string
  dateLabel: string
  recordedAt: string
  reverted: boolean
}

const activity = computed<ActivityRow[]>(() => {
  if (!overview.value) return []
  const credits: ActivityRow[] = overview.value.claimHistory.claims.map((c) => ({
    kind: 'CREDIT',
    ledgerEntryId: c.ledgerEntryId,
    label: c.typeLabel,
    amount: c.pointsAmount,
    dateLabel: c.date,
    recordedAt: c.claimedAt,
    reverted: c.reverted,
  }))
  const debits: ActivityRow[] = overview.value.claimHistory.deductions.map((d) => ({
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
})

function openRevert(row: ActivityRow) {
  if (row.reverted || !overview.value) return
  const what = row.kind === 'CREDIT' ? `${row.label} claim` : row.label
  const direction = row.kind === 'CREDIT' ? 'from' : 'for'
  revertTarget.value = {
    ledgerEntryId: row.ledgerEntryId,
    label: `${what} of ${formatPoints(Number(row.amount))} pts ${direction} ${overview.value.user.username} (${row.dateLabel})`,
  }
}

async function confirmRevert(payload: { reason?: string }) {
  const target = revertTarget.value
  const reason = payload.reason?.trim()
  if (!target || !reason) return
  reverting.value = target.ledgerEntryId
  try {
    await transactionsApi.revertSinglePoint(target.ledgerEntryId, {
      reason,
      idempotencyKey: `admin-reward-revert-${target.ledgerEntryId}-${Date.now()}`,
    })
    showToast('Reverted', 'success')
    revertTarget.value = null
    await load()
  } catch (err) {
    showToast(errorMessage(err, 'Revert failed'), 'error')
  } finally {
    reverting.value = null
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="admin-page">
    <div v-if="loading && !overview" class="flex min-h-[50vh] items-center justify-center">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
    </div>

    <div v-else-if="loadError" class="admin-card py-10 text-center text-admin-danger">
      {{ loadError }}
    </div>

    <template v-else-if="overview">
      <!-- Header -->
      <div class="admin-card flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-admin-accent/15 text-sm font-semibold text-admin-accent"
          >
            {{ getInitials(overview.user.username) }}
          </span>
          <div>
            <div class="flex items-center gap-2">
              <p class="text-lg font-semibold">{{ overview.user.username }}</p>
              <span
                v-if="overview.user.isRoyalHost"
                class="rounded-full bg-admin-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-admin-accent"
              >
                Royal Host
              </span>
            </div>
            <p class="text-xs text-admin-subtext">
              Public ID {{ overview.user.publicId }} · {{ overview.user.country ?? 'Unknown country' }}
            </p>
          </div>
        </div>
        <p class="text-xs text-admin-subtext">Generated {{ fmtDate(overview.generatedAt) }}</p>
      </div>

      <!-- Live timing: today + this week -->
      <div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <div class="admin-card">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-subtext">
            Live Timing — Today ({{ overview.liveTiming.today.date }})
          </h2>
          <div class="mb-3 grid grid-cols-2 gap-3">
            <div class="rounded-md bg-admin-bg/60 p-3">
              <p class="text-xs text-admin-subtext">Effective time</p>
              <p class="tabular-nums text-xl font-semibold">
                {{ formatDuration(overview.liveTiming.today.totalEffectiveSeconds) }}
              </p>
            </div>
            <div class="rounded-md bg-admin-bg/60 p-3">
              <p class="text-xs text-admin-subtext">Sessions</p>
              <p class="tabular-nums text-xl font-semibold">{{ overview.liveTiming.today.sessionCount }}</p>
            </div>
          </div>
          <div v-if="overview.liveTiming.today.sessions.length" class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Ended</th>
                  <th>Effective</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in overview.liveTiming.today.sessions" :key="s.streamId">
                  <td class="text-xs whitespace-nowrap">{{ s.startedAt ? fmtDate(s.startedAt) : '—' }}</td>
                  <td class="text-xs whitespace-nowrap">{{ s.endedAt ? fmtDate(s.endedAt) : '—' }}</td>
                  <td class="tabular-nums">{{ formatDuration(s.effectiveDurationSeconds) }}</td>
                  <td>
                    <span v-if="s.isLive && !s.endedAt" class="text-xs font-medium text-admin-success">Live</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="py-4 text-center text-sm text-admin-muted">No sessions today</p>
        </div>

        <div class="admin-card">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-subtext">
            Live Timing — This Week
          </h2>
          <p class="mb-3 text-xs text-admin-subtext">
            {{ new Date(overview.liveTiming.thisWeek.weekStart).toLocaleDateString() }} –
            {{ new Date(overview.liveTiming.thisWeek.weekEnd).toLocaleDateString() }} (Sun–Sun, UTC)
          </p>
          <div class="mb-3 grid grid-cols-2 gap-3">
            <div class="rounded-md bg-admin-bg/60 p-3">
              <p class="text-xs text-admin-subtext">Effective time</p>
              <p class="tabular-nums text-xl font-semibold">
                {{ formatDuration(overview.liveTiming.thisWeek.totalEffectiveSeconds) }}
              </p>
            </div>
            <div class="rounded-md bg-admin-bg/60 p-3">
              <p class="text-xs text-admin-subtext">Sessions</p>
              <p class="tabular-nums text-xl font-semibold">{{ overview.liveTiming.thisWeek.sessionCount }}</p>
            </div>
          </div>
          <div v-if="overview.liveTiming.thisWeek.sessions.length" class="admin-table-wrap max-h-72 overflow-y-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Ended</th>
                  <th>Effective</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in overview.liveTiming.thisWeek.sessions" :key="s.streamId">
                  <td class="text-xs whitespace-nowrap">{{ s.startedAt ? fmtDate(s.startedAt) : '—' }}</td>
                  <td class="text-xs whitespace-nowrap">{{ s.endedAt ? fmtDate(s.endedAt) : '—' }}</td>
                  <td class="tabular-nums">{{ formatDuration(s.effectiveDurationSeconds) }}</td>
                  <td>
                    <span v-if="s.isLive && !s.endedAt" class="text-xs font-medium text-admin-success">Live</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="py-4 text-center text-sm text-admin-muted">No sessions this week</p>
        </div>
      </div>

      <!-- Reward tracks -->
      <div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <!-- Normal Host -->
        <div class="admin-card">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-subtext">Normal Host Reward</h2>
          <p v-if="!overview.normalHostReward.eligible" class="text-sm text-admin-muted">
            Not eligible today (active Livestream Streak window, Royal Host tag, or account too new).
          </p>
          <template v-else>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Streamed today</span>
              <span class="admin-kv-value tabular-nums">{{ formatDuration(overview.normalHostReward.streamedSecondsToday) }}</span>
            </div>
            <template v-if="overview.normalHostReward.hasTier">
              <div class="admin-kv-row">
                <span class="admin-kv-label">Current tier</span>
                <span class="admin-kv-value tabular-nums">{{ formatPoints(Number(overview.normalHostReward.currentTier.thresholdPoints)) }} pts / {{ overview.normalHostReward.currentTier.windowDays }}d</span>
              </div>
              <div class="admin-kv-row">
                <span class="admin-kv-label">Claimed today</span>
                <span class="admin-kv-value tabular-nums">{{ formatPoints(Number(overview.normalHostReward.totalClaimedToday)) }} pts</span>
              </div>
              <div class="admin-kv-row">
                <span class="admin-kv-label">Slots</span>
                <span class="admin-kv-value">
                  {{ overview.normalHostReward.slots.filter((s) => s.claimed).length }} claimed /
                  {{ overview.normalHostReward.slots.filter((s) => s.unlocked).length }} unlocked /
                  {{ overview.normalHostReward.slots.length }} total
                </span>
              </div>
              <div v-if="overview.normalHostReward.nextTier" class="admin-kv-row">
                <span class="admin-kv-label">Next tier</span>
                <span class="admin-kv-value tabular-nums">
                  {{ formatPoints(Number(overview.normalHostReward.nextTier.earnedPoints)) }} /
                  {{ formatPoints(Number(overview.normalHostReward.nextTier.thresholdPoints)) }} pts
                  ({{ overview.normalHostReward.nextTier.progressPercent }}%)
                </span>
              </div>
            </template>
            <template v-else>
              <div class="admin-kv-row">
                <span class="admin-kv-label">Progress to entry tier</span>
                <span class="admin-kv-value tabular-nums">
                  {{ formatPoints(Number(overview.normalHostReward.nextTier.earningsSoFar)) }} /
                  {{ formatPoints(Number(overview.normalHostReward.nextTier.thresholdPoints)) }} pts
                  ({{ overview.normalHostReward.nextTier.progressPercent }}%)
                </span>
              </div>
            </template>
          </template>
        </div>

        <!-- Royal Host -->
        <div class="admin-card">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-subtext">Royal Host Reward</h2>
          <p v-if="!overview.royalHostReward.eligible" class="text-sm text-admin-muted">Not tagged as Royal Host.</p>
          <template v-else>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Week earnings</span>
              <span class="admin-kv-value tabular-nums">{{ formatPoints(Number(overview.royalHostReward.weeklyEarningsPoints)) }} pts</span>
            </div>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Weekly hours</span>
              <span class="admin-kv-value tabular-nums">
                {{ overview.royalHostReward.timingReward.completedMinutes }} / {{ overview.royalHostReward.timingReward.requiredMinutes }} min
              </span>
            </div>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Timing current</span>
              <span class="admin-kv-value">
                {{ overview.royalHostReward.timingReward.current.claimType ?? 'All claimed' }}
                <span v-if="overview.royalHostReward.timingReward.current.claimType" class="text-admin-subtext">
                  ({{ overview.royalHostReward.timingReward.current.claimed ? 'claimed' : overview.royalHostReward.timingReward.current.unlocked ? 'unlocked' : 'locked' }})
                </span>
              </span>
            </div>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Gifting current</span>
              <span class="admin-kv-value">
                <template v-if="overview.royalHostReward.giftingReward.current">
                  {{ overview.royalHostReward.giftingReward.current.claimType }}
                  ({{ overview.royalHostReward.giftingReward.current.progressPercent }}%)
                </template>
                <template v-else>All claimed</template>
              </span>
            </div>
            <div class="admin-kv-row">
              <span class="admin-kv-label">Total this week</span>
              <span class="admin-kv-value tabular-nums">{{ formatPoints(Number(overview.royalHostReward.totalRewardPointsThisWeek)) }} pts</span>
            </div>
          </template>
        </div>

        <!-- Livestream Streak -->
        <div class="admin-card">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-subtext">Livestream Streak</h2>
          <div class="admin-kv-row">
            <span class="admin-kv-label">Eligible</span>
            <span class="admin-kv-value">{{ overview.livestreamReward.eligible ? 'Yes' : 'No (outside window)' }}</span>
          </div>
          <div class="admin-kv-row">
            <span class="admin-kv-label">Day index since join</span>
            <span class="admin-kv-value tabular-nums">{{ overview.livestreamReward.dayIndex }}</span>
          </div>
          <div class="admin-kv-row">
            <span class="admin-kv-label">Streamed today</span>
            <span class="admin-kv-value tabular-nums">{{ overview.livestreamReward.streamedMinutesToday }} min</span>
          </div>
          <div v-if="overview.livestreamReward.parts.length" class="mt-2 space-y-1">
            <div
              v-for="p in overview.livestreamReward.parts"
              :key="p.part"
              class="flex items-center justify-between text-sm"
            >
              <span>Part {{ p.part }} ({{ p.thresholdMinutes }} min, {{ formatPoints(Number(p.points)) }} pts)</span>
              <span
                :class="p.claimed ? 'text-admin-success' : p.unlocked ? 'text-admin-accent' : 'text-admin-muted'"
              >
                {{ p.claimed ? 'Claimed' : p.unlocked ? 'Unlocked' : 'Locked' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Claim / deduction history -->
      <div class="admin-card">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-subtext">Reward Claim &amp; Deduction History</h2>
        <div v-if="activity.length" class="admin-table-wrap">
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
              <tr v-for="row in activity" :key="row.ledgerEntryId">
                <td>
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    :class="row.kind === 'CREDIT' ? 'bg-admin-success/10 text-admin-success' : 'bg-admin-danger/10 text-admin-danger'"
                  >
                    {{ row.kind === 'CREDIT' ? 'Credit' : 'Debit' }}
                  </span>
                </td>
                <td>{{ row.label }}</td>
                <td>{{ row.dateLabel }}</td>
                <td class="tabular-nums" :class="row.kind === 'CREDIT' ? 'text-admin-success' : 'text-admin-danger'">
                  {{ row.kind === 'CREDIT' ? '+' : '-' }}{{ formatPoints(Number(row.amount)) }}
                </td>
                <td class="text-xs whitespace-nowrap">{{ fmtDate(row.recordedAt) }}</td>
                <td class="text-right">
                  <span v-if="row.reverted" class="text-xs text-admin-muted">Reverted</span>
                  <button
                    v-else
                    type="button"
                    class="admin-btn-warn text-xs"
                    :disabled="reverting === row.ledgerEntryId"
                    @click="openRevert(row)"
                  >
                    Revert
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="py-6 text-center text-sm text-admin-muted">No reward claims or deductions on record</p>
      </div>
    </template>

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
  </div>
</template>
