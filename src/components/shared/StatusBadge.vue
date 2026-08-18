<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  label?: string
}>()

const config = computed(() => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-admin-success/20', text: 'text-admin-success', label: 'Active' },
    inactive: { bg: 'bg-admin-muted/20', text: 'text-admin-muted', label: 'Inactive' },
    suspended: { bg: 'bg-admin-warn/20', text: 'text-admin-warn', label: 'Suspended' },
    banned: { bg: 'bg-admin-danger/20', text: 'text-admin-danger', label: 'Banned' },
    success: { bg: 'bg-admin-success/20', text: 'text-admin-success', label: 'Success' },
    pending: { bg: 'bg-admin-warn/20', text: 'text-admin-warn', label: 'Pending' },
    warn: { bg: 'bg-admin-warn/20', text: 'text-admin-warn', label: 'Warning' },
    failed: { bg: 'bg-admin-danger/20', text: 'text-admin-danger', label: 'Failed' },
    verified: { bg: 'bg-admin-success/20', text: 'text-admin-success', label: 'Verified' },
    duplicate: { bg: 'bg-admin-warn/20', text: 'text-admin-warn', label: 'Duplicate' },
    revoked: { bg: 'bg-admin-muted/20', text: 'text-admin-muted', label: 'Revoked' },
    rejected: { bg: 'bg-admin-danger/20', text: 'text-admin-danger', label: 'Rejected' },
    none: { bg: 'bg-admin-muted/20', text: 'text-admin-muted', label: 'Not Verified' },
  }
  return map[props.status] ?? {
    bg: 'bg-admin-muted/20',
    text: 'text-admin-subtext',
    label: props.label ?? props.status,
  }
})
</script>

<template>
  <span
    :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', config.bg, config.text]"
  >
    {{ label ?? config.label }}
  </span>
</template>
