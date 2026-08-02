<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ReportSummary } from '@/types/user'

const props = defineProps<{ userId: string; summary: ReportSummary }>()
const router = useRouter()

const categories = [
  { key: 'nudity' as const, label: 'Nudity / Inappropriate', color: 'text-admin-danger' },
  { key: 'abuse' as const, label: 'Abuse / Harassment', color: 'text-admin-warn' },
  { key: 'fakeStreaming' as const, label: 'Fake Streaming', color: 'text-purple-400' },
]

function navigateToReports() {
  router.push({ path: '/admin/support', query: { tab: 'reports', userId: props.userId } })
}
</script>

<template>
  <div class="admin-card">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">Recent Reports</h2>
      <button type="button" class="text-xs text-admin-accent hover:underline" @click="navigateToReports">
        View All
      </button>
    </div>

    <div class="space-y-2">
      <button
        v-for="cat in categories"
        :key="cat.key"
        type="button"
        class="flex w-full items-center justify-between rounded-md border border-admin-border px-3 py-2.5 text-left transition-colors hover:border-admin-accent/50 hover:bg-admin-accent/5"
        @click="navigateToReports"
      >
        <span class="text-sm">{{ cat.label }}</span>
        <span :class="['tabular-nums text-lg font-semibold', cat.color]">{{ summary[cat.key] }}</span>
      </button>
    </div>

    <button type="button" class="admin-btn-secondary mt-4 w-full text-xs" @click="navigateToReports">
      View All Reports
    </button>
  </div>
</template>
