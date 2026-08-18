<script setup lang="ts">
import { computed } from 'vue'
import { format } from 'date-fns'
import type { SupportTicketListItem } from '@/types/customerSupport'
import {
  resolveInitialSubmission,
  ticketCategoryBreadcrumb,
} from '@/utils/supportTicket'

const props = defineProps<{
  ticket: SupportTicketListItem
  compact?: boolean
}>()

const submission = computed(() => resolveInitialSubmission(props.ticket))
const breadcrumb = computed(() => ticketCategoryBreadcrumb(props.ticket))
</script>

<template>
  <section
    v-if="submission"
    class="rounded-lg border border-admin-border bg-admin-bg/40"
    :class="compact ? 'p-3' : 'p-4'"
  >
    <p class="text-xs font-semibold uppercase tracking-wide text-admin-subtext">
      Opening submission
    </p>
    <p class="mt-1 text-sm font-medium text-admin-text">{{ breadcrumb }}</p>
    <p
      v-if="submission.description"
      class="mt-2 whitespace-pre-wrap text-sm text-admin-text"
      :class="compact ? 'line-clamp-3' : ''"
    >
      {{ submission.description }}
    </p>
    <p v-else class="mt-2 text-sm italic text-admin-muted">No description provided</p>

    <a
      v-if="submission.imageUrl && !compact"
      :href="submission.imageUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-3 inline-block"
    >
      <img
        :src="submission.imageUrl"
        alt="User attachment"
        class="max-h-56 rounded border border-admin-border object-contain"
      />
    </a>
    <img
      v-else-if="submission.imageUrl && compact"
      :src="submission.imageUrl"
      alt=""
      class="mt-2 h-10 w-10 rounded border border-admin-border object-cover"
    />

    <div
      v-if="submission.transactionRef"
      class="mt-3 inline-flex rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300"
    >
      Payment reference · {{ submission.transactionRef.refType }}:
      <span class="ml-1 font-mono">{{ submission.transactionRef.refId }}</span>
    </div>

    <p v-if="submission.submittedAt" class="mt-2 text-xs text-admin-muted">
      Submitted {{ format(new Date(submission.submittedAt), 'dd MMM yyyy, HH:mm') }}
    </p>
  </section>
</template>
