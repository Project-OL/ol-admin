<script setup lang="ts">
import { computed } from 'vue'
import type { AdminRevertPreview } from '@/types/transactions'
import { formatAmount } from '@/composables/useTransactionRevert'

/**
 * Receiver-balance check shown in revert dialogs (from a `dryRun` preview). When the receiver
 * can't cover the full amount it explains the force reverse (SUPER_ADMIN) and its shortfall.
 */
const props = defineProps<{
  preview: AdminRevertPreview | null
  loading: boolean
  error: string | null
}>()

const currencyLabel = computed(() => {
  switch (props.preview?.currency) {
    case 'POINT':
      return 'points'
    case 'TRADING_COIN':
      return 'trading coins'
    case 'COIN':
      return 'coins'
    default:
      return ''
  }
})

const nothingToRecover = computed(
  () =>
    props.preview != null &&
    !props.preview.sufficient &&
    BigInt(props.preview.recoverable ?? '0') <= 0n,
)
</script>

<template>
  <div class="mb-3">
    <p v-if="loading" class="text-xs text-admin-muted">Checking receiver balance…</p>
    <p
      v-else-if="error"
      class="rounded border border-admin-border px-3 py-2 text-xs text-admin-danger"
    >
      {{ error }}
    </p>
    <template v-else-if="preview && preview.via !== 'withdrawal'">
      <p v-if="preview.sufficient" class="text-xs text-admin-subtext">
        Receiver has {{ formatAmount(preview.receiverAvailable) }} {{ currencyLabel }} — enough to
        revert the full {{ formatAmount(preview.originalAmount) }}.
      </p>
      <div
        v-else
        class="rounded border border-admin-warn/40 bg-admin-warn/10 px-3 py-2 text-xs text-admin-text"
      >
        <p class="font-medium text-admin-warn">
          Receiver has only {{ formatAmount(preview.receiverAvailable) }} of
          {{ formatAmount(preview.originalAmount) }} {{ currencyLabel }}. A full revert is not
          possible.
        </p>
        <p v-if="nothingToRecover" class="mt-1">
          There is nothing left to recover from the receiver.
        </p>
        <template v-else-if="preview.forceAllowed">
          <p class="mt-1">
            <strong>Force reverse</strong> will take {{ formatAmount(preview.recoverable) }} from
            the receiver and return it to the sender.
            <strong>{{ formatAmount(preview.shortfall) }}</strong> stays unrecovered.
          </p>
          <p class="mt-1 text-admin-subtext">
            This is final: the transaction is marked reversed and cannot be reverted again.
          </p>
        </template>
        <p v-else class="mt-1">Only a super admin can force-reverse this transaction.</p>
      </div>
    </template>
  </div>
</template>
