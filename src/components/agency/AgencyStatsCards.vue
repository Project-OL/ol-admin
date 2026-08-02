<script setup lang="ts">
import type { AgencyOverviewStats } from '@/types/agency'
import { formatNumber, formatPoints } from '@/utils/format'

defineProps<{
  stats: AgencyOverviewStats | null
  loading?: boolean
}>()

function formatChange(value: number | null) {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}
</script>

<template>
  <div class="admin-stats-grid">
    <div class="admin-card !p-3">
      <p class="text-xs text-admin-subtext">Total Agencies</p>
      <p class="mt-1 text-2xl font-semibold tabular-nums">
        {{ loading ? '…' : formatNumber(stats?.totalAgencies ?? 0) }}
      </p>
    </div>
    <div class="admin-card !p-3">
      <p class="text-xs text-admin-subtext">Active</p>
      <p class="mt-1 text-2xl font-semibold tabular-nums text-admin-success">
        {{ loading ? '…' : formatNumber(stats?.totalActiveAgencies ?? 0) }}
      </p>
      <p class="text-xs text-admin-muted">{{ stats?.activeAgenciesPercent ?? 0 }}% of total</p>
    </div>
    <div class="admin-card !p-3">
      <p class="text-xs text-admin-subtext">Suspended</p>
      <p class="mt-1 text-2xl font-semibold tabular-nums text-admin-warn">
        {{ loading ? '…' : formatNumber(stats?.totalSuspendedAgencies ?? 0) }}
      </p>
    </div>
    <div class="admin-card !p-3">
      <p class="text-xs text-admin-subtext">Total Hosts</p>
      <p class="mt-1 text-2xl font-semibold tabular-nums">
        {{ loading ? '…' : formatNumber(stats?.totalHosts ?? 0) }}
      </p>
    </div>
    <div class="admin-card !p-3">
      <p class="text-xs text-admin-subtext">Today Earnings</p>
      <p class="mt-1 text-lg font-semibold tabular-nums">
        {{ loading ? '…' : formatPoints(Number(stats?.todayAgencyEarningsPoints ?? 0)) }}
      </p>
    </div>
    <div class="admin-card !p-3">
      <p class="text-xs text-admin-subtext">vs Yesterday</p>
      <p
        class="mt-1 text-lg font-semibold tabular-nums"
        :class="{
          'text-admin-success': (stats?.todayEarningsChangePercent ?? 0) > 0,
          'text-admin-danger': (stats?.todayEarningsChangePercent ?? 0) < 0,
        }"
      >
        {{ loading ? '…' : formatChange(stats?.todayEarningsChangePercent ?? null) }}
      </p>
      <p class="text-xs text-admin-muted">
        Yesterday: {{ formatPoints(Number(stats?.yesterdayAgencyEarningsPoints ?? 0)) }}
      </p>
    </div>
  </div>
</template>
