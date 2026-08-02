<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDistanceToNow } from 'date-fns'
import { useSupportNotificationsStore } from '@/stores/supportNotifications'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const store = useSupportNotificationsStore()
const open = ref(false)

async function toggle() {
  open.value = !open.value
  if (open.value) await store.loadNotifications(true)
}

async function openNotification(id: string, ticketId?: string | null, reportId?: string | null) {
  await store.markRead([id])
  open.value = false
  if (ticketId) {
    router.push('/admin/support/tickets/' + ticketId)
  } else if (reportId) {
    router.push({ path: '/admin/support', query: { tab: 'reports', reportId } })
  } else {
    router.push('/admin/support')
  }
}

async function markAllRead() {
  await store.markRead()
}

function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('[data-notif-bell]')) open.value = false
}

onMounted(() => {
  if (auth.canAccessSupport && auth.role !== 'MODERATOR') {
    store.startPolling()
  }
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div v-if="auth.isSuperAdmin || auth.isCustomerSupport" data-notif-bell class="relative">
    <button
      type="button"
      class="admin-btn-secondary relative !px-2.5 !py-2"
      aria-label="Notifications"
      @click.stop="toggle"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
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
      class="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-admin-border bg-admin-surface shadow-xl"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-admin-border px-3 py-2">
        <p class="text-sm font-medium">Notifications</p>
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
          @click="openNotification(n.id, n.ticket?.ticketId, n.reportId)"
        >
          <p class="text-sm">{{ n.message }}</p>
          <p class="text-[10px] text-admin-muted">
            {{ n.type }} · {{ formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) }}
          </p>
        </button>
        <p
          v-if="!store.loadingNotifications && !store.notifications.length"
          class="px-3 py-8 text-center text-xs text-admin-muted"
        >
          No unread notifications
        </p>
        <p v-if="store.loadingNotifications" class="px-3 py-6 text-center text-xs text-admin-muted">
          Loading…
        </p>
      </div>
    </div>
  </div>
</template>
