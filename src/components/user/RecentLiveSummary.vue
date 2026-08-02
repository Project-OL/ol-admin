<script setup lang="ts">
import type { LiveSummary } from '@/types/user'
import { formatNumber } from '@/utils/format'

defineProps<{ summary: LiveSummary }>()
</script>

<template>
  <div class="admin-card">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-admin-subtext">Live Summary (This Week)</h2>
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-md bg-admin-bg/60 p-3">
        <p class="text-xs text-admin-subtext">Live Hours</p>
        <p class="tabular-nums text-2xl font-semibold">{{ summary.liveHours }}h</p>
      </div>
      <div class="rounded-md bg-admin-bg/60 p-3">
        <p class="text-xs text-admin-subtext">Receiving Count</p>
        <p class="tabular-nums text-2xl font-semibold">{{ formatNumber(summary.receivingCount) }}</p>
      </div>
    </div>
  </div>
</template>
