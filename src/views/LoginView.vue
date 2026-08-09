<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { showToast } from '@/utils/toast'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const lockRemaining = ref(0)
let lockTimer: ReturnType<typeof setInterval> | null = null

const isLockedOut = computed(() => lockRemaining.value > 0)

const lockCountdownLabel = computed(() => {
  const secs = lockRemaining.value
  if (secs <= 0) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
})

function clearLockTimer() {
  if (lockTimer) {
    clearInterval(lockTimer)
    lockTimer = null
  }
}

function startLockCountdown(seconds: number) {
  clearLockTimer()
  lockRemaining.value = Math.max(0, Math.ceil(seconds))
  error.value =
    lockRemaining.value > 0
      ? `Account temporarily locked. Try again in ${lockCountdownLabel.value}.`
      : 'Account temporarily locked. Try again later.'
  if (lockRemaining.value <= 0) return
  lockTimer = setInterval(() => {
    lockRemaining.value -= 1
    if (lockRemaining.value <= 0) {
      clearLockTimer()
      error.value = 'Lock expired — you can try signing in again.'
      return
    }
    error.value = `Account temporarily locked. Try again in ${lockCountdownLabel.value}.`
  }, 1000)
}

function homeForRole(role: string | null | undefined) {
  if (role === 'CUSTOMER_SUPPORT' || role === 'MODERATOR') return '/admin/support'
  return '/'
}

async function handleLogin() {
  error.value = ''
  if (isLockedOut.value) {
    error.value = `Account temporarily locked. Try again in ${lockCountdownLabel.value}.`
    return
  }
  if (!email.value.trim() || !password.value) {
    error.value = 'Email and password are required'
    return
  }

  try {
    const data = await auth.login(email.value.trim(), password.value)
    clearLockTimer()
    lockRemaining.value = 0
    const redirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : homeForRole(data.admin.role)
    // CSA should land on workbench even if redirect was "/"
    if (data.admin.role === 'CUSTOMER_SUPPORT' && (redirect === '/' || !redirect)) {
      router.push('/admin/support')
    } else {
      router.push(redirect)
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      const code = (err.response?.data as { code?: string })?.code
      const details = (err.response?.data as { details?: { retryAfter?: number } })?.details
      if (status === 423 || code === 'ADMIN_ACCOUNT_LOCKED') {
        const secs = details?.retryAfter
        if (typeof secs === 'number' && secs > 0) {
          startLockCountdown(secs)
        } else {
          error.value = 'Account temporarily locked. Try again later.'
        }
      } else if (status === 403 || code === 'ADMIN_IP_FORBIDDEN') {
        error.value =
          'This account cannot sign in from your current network. Contact a super admin to whitelist your IP.'
      } else if (status === 429 || code === 'TOO_MANY_ATTEMPTS') {
        const retryHeader = err.response?.headers?.['retry-after']
        const secs = Number(retryHeader)
        if (Number.isFinite(secs) && secs > 0) {
          startLockCountdown(secs)
          error.value = `Too many attempts. Wait ${lockCountdownLabel.value}.`
        } else {
          error.value = 'Too many attempts. Please wait and try again.'
        }
      } else {
        error.value = 'Invalid email or password'
      }
    } else {
      error.value = 'Invalid email or password'
    }
    showToast('Login failed', 'error')
  }
}

onBeforeUnmount(clearLockTimer)
onMounted(() => {
  clearLockTimer()
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-admin-bg px-3 py-8 sm:px-4">
    <div class="admin-card w-full max-w-md shadow-xl shadow-black/20">
      <div class="mb-6 text-center">
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-admin-accent text-lg font-bold text-white"
        >
          A
        </div>
        <h1 class="text-xl font-semibold sm:text-2xl">Admin Login</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Sign in as super admin or customer support
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="handleLogin">
        <div>
          <label class="mb-1 block text-xs font-medium text-admin-subtext">Email</label>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            class="admin-input"
            placeholder="admin@example.com"
            :disabled="isLockedOut"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-admin-subtext">Password</label>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="admin-input"
            placeholder="••••••••"
            :disabled="isLockedOut"
          />
        </div>

        <p v-if="error" class="text-sm text-admin-danger">{{ error }}</p>
        <p v-if="isLockedOut" class="text-xs text-admin-muted">
          This is a temporary login lockout (wrong password), not a suspended/disabled account.
        </p>

        <button
          type="submit"
          class="admin-btn-primary w-full py-2.5"
          :disabled="auth.loading || isLockedOut"
        >
          {{
            auth.loading
              ? 'Signing in...'
              : isLockedOut
                ? `Locked (${lockCountdownLabel})`
                : 'Sign In'
          }}
        </button>
      </form>
    </div>
  </div>
</template>
