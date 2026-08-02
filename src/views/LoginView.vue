<script setup lang="ts">
import { ref } from 'vue'
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

function homeForRole(role: string | null | undefined) {
  if (role === 'CUSTOMER_SUPPORT' || role === 'MODERATOR') return '/admin/support'
  return '/'
}

async function handleLogin() {
  error.value = ''
  if (!email.value.trim() || !password.value) {
    error.value = 'Email and password are required'
    return
  }

  try {
    const data = await auth.login(email.value.trim(), password.value)
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
        error.value = secs
          ? `Account temporarily locked. Try again in ${secs}s.`
          : 'Account temporarily locked. Try again later.'
      } else if (status === 429 || code === 'TOO_MANY_ATTEMPTS') {
        error.value = 'Too many attempts. Please wait and try again.'
      } else {
        error.value = 'Invalid email or password'
      }
    } else {
      error.value = 'Invalid email or password'
    }
    showToast('Login failed', 'error')
  }
}
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
          />
        </div>

        <p v-if="error" class="text-sm text-admin-danger">{{ error }}</p>

        <button type="submit" class="admin-btn-primary w-full py-2.5" :disabled="auth.loading">
          {{ auth.loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>
