/**
 * Maps backend view names → admin panel routes.
 * Paths match this app's router (under /admin/…), not the integration doc's shorthand.
 */
export const VIEW_ROUTES: Record<string, string> = {
  HomeView: '/',
  UserListView: '/admin/users',
  UserDetailView: '/admin/users/:id',
  UserLocationsView: '/admin/locations',
  AgencyListView: '/admin/agency',
  AgencyDetailView: '/admin/agency/:id',
  AgencyPayrollView: '/admin/agency-payroll',
  AgencyPayrollAssignmentDetailView: '/admin/agency-payroll/:assignmentId',
  AgencyPayrollWithdrawalDetailView: '/admin/agency-payroll/w/:withdrawalId',
  PlatformMessagesView: '/admin/messages',
  GiftAdminView: '/admin/gifts',
  StoreAdminView: '/admin/store',
  BannerAdminView: '/admin/banners',
  CustomGiftAdminView: '/admin/custom-gifts',
  CustomerSupportView: '/admin/support',
  SupportTicketDetailView: '/admin/support/tickets/:ticketId',
  LiveModerationView: '/admin/live-moderation',
  OtpAuditLogsView: '/admin/otp-audit',
  PushNotificationsView: '/admin/push-notifications',
  LedgerAuditView: '/admin/ledger-audit',
  TransactionsView: '/admin/transactions',
  CurrencyView: '/admin/currency',
  AdminActivityView: '/admin/activity',
  SystemSettingsView: '/admin/system-settings',
  AccountDeletionsView: '/admin/account-deletions',
  FaceVerificationSessionsView: '/admin/face-verification-sessions',
}

/**
 * Detail screens that are part of a list/workbench flow.
 * Having the parent view assigned is enough to open the detail route in the panel
 * (API access still requires the detail endpoints unless they were merged into the parent).
 */
export const VIEW_PARENT_BY_DETAIL: Record<string, string> = {
  UserDetailView: 'UserListView',
  AgencyDetailView: 'AgencyListView',
  AgencyPayrollAssignmentDetailView: 'AgencyPayrollView',
  AgencyPayrollWithdrawalDetailView: 'AgencyPayrollView',
  SupportTicketDetailView: 'CustomerSupportView',
}

/** When assigning a parent workbench, always include these detail views too. */
export const VIEW_COMPANIONS: Record<string, string[]> = {
  UserListView: ['UserDetailView'],
  AgencyListView: ['AgencyDetailView'],
  AgencyPayrollView: ['AgencyPayrollAssignmentDetailView', 'AgencyPayrollWithdrawalDetailView'],
  CustomerSupportView: ['SupportTicketDetailView'],
}

/** Views kept in router/code but omitted from the sidebar and default landing. */
export const HIDDEN_NAV_VIEWS = new Set(['UserLocationsView'])

/** Sidebar / list routes keyed by view name (detail routes omitted). */
export const VIEW_NAV_PATHS: Record<string, string> = {
  HomeView: '/',
  UserListView: '/admin/users',
  UserLocationsView: '/admin/locations',
  AgencyListView: '/admin/agency',
  AgencyPayrollView: '/admin/agency-payroll',
  PlatformMessagesView: '/admin/messages',
  GiftAdminView: '/admin/gifts',
  StoreAdminView: '/admin/store',
  BannerAdminView: '/admin/banners',
  CustomGiftAdminView: '/admin/custom-gifts',
  CustomerSupportView: '/admin/support',
  LiveModerationView: '/admin/live-moderation',
  OtpAuditLogsView: '/admin/otp-audit',
  PushNotificationsView: '/admin/push-notifications',
  LedgerAuditView: '/admin/ledger-audit',
  TransactionsView: '/admin/transactions',
  CurrencyView: '/admin/currency',
  AdminActivityView: '/admin/activity',
  SystemSettingsView: '/admin/system-settings',
  AccountDeletionsView: '/admin/account-deletions',
  FaceVerificationSessionsView: '/admin/face-verification-sessions',
}

export function isViewAllowed(viewName: string, assigned: Set<string>): boolean {
  if (assigned.has(viewName)) return true
  const parent = VIEW_PARENT_BY_DETAIL[viewName]
  return Boolean(parent && assigned.has(parent))
}

/** Expand a selected set with companion detail views for list/workbench parents. */
export function withCompanionViews(names: Iterable<string>): string[] {
  const next = new Set(names)
  for (const name of [...next]) {
    for (const companion of VIEW_COMPANIONS[name] ?? []) {
      next.add(companion)
    }
  }
  return [...next]
}

export function firstAllowedPath(
  restricted: boolean,
  viewNames: Set<string>,
  roleFallback: string,
): string {
  if (!restricted) return roleFallback
  for (const [name, path] of Object.entries(VIEW_NAV_PATHS)) {
    if (HIDDEN_NAV_VIEWS.has(name)) continue
    if (viewNames.has(name)) return path
  }
  return roleFallback
}
