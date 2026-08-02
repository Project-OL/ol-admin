<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

defineProps<{
  open: boolean
  expanded: boolean
}>()

const emit = defineEmits<{
  navigate: []
}>()

const route = useRoute()
const auth = useAuthStore()

type NavItem = {
  to: string
  label: string
  icon: string
  roles: string[]
  viewName?: string
  exact?: boolean
  /** SUPER_ADMIN-only tooling; never shown when view-restricted */
  superAdminOnly?: boolean
}

const allNavItems: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', exact: true, roles: ['SUPER_ADMIN'], viewName: 'HomeView' },
  { to: '/admin/users', label: 'Users', icon: 'users', roles: ['SUPER_ADMIN'], viewName: 'UserListView' },
  {
    to: '/admin/agency',
    label: 'Agency',
    icon: 'agency',
    roles: ['SUPER_ADMIN'],
    viewName: 'AgencyListView',
  },
  {
    to: '/admin/messages',
    label: 'Messages',
    icon: 'messages',
    roles: ['SUPER_ADMIN'],
    viewName: 'PlatformMessagesView',
  },
  { to: '/admin/gifts', label: 'Gifts', icon: 'gifts', roles: ['SUPER_ADMIN'], viewName: 'GiftAdminView' },
  { to: '/admin/store', label: 'Store', icon: 'store', roles: ['SUPER_ADMIN'], viewName: 'StoreAdminView' },
  {
    to: '/admin/banners',
    label: 'Banners',
    icon: 'banners',
    roles: ['SUPER_ADMIN'],
    viewName: 'BannerAdminView',
  },
  {
    to: '/admin/custom-gifts',
    label: 'Custom Gifts',
    icon: 'customGifts',
    roles: ['SUPER_ADMIN'],
    viewName: 'CustomGiftAdminView',
  },
  {
    to: '/admin/support',
    label: 'Support',
    icon: 'support',
    roles: ['SUPER_ADMIN', 'CUSTOMER_SUPPORT', 'MODERATOR'],
    viewName: 'CustomerSupportView',
  },
  {
    to: '/admin/otp-audit',
    label: 'OTP Audit',
    icon: 'otp',
    roles: ['SUPER_ADMIN'],
    viewName: 'OtpAuditLogsView',
  },
  {
    to: '/admin/push-notifications',
    label: 'Push',
    icon: 'push',
    roles: ['SUPER_ADMIN'],
    viewName: 'PushNotificationsView',
  },
  {
    to: '/admin/ledger-audit',
    label: 'Ledger Audit',
    icon: 'ledger',
    roles: ['SUPER_ADMIN'],
    viewName: 'LedgerAuditView',
  },
  {
    to: '/admin/transactions',
    label: 'Transactions',
    icon: 'transactions',
    roles: ['SUPER_ADMIN'],
    viewName: 'TransactionsView',
  },
  {
    to: '/admin/views',
    label: 'Admin Views',
    icon: 'views',
    roles: ['SUPER_ADMIN'],
    superAdminOnly: true,
  },
]

const navItems = computed(() => {
  const role = auth.role

  if (auth.restricted) {
    return allNavItems.filter((item) => {
      if (item.superAdminOnly) return false
      if (!item.viewName) return false
      return auth.canAccessView(item.viewName)
    })
  }

  if (!role) return allNavItems.filter((i) => i.roles.includes('SUPER_ADMIN'))
  return allNavItems.filter((i) => i.roles.includes(role))
})

function isActive(item: NavItem) {
  if (item.exact) return route.path === item.to
  return route.path.startsWith(item.to)
}
</script>

<template>
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-admin-border bg-admin-surface transition-all duration-300 ease-in-out lg:static lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full',
      expanded ? 'lg:w-56' : 'lg:w-[4.5rem]',
    ]"
  >
    <div
      :class="[
        'flex h-14 shrink-0 items-center border-b border-admin-border px-4',
        !expanded && 'lg:justify-center lg:px-2',
      ]"
    >
      <div class="flex items-center gap-2 overflow-hidden">
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-admin-accent text-sm font-bold text-white"
        >
          A
        </div>
        <span
          :class="['truncate text-sm font-semibold text-admin-text transition-opacity', !expanded && 'lg:hidden']"
        >
          {{ auth.isCustomerSupport ? 'Support Portal' : 'Offoo Live' }}
          <div class="text-xs text-admin-subtext">Admin Management</div>
        </span>
      </div>
    </div>

    <nav class="flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :title="item.label"
        :class="[
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive(item)
            ? 'bg-admin-accent/15 text-admin-accent'
            : 'text-admin-subtext hover:bg-admin-bg hover:text-admin-text',
          !expanded && 'lg:justify-center lg:px-2',
        ]"
        @click="emit('navigate')"
      >
        <svg
          v-if="item.icon === 'home'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'users'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'agency'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'messages'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'gifts'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'store'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'banners'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'customGifts'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'support'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M18.364 5.636l-1.414 1.414A7.5 7.5 0 105.636 18.364l1.414-1.414A5.5 5.5 0 1116.95 7.05l1.414-1.414z"
          />
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 3h.01" />
        </svg>
        <svg
          v-else-if="item.icon === 'otp'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'push'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'ledger'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'transactions'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'views'"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <span :class="['truncate', !expanded && 'lg:hidden']">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
