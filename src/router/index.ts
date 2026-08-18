import { createRouter, createWebHistory } from 'vue-router'
import { getAccessToken } from '@/api/client'
import { firstAllowedPath } from '@/constants/viewRoutes'
import { useAuthStore } from '@/stores/auth'
import AdminLayout from '../layouts/AdminLayout.vue'
import HomeView from '../views/HomeView.vue'
import UserListView from '../views/UserListView.vue'
import UserDetailView from '../views/UserDetailView.vue'
import type { AdminRole } from '@/types/api'

const useMock = import.meta.env.VITE_USE_MOCK === 'true'

function homeForRole(role: AdminRole | null | undefined) {
  if (role === 'CUSTOMER_SUPPORT' || role === 'MODERATOR') return '/admin/support'
  return '/'
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true, title: 'Login' },
    },
    {
      path: '/',
      component: AdminLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: HomeView,
          meta: { title: 'Home', roles: ['SUPER_ADMIN'], viewName: 'HomeView' },
        },
        {
          path: 'admin/users',
          name: 'user-list',
          component: UserListView,
          meta: { title: 'Users', roles: ['SUPER_ADMIN'], viewName: 'UserListView' },
        },
        {
          path: 'admin/users/:id',
          name: 'user-detail',
          component: UserDetailView,
          meta: { title: 'User Detail', roles: ['SUPER_ADMIN'], viewName: 'UserDetailView' },
        },
        {
          path: 'admin/locations',
          name: 'user-locations',
          component: () => import('../views/UserLocationsView.vue'),
          meta: { title: 'Locations', roles: ['SUPER_ADMIN'], viewName: 'UserLocationsView' },
        },
        {
          path: 'admin/agency',
          name: 'agency-list',
          component: () => import('../views/AgencyListView.vue'),
          meta: { title: 'Agency', roles: ['SUPER_ADMIN'], viewName: 'AgencyListView' },
        },
        {
          path: 'admin/agency-payroll',
          name: 'agency-payroll',
          component: () => import('../views/AgencyPayrollView.vue'),
          meta: { title: 'Payroll', roles: ['SUPER_ADMIN'], viewName: 'AgencyPayrollView' },
        },
        {
          path: 'admin/agency-payroll/w/:withdrawalId',
          name: 'agency-payroll-withdrawal',
          component: () => import('../views/AgencyPayrollWithdrawalDetailView.vue'),
          meta: {
            title: 'Platform Withdrawal',
            roles: ['SUPER_ADMIN'],
            viewName: 'AgencyPayrollWithdrawalDetailView',
          },
        },
        {
          path: 'admin/agency-payroll/:assignmentId',
          name: 'agency-payroll-detail',
          component: () => import('../views/AgencyPayrollAssignmentDetailView.vue'),
          meta: {
            title: 'Payroll Assignment',
            roles: ['SUPER_ADMIN'],
            viewName: 'AgencyPayrollAssignmentDetailView',
          },
        },
        {
          path: 'admin/agency/:id',
          name: 'agency-detail',
          component: () => import('../views/AgencyDetailView.vue'),
          meta: { title: 'Agency Detail', roles: ['SUPER_ADMIN'], viewName: 'AgencyDetailView' },
        },
        {
          path: 'admin/messages',
          name: 'platform-messages',
          component: () => import('../views/PlatformMessagesView.vue'),
          meta: {
            title: 'Platform Messages',
            roles: ['SUPER_ADMIN'],
            viewName: 'PlatformMessagesView',
          },
        },
        {
          path: 'admin/gifts',
          name: 'gift-admin',
          component: () => import('../views/GiftAdminView.vue'),
          meta: { title: 'Gifts', roles: ['SUPER_ADMIN'], viewName: 'GiftAdminView' },
        },
        {
          path: 'admin/store',
          name: 'store-admin',
          component: () => import('../views/StoreAdminView.vue'),
          meta: { title: 'Store', roles: ['SUPER_ADMIN'], viewName: 'StoreAdminView' },
        },
        {
          path: 'admin/banners',
          name: 'banner-admin',
          component: () => import('../views/BannerAdminView.vue'),
          meta: { title: 'Banners', roles: ['SUPER_ADMIN'], viewName: 'BannerAdminView' },
        },
        {
          path: 'admin/custom-gifts',
          name: 'custom-gift-admin',
          component: () => import('../views/CustomGiftAdminView.vue'),
          meta: { title: 'Custom Gifts', roles: ['SUPER_ADMIN'], viewName: 'CustomGiftAdminView' },
        },
        {
          path: 'admin/support',
          name: 'customer-support',
          component: () => import('../views/CustomerSupportView.vue'),
          meta: {
            title: 'Customer Support',
            roles: ['SUPER_ADMIN', 'CUSTOMER_SUPPORT', 'MODERATOR'],
            viewName: 'CustomerSupportView',
          },
        },
        {
          path: 'admin/support/tickets/:ticketId',
          name: 'support-ticket-detail',
          component: () => import('../views/SupportTicketDetailView.vue'),
          meta: {
            title: 'Ticket',
            roles: ['SUPER_ADMIN', 'CUSTOMER_SUPPORT'],
            viewName: 'SupportTicketDetailView',
          },
        },
        {
          path: 'admin/live-moderation',
          name: 'live-moderation',
          component: () => import('../views/LiveModerationView.vue'),
          meta: {
            title: 'Live Moderation',
            roles: ['SUPER_ADMIN', 'CUSTOMER_SUPPORT', 'MODERATOR'],
            viewName: 'LiveModerationView',
          },
        },
        {
          path: 'admin/otp-audit',
          name: 'otp-audit-logs',
          component: () => import('../views/OtpAuditLogsView.vue'),
          meta: { title: 'OTP Audit Logs', roles: ['SUPER_ADMIN'], viewName: 'OtpAuditLogsView' },
        },
        {
          path: 'admin/push-notifications',
          name: 'push-notifications',
          component: () => import('../views/PushNotificationsView.vue'),
          meta: {
            title: 'Push Notifications',
            roles: ['SUPER_ADMIN'],
            viewName: 'PushNotificationsView',
          },
        },
        {
          path: 'admin/ledger-audit',
          name: 'ledger-audit',
          component: () => import('../views/LedgerAuditView.vue'),
          meta: {
            title: 'Ledger & VIP Audit',
            roles: ['SUPER_ADMIN'],
            viewName: 'LedgerAuditView',
          },
        },
        {
          path: 'admin/transactions',
          name: 'transactions',
          component: () => import('../views/TransactionsView.vue'),
          meta: {
            title: 'Transactions',
            roles: ['SUPER_ADMIN'],
            viewName: 'TransactionsView',
          },
        },
        {
          path: 'admin/currency',
          name: 'currency',
          component: () => import('../views/CurrencyView.vue'),
          meta: {
            title: 'Currency',
            roles: ['SUPER_ADMIN'],
            viewName: 'CurrencyView',
          },
        },
        {
          path: 'admin/activity',
          name: 'admin-activity',
          component: () => import('../views/AdminActivityView.vue'),
          meta: {
            title: 'Admin Activity',
            roles: ['SUPER_ADMIN'],
            viewName: 'AdminActivityView',
          },
        },
        {
          path: 'admin/system-settings',
          name: 'system-settings',
          component: () => import('../views/SystemSettingsView.vue'),
          meta: {
            title: 'System Settings',
            roles: ['SUPER_ADMIN'],
            viewName: 'SystemSettingsView',
          },
        },
        {
          path: 'admin/account-deletions',
          name: 'account-deletions',
          component: () => import('../views/AccountDeletionsView.vue'),
          meta: {
            title: 'Account Deletion',
            roles: ['SUPER_ADMIN'],
            viewName: 'AccountDeletionsView',
          },
        },
        {
          path: 'admin/views',
          name: 'admin-views',
          component: () => import('../views/AdminViewsView.vue'),
          meta: { title: 'Admin Views', roles: ['SUPER_ADMIN'] },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) await auth.initialize()

  if (to.meta.public) {
    if (useMock || getAccessToken()) {
      if (to.path === '/login' && (useMock || getAccessToken())) {
        return { path: homeForRole(auth.role) }
      }
    }
    return true
  }

  const needsAuth = to.matched.some((r) => r.meta.requiresAuth)
  if (needsAuth && !useMock && !getAccessToken()) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  const fallback = firstAllowedPath(auth.restricted, auth.myViewNames, homeForRole(auth.role))
  const viewName = to.meta.viewName as string | undefined
  const roles = to.meta.roles as AdminRole[] | undefined

  if (auth.restricted && !useMock) {
    if (viewName && !auth.canAccessView(viewName)) {
      return { path: fallback }
    }
    // Routes without a viewName (e.g. catalog management) stay role-gated
    if (!viewName && roles?.length && auth.role && !roles.includes(auth.role)) {
      return { path: fallback }
    }
  } else if (roles?.length && auth.role && !roles.includes(auth.role) && !useMock) {
    return { path: homeForRole(auth.role) }
  }

  // Legacy: unrestricted CSA lands on support, not home
  if (to.name === 'home' && auth.role === 'CUSTOMER_SUPPORT') {
    if (auth.restricted) {
      if (!auth.canAccessView('HomeView')) return { path: fallback }
    } else {
      return { path: '/admin/support' }
    }
  }
})

export default router
