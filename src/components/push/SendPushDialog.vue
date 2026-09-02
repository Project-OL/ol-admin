<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import type { PushPayload } from '@/types/pushNotifications'

const props = defineProps<{
  open: boolean
  title?: string
  subtitle?: string
  confirmLabel?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: PushPayload]
}>()

const form = reactive({
  title: '',
  body: '',
  dataScreen: '',
})

const sending = ref(false)

const canSubmit = computed(() => {
  const titleOk = form.title.trim().length >= 1 && form.title.trim().length <= 200
  const bodyOk = form.body.trim().length >= 1 && form.body.trim().length <= 1000
  if (!titleOk || !bodyOk) return false
  return !sending.value
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      form.title = ''
      form.body = ''
      form.dataScreen = ''
      sending.value = false
    }
  },
)

function handleSubmit() {
  if (!canSubmit.value) return
  const payload: PushPayload = {
    title: form.title.trim(),
    body: form.body.trim(),
  }
  const screen = form.dataScreen.trim()
  if (screen) payload.data = { screen }
  emit('confirm', payload)
}
</script>

<template>
  <BaseDialog :open="open" :title="title ?? 'Compose push'" size="md" @close="emit('close')">
    <template #body>
      <div class="space-y-4">
        <p v-if="subtitle" class="text-sm text-admin-subtext">{{ subtitle }}</p>

        <div>
          <label class="mb-1 block text-xs font-medium text-admin-subtext">
            Title ({{ form.title.length }}/200)
          </label>
          <input
            v-model="form.title"
            type="text"
            maxlength="200"
            class="admin-input"
            placeholder="Notification title"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-admin-subtext">
            Body ({{ form.body.length }}/1000)
          </label>
          <textarea
            v-model="form.body"
            rows="4"
            maxlength="1000"
            class="admin-input resize-none"
            placeholder="Notification body"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-admin-subtext">
            Data · screen (optional)
          </label>
          <input
            v-model="form.dataScreen"
            type="text"
            class="admin-input"
            placeholder="e.g. home, vip"
          />
          <p class="mt-1 text-xs text-admin-muted">Sent as FCM data map with string values only.</p>
        </div>
      </div>
    </template>
    <template #footer>
      <button type="button" class="admin-btn-secondary" @click="emit('close')">Cancel</button>
      <button type="button" class="admin-btn-primary" :disabled="!canSubmit" @click="handleSubmit">
        {{ confirmLabel ?? 'Send' }}
      </button>
    </template>
  </BaseDialog>
</template>
