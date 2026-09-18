<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDistanceToNow } from 'date-fns'
import { useSuperAdminNotificationsStore } from '@/stores/superAdminNotifications'
import { useAuthStore } from '@/stores/auth'
import type { ModerationNotificationType } from '@/types/api'

const router = useRouter()
const auth = useAuthStore()
const store = useSuperAdminNotificationsStore()
const open = ref(false)

const ACTION_LABEL: Record<ModerationNotificationType, string> = {
  LIVE_CHAT_MUTE: 'Muted live chat',
  LIVE_AUDIO_MUTE: 'Muted live audio',
  MESSAGING_DISABLE: 'Disabled messaging',
  PROFILE_PICTURE_REMOVED: 'Removed profile picture',
}

async function toggle() {
  open.value = !open.value
  if (open.value) await store.loadNotifications(true)
}

async function openNotification(id: string, userId: string) {
  await store.markRead([id])
  open.value = false
  router.push(`/admin/users/${userId}`)
}

async function markAllRead() {
  await store.markRead()
}

function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('[data-super-notif-bell]')) open.value = false
}

onMounted(() => {
  if (auth.isSuperAdmin) {
    store.startPolling()
  }
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  store.stopPolling()
})
</script>

<template>
  <div v-if="auth.isSuperAdmin" data-super-notif-bell class="relative">
    <button
      type="button"
      class="admin-btn-secondary relative !px-2.5 !py-2"
      aria-label="Moderation notifications"
      @click.stop="toggle"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      <span
        v-if="store.badge.unreadCount > 0"
        class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-admin-danger px-1 text-[10px] font-bold text-white"
      >
        {{ store.badge.unreadCount > 99 ? '99+' : store.badge.unreadCount }}
      </span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-admin-border bg-admin-surface shadow-xl"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-admin-border px-3 py-2">
        <p class="text-sm font-medium">Moderation actions</p>
        <button
          v-if="store.badge.unreadCount"
          type="button"
          class="text-xs text-admin-accent"
          @click="markAllRead"
        >
          Mark all read
        </button>
      </div>
      <div class="max-h-80 overflow-y-auto">
        <button
          v-for="n in store.notifications"
          :key="n.id"
          type="button"
          class="flex w-full flex-col gap-0.5 border-b border-admin-border/50 px-3 py-2.5 text-left hover:bg-admin-bg/60"
          @click="openNotification(n.id, n.targetUser.userId)"
        >
          <p class="text-sm">
            {{ ACTION_LABEL[n.actionType] }}
            <span class="text-admin-subtext">— {{ n.targetUser.name || n.targetUser.username }}</span>
          </p>
          <p v-if="n.reason" class="text-xs text-admin-muted">Reason: {{ n.reason }}</p>
          <p class="text-[10px] text-admin-muted">
            {{ n.restrictedUntil ? `Until ${new Date(n.restrictedUntil).toLocaleString()}` : 'Immediate' }}
            · by {{ n.performedByAdminId }}
            · {{ formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) }}
          </p>
        </button>
        <p
          v-if="!store.loadingNotifications && !store.notifications.length"
          class="px-3 py-8 text-center text-xs text-admin-muted"
        >
          No unread moderation actions
        </p>
        <p v-if="store.loadingNotifications" class="px-3 py-6 text-center text-xs text-admin-muted">
          Loading…
        </p>
      </div>
    </div>
  </div>
</template>
