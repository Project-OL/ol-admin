<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'
import { showToast } from '@/utils/toast'

const props = defineProps<{
  open: boolean
  password: string
  /** Shown under the password; defaults to user-session wording. */
  sessionHint?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const copied = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) copied.value = false
  },
)

async function copyPassword() {
  try {
    await navigator.clipboard.writeText(props.password)
    copied.value = true
    showToast('Copied to clipboard', 'success')
  } catch {
    showToast('Failed to copy — select and copy manually', 'error')
  }
}
</script>

<template>
  <BaseDialog :open="open" title="Temporary password" size="sm" @close="emit('close')">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-admin-warn">
          This password is shown once. Copy it now — it cannot be retrieved again.
        </p>
        <div class="flex items-center gap-2">
          <code
            class="flex-1 break-all rounded-md border border-admin-border bg-admin-bg px-3 py-2.5 font-mono text-sm text-admin-text select-all"
          >{{ password }}</code>
          <button type="button" class="admin-btn-primary shrink-0 text-sm" @click="copyPassword">
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <p class="text-xs text-admin-muted">
          {{ sessionHint ?? 'All user sessions have been revoked.' }}
        </p>
      </div>
    </template>
    <template #footer>
      <button type="button" class="admin-btn-secondary" @click="emit('close')">Done</button>
    </template>
  </BaseDialog>
</template>
