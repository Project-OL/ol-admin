<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AdminSidebar from '@/components/layout/AdminSidebar.vue'
import SupportNotificationBell from '@/components/layout/SupportNotificationBell.vue'
import { useAuthStore } from '@/stores/auth'
import { useSupportNotificationsStore } from '@/stores/supportNotifications'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifStore = useSupportNotificationsStore()
const sidebarOpen = ref(false)
const sidebarExpanded = ref(true)

const adminLabel = computed(() => {
  if (!auth.admin) return ''
  return auth.admin.displayName || auth.admin.email
})

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function toggleExpanded() {
  sidebarExpanded.value = !sidebarExpanded.value
}

function closeSidebarOnNavigate() {
  sidebarOpen.value = false
}

async function logout() {
  notifStore.stopPolling()
  await auth.logout()
  router.push('/login')
}

onMounted(() => {
  if (auth.isSuperAdmin || auth.isCustomerSupport) {
    notifStore.startPolling()
  }
})

onUnmounted(() => {
  notifStore.stopPolling()
})
</script>

<template>
  <div class="flex min-h-screen bg-admin-bg">
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
      @click="sidebarOpen = false"
    />

    <AdminSidebar
      :open="sidebarOpen"
      :expanded="sidebarExpanded"
      @navigate="closeSidebarOnNavigate"
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b border-admin-border bg-admin-surface/95 px-3 backdrop-blur sm:gap-2 sm:px-4"
      >
        <button
          type="button"
          class="admin-btn-secondary !px-2.5 !py-2 lg:hidden"
          aria-label="Toggle sidebar menu"
          @click="toggleSidebar"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <button
          type="button"
          class="admin-btn-secondary hidden !px-2.5 !py-2 lg:inline-flex"
          :aria-label="sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'"
          @click="toggleExpanded"
        >
          <svg
            class="h-5 w-5 transition-transform duration-300"
            :class="{ 'rotate-180': !sidebarExpanded }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.75"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <div class="ml-1 min-w-0 flex-1 sm:ml-2">
          <p class="truncate text-sm font-medium capitalize text-admin-text">
            {{ route.meta.title ?? route.name?.toString().replace(/-/g, ' ') ?? 'Admin' }}
          </p>
        </div>

        <SupportNotificationBell />

        <div v-if="auth.admin" class="hidden min-w-0 items-center gap-2 md:flex">
          <span class="max-w-[140px] truncate text-xs text-admin-subtext lg:max-w-[220px]">{{ adminLabel }}</span>
          <span class="shrink-0 rounded bg-admin-accent/15 px-2 py-0.5 text-xs text-admin-accent">{{ auth.admin.role }}</span>
        </div>

        <button
          type="button"
          class="admin-btn-secondary shrink-0 !px-2.5 text-xs sm:!px-3"
          aria-label="Logout"
          @click="logout"
        >
          <svg class="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span class="hidden sm:inline">Logout</span>
        </button>
      </header>

      <main class="admin-scrollbar flex-1 overflow-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>
