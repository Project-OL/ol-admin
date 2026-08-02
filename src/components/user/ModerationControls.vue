<script setup lang="ts">
import { ref } from 'vue'
import { format } from 'date-fns'
import type { UserProfile } from '@/types/user'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import { useUserDetailStore } from '@/stores/userDetail'

const props = defineProps<{ user: UserProfile }>()
const store = useUserDetailStore()

const suspendDays = ref(7)
const suspendUntil = ref('')
const useUntilDate = ref(false)
const submitting = ref(false)

async function activate() {
  submitting.value = true
  try {
    await store.setUserStatus(props.user.id, { action: 'active' })
  } finally {
    submitting.value = false
  }
}

async function suspend() {
  submitting.value = true
  try {
    if (useUntilDate.value && suspendUntil.value) {
      await store.setUserStatus(props.user.id, {
        action: 'suspend',
        suspendedUntil: new Date(suspendUntil.value).toISOString(),
      })
    } else {
      await store.setUserStatus(props.user.id, {
        action: 'suspend',
        suspendDays: suspendDays.value,
      })
    }
  } finally {
    submitting.value = false
  }
}

async function ban() {
  submitting.value = true
  try {
    await store.setUserStatus(props.user.id, { action: 'ban' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="admin-card space-y-4">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">Account Status</h2>

    <div class="flex flex-wrap items-center gap-2">
      <StatusBadge :status="user.rawStatus ?? user.status" />
      <span v-if="user.suspendedUntil" class="text-xs text-admin-subtext">
        until {{ format(new Date(user.suspendedUntil), 'dd MMM yyyy HH:mm') }}
      </span>
      <button
        type="button"
        class="admin-btn-primary text-xs"
        :disabled="submitting"
        @click="activate"
      >
        Activate Account
      </button>
      <button
        type="button"
        class="admin-btn-danger text-xs"
        :disabled="submitting"
        @click="ban"
      >
        Ban User
      </button>
    </div>

    <div class="space-y-2 rounded-md border border-admin-border p-3">
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-admin-subtext">
          <input v-model="useUntilDate" type="checkbox" class="accent-admin-accent" />
          End date
        </label>
        <input
          v-if="useUntilDate"
          v-model="suspendUntil"
          type="datetime-local"
          class="admin-input w-auto py-1 text-xs"
        />
        <template v-else>
          <label
            v-for="days in [1, 7, 30, 365]"
            :key="days"
            class="flex cursor-pointer items-center gap-1 rounded-md border border-admin-border px-2 py-1 text-xs"
            :class="suspendDays === days ? 'border-admin-accent bg-admin-accent/10' : ''"
          >
            <input v-model="suspendDays" type="radio" :value="days" class="accent-admin-accent" />
            {{ days }}d
          </label>
        </template>
      </div>
      <button
        type="button"
        class="admin-btn-warn text-xs"
        :disabled="submitting"
        @click="suspend"
      >
        Suspend User
      </button>
    </div>
  </div>
</template>
