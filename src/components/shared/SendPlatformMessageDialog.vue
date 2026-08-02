<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'

const MAX_LENGTH = 4000

const props = defineProps<{
  open: boolean
  userLabel?: string
  type: 'system' | 'notification'
}>()

const emit = defineEmits<{
  close: []
  confirm: [message: string]
}>()

const message = ref('')
const sending = ref(false)

const title = computed(() =>
  props.type === 'system' ? 'Send System Message' : 'Send Notification',
)

const description = computed(() =>
  props.type === 'system'
    ? 'Moderation warnings, policy notices, and account actions. Delivered to the user\'s SYSTEM platform thread.'
    : 'Announcements and campaigns. Delivered to the user\'s NOTIFICATION platform thread.',
)

const canSubmit = computed(
  () => message.value.trim().length > 0 && message.value.length <= MAX_LENGTH,
)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) message.value = ''
  },
)

function handleSubmit() {
  if (!canSubmit.value || sending.value) return
  emit('confirm', message.value.trim())
}
</script>

<template>
  <BaseDialog :open="open" :title="title" @close="emit('close')">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-admin-subtext">{{ description }}</p>
        <p v-if="userLabel" class="text-sm">
          To: <span class="font-medium text-admin-text">{{ userLabel }}</span>
        </p>
        <div>
          <label class="mb-1 block text-xs font-medium text-admin-subtext">
            Message ({{ message.length }}/{{ MAX_LENGTH }})
          </label>
          <textarea
            v-model="message"
            rows="5"
            :maxlength="MAX_LENGTH"
            class="admin-input resize-none"
            placeholder="Enter message text..."
          />
        </div>
      </div>
    </template>
    <template #footer>
      <button type="button" class="admin-btn-secondary" @click="emit('close')">Cancel</button>
      <button type="button" class="admin-btn-primary" :disabled="!canSubmit" @click="handleSubmit">
        Send
      </button>
    </template>
  </BaseDialog>
</template>
