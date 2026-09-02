<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'

const props = defineProps<{
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  variant?: 'danger' | 'warn' | 'default'
  requireReason?: boolean
  amountInput?: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: { reason?: string; amount?: number }]
}>()

const reason = ref('')
const amount = ref<number | ''>('')

const variantClass = computed(() => {
  if (props.variant === 'danger') return 'admin-btn-danger'
  if (props.variant === 'warn') return 'admin-btn-warn'
  return 'admin-btn-primary'
})

const canSubmit = computed(() => {
  if (props.requireReason && !reason.value.trim()) return false
  if (props.amountInput && (!amount.value || Number(amount.value) <= 0)) return false
  return true
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      reason.value = ''
      amount.value = ''
    }
  },
)

function handleConfirm() {
  if (!canSubmit.value) return
  emit('confirm', {
    reason: reason.value.trim() || undefined,
    amount: props.amountInput ? Number(amount.value) : undefined,
  })
}
</script>

<template>
  <BaseDialog :open="open" :title="title" size="sm" @close="emit('close')">
    <template #body>
      <p v-if="message" class="mb-4 text-sm text-admin-subtext">{{ message }}</p>
      <div class="space-y-3">
        <div v-if="amountInput">
          <label class="mb-1 block text-xs font-medium text-admin-subtext">Amount</label>
          <input v-model="amount" type="number" min="1" class="admin-input tabular-nums" placeholder="Enter amount" />
        </div>
        <div v-if="requireReason">
          <label class="mb-1 block text-xs font-medium text-admin-subtext">Reason</label>
          <textarea
            v-model="reason"
            rows="3"
            class="admin-input resize-none"
            placeholder="Enter reason..."
          />
        </div>
      </div>
    </template>
    <template #footer>
      <button type="button" class="admin-btn-secondary" @click="emit('close')">Cancel</button>
      <button type="button" :class="variantClass" :disabled="!canSubmit" @click="handleConfirm">
        {{ confirmLabel ?? 'Confirm' }}
      </button>
    </template>
  </BaseDialog>
</template>
