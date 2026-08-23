<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'

const props = defineProps<{
  open: boolean
}>()
const emit = defineEmits<{
  close: []
  confirm: [pin: string]
}>()

const pin = ref('')
const confirmPin = ref('')
const showPin = ref(false)
const showConfirm = ref(false)

const rules = computed(() => ({
  digits: /^\d{4,8}$/.test(pin.value),
  match: pin.value === confirmPin.value && confirmPin.value.length > 0,
}))

const isValid = computed(() => Object.values(rules.value).every(Boolean))

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      pin.value = ''
      confirmPin.value = ''
      showPin.value = false
      showConfirm.value = false
    }
  },
)

function handleSubmit() {
  if (!isValid.value) return
  emit('confirm', pin.value)
}

function ruleClass(passed: boolean, touched: boolean) {
  if (!touched) return 'text-admin-subtext'
  return passed ? 'text-admin-success' : 'text-admin-danger'
}
</script>

<template>
  <BaseDialog :open="open" title="Set Security Password" @close="emit('close')">
    <template #body>
      <div class="space-y-4">
        <p class="text-xs text-admin-subtext">
          Sets or overwrites the user&apos;s security PIN (used for purchases and sensitive actions).
          Does not change the login password or revoke sessions.
        </p>
        <div>
          <label class="mb-1 block text-xs font-medium text-admin-subtext">New PIN</label>
          <div class="relative">
            <input
              v-model="pin"
              :type="showPin ? 'text' : 'password'"
              inputmode="numeric"
              autocomplete="off"
              maxlength="8"
              class="admin-input pr-10"
              placeholder="4–8 digits"
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-admin-subtext hover:text-admin-text"
              @click="showPin = !showPin"
            >
              {{ showPin ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Confirm PIN</label>
          <div class="relative">
            <input
              v-model="confirmPin"
              :type="showConfirm ? 'text' : 'password'"
              inputmode="numeric"
              autocomplete="off"
              maxlength="8"
              class="admin-input pr-10"
              placeholder="Confirm PIN"
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-admin-subtext hover:text-admin-text"
              @click="showConfirm = !showConfirm"
            >
              {{ showConfirm ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>
        <ul class="space-y-1 text-xs">
          <li :class="ruleClass(rules.digits, pin.length > 0)">Must be 4 to 8 digits</li>
          <li :class="ruleClass(rules.match, confirmPin.length > 0)">PINs must match</li>
        </ul>
      </div>
    </template>
    <template #footer>
      <button type="button" class="admin-btn-secondary" @click="emit('close')">Cancel</button>
      <button type="button" class="admin-btn-primary" :disabled="!isValid" @click="handleSubmit">
        Set Security Password
      </button>
    </template>
  </BaseDialog>
</template>
