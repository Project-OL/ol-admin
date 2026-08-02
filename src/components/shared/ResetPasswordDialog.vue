<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  close: []
  confirm: [password: string]
}>()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)

const rules = computed(() => ({
  required: password.value.length > 0,
  minLength: password.value.length >= 8,
  uppercase: /[A-Z]/.test(password.value),
  lowercase: /[a-z]/.test(password.value),
  number: /\d/.test(password.value),
  special: /[!@#$%^&*]/.test(password.value),
  match: password.value === confirmPassword.value && confirmPassword.value.length > 0,
}))

const isValid = computed(() => Object.values(rules.value).every(Boolean))

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      password.value = ''
      confirmPassword.value = ''
      showPassword.value = false
      showConfirm.value = false
    }
  },
)

function handleSubmit() {
  if (!isValid.value) return
  emit('confirm', password.value)
}

function ruleClass(passed: boolean, touched: boolean) {
  if (!touched) return 'text-admin-subtext'
  return passed ? 'text-admin-success' : 'text-admin-danger'
}
</script>

<template>
  <BaseDialog :open="open" title="Reset Password" @close="emit('close')">
    <template #body>
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-xs font-medium text-admin-subtext">New Password</label>
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="admin-input pr-10"
              placeholder="Enter new password"
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-admin-subtext hover:text-admin-text"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-admin-subtext">Confirm Password</label>
          <div class="relative">
            <input
              v-model="confirmPassword"
              :type="showConfirm ? 'text' : 'password'"
              class="admin-input pr-10"
              placeholder="Confirm new password"
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
          <li :class="ruleClass(rules.minLength, password.length > 0)">At least 8 characters</li>
          <li :class="ruleClass(rules.uppercase, password.length > 0)">At least 1 uppercase letter</li>
          <li :class="ruleClass(rules.lowercase, password.length > 0)">At least 1 lowercase letter</li>
          <li :class="ruleClass(rules.number, password.length > 0)">At least 1 number</li>
          <li :class="ruleClass(rules.special, password.length > 0)">
            At least 1 special character (!@#$%^&*)
          </li>
          <li :class="ruleClass(rules.match, confirmPassword.length > 0)">Passwords must match</li>
        </ul>
      </div>
    </template>
    <template #footer>
      <button type="button" class="admin-btn-secondary" @click="emit('close')">Cancel</button>
      <button type="button" class="admin-btn-primary" :disabled="!isValid" @click="handleSubmit">
        Reset Password
      </button>
    </template>
  </BaseDialog>
</template>
