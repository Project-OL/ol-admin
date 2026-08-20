const ACTION_LABELS: Record<string, string> = {
  ADMIN_USER_UPDATED: 'Updated user details',
  ADMIN_USER_STATUS_CHANGED: 'Changed user status',
  ADMIN_USER_TAGS_UPDATED: 'Updated user tags',
  ADMIN_PASSWORD_RESET: 'Reset user password',
  ADMIN_AVATAR_REMOVED: 'Removed profile picture',
  ADMIN_BIO_REMOVED: 'Removed bio',
  ADMIN_IDENTITY_RESET: 'Reset display identity',
  ADMIN_POSTING_SUSPENDED: 'Suspended posting',
  ADMIN_POSTING_BANNED: 'Blocked posting',
  ADMIN_POSTING_RESTORED: 'Restored posting',
  ADMIN_POST_DELETED: 'Deleted post',
  ADMIN_DEVICE_BANNED: 'Banned device',
  ADMIN_DEVICE_UNBANNED: 'Unbanned device',
  ADMIN_DEVICE_LOGOUT_ALL: 'Logged out all devices',
  ADMIN_USER_RESTRICTION_APPLIED: 'Applied restriction (mute/ban live)',
  ADMIN_USER_RESTRICTION_CLEARED: 'Cleared restriction',
  ADMIN_LIVE_STREAM_STOP_REQUESTED: 'Stopped live stream',
  ADMIN_HOST_STREAM_SUSPENSION_CLEARED: 'Cleared host stream suspension',
  ADMIN_LIVE_PHOTO_REMOVED: 'Took down live photo',
  ADMIN_AGENCY_APPROVED: 'Approved agency',
  ADMIN_AGENCY_REJECTED: 'Rejected agency application',
  ADMIN_AGENCY_COMMISSION_TIER_SET: 'Set agency commission tier',
  ADMIN_AGENCY_PAYROLL_PRIVILEGE_SET: 'Set agency payroll privilege',
  ADMIN_AGENCY_HOST_ADDED: 'Added host to agency',
  ADMIN_AGENCY_HOSTS_TRANSFERRED: 'Transferred hosts',
  ADMIN_AGENCY_HOST_REMOVED: 'Removed host from agency',
  ADMIN_AGENCY_SUSPENDED: 'Suspended agency',
  ADMIN_AGENCY_UNPAUSED: 'Unpaused agency',
  ADMIN_AGENCY_BANNED: 'Banned agency',
  ADMIN_AGENCY_DELETED: 'Deleted agency',
  ADMIN_AGENCY_UNBARRED: 'Unbarred agency owner',
  WITHDRAWAL_MANUAL_ASSIGN: 'Assigned payroll to agency',
  WITHDRAWAL_REVERSED: 'Reverted withdrawal',
  WITHDRAWAL_PLATFORM_PAID_PROOF: 'Admin paid withdrawal (EPAY)',
  WITHDRAWAL_DISPUTE_RESOLVED_AGENT: 'Resolved dispute (favour agent)',
  WITHDRAWAL_DISPUTE_RESOLVED_HOST: 'Resolved dispute (favour host)',
  ADMIN_SYSTEM_MESSAGE: 'Sent system message',
  ADMIN_NOTIFICATION_MESSAGE: 'Sent notification message',
  ADMIN_NOTIFICATION_BROADCAST: 'Broadcast notification',
  ADMIN_PUSH_BROADCAST: 'Broadcast push notification',
  ADMIN_USER_WARNING: 'Warned user',
  ADMIN_GIFT_CREATED: 'Created gift',
  ADMIN_GIFT_UPDATED: 'Edited gift',
  ADMIN_GIFT_DISABLED: 'Disabled gift',
  ADMIN_GIFT_ENABLED: 'Enabled gift',
  ADMIN_GIFT_DELETED: 'Deleted gift',
  ADMIN_GIFT_CATEGORY_CREATED: 'Created gift category',
  ADMIN_GIFT_CATEGORY_UPDATED: 'Edited gift category',
  ADMIN_GIFT_CATEGORY_REORDERED: 'Reordered gift categories',
  ADMIN_GIFT_CATEGORY_DELETED: 'Deleted gift category',
  ADMIN_GIFT_GALLERY_CREATED: 'Created gift gallery section',
  ADMIN_GIFT_GALLERY_UPDATED: 'Edited gift gallery section',
  ADMIN_GIFT_GALLERY_REORDERED: 'Reordered gift gallery',
  ADMIN_GIFT_GALLERY_DELETED: 'Deleted gift gallery section',
  ADMIN_GIFT_GALLERY_GIFTS_ADDED: 'Added gifts to gallery',
  ADMIN_GIFT_GALLERY_GIFTS_REMOVED: 'Removed gifts from gallery',
  ADMIN_STORE_ITEM_CREATED: 'Created store item',
  ADMIN_STORE_ITEM_UPDATED: 'Edited store item',
  ADMIN_STORE_ITEM_DISABLED: 'Disabled store item',
  ADMIN_STORE_ITEM_ENABLED: 'Enabled store item',
  ADMIN_STORE_ITEM_DELETED: 'Deleted store item',
  ADMIN_BANNER_CREATED: 'Created banner',
  ADMIN_BANNER_UPDATED: 'Edited banner',
  ADMIN_BANNER_STOPPED: 'Stopped banner',
  ADMIN_BANNER_DELETED: 'Deleted banner',
  ADMIN_CUSTOM_GIFT_CONFIG_UPDATED: 'Changed custom gift config',
  ADMIN_CUSTOM_GIFT_COMPLETED: 'Completed custom gift request',
  ADMIN_CUSTOM_GIFT_FAILED: 'Failed custom gift request',
  ADMIN_SYSTEM_SETTINGS_UPDATED: 'Changed system settings',
  ADMIN_ACCOUNT_DELETION_CANCELLED: 'Cancelled account deletion',
  ADMIN_SUPPORT_TICKET_REPLY: 'Replied to support ticket',
  ADMIN_SUPPORT_TICKET_RESOLVE: 'Resolved support ticket',
  ADMIN_SUPPORT_TICKET_REJECT: 'Rejected support ticket',
  ADMIN_SUPPORT_TICKET_CLOSE: 'Closed support ticket',
  ADMIN_SUPPORT_TICKET_ASSIGN: 'Assigned support ticket',
  ADMIN_SUPPORT_TICKET_CLAIM: 'Claimed support ticket',
  ADMIN_SUPPORT_TICKET_PRIORITY: 'Changed ticket priority',
  ADMIN_SUPPORT_TICKET_NOTE: 'Added ticket note',
  ADMIN_SUPPORT_REPORT_REVIEW: 'Reviewed user report',
  ADMIN_SUPPORT_REPORT_ESCALATE: 'Escalated user report',
  ADMIN_LOGIN: 'Admin login',
  ADMIN_LOGOUT: 'Admin logout',
}

const GROUP_ORDER = [
  'Users',
  'Agency',
  'Payroll',
  'Messaging',
  'Live',
  'Gifts',
  'Store',
  'Banners',
  'Settings',
  'Support',
  'Other',
] as const

function groupForAction(actionType: string): (typeof GROUP_ORDER)[number] {
  if (
    actionType.startsWith('ADMIN_USER') ||
    actionType.startsWith('ADMIN_PASSWORD') ||
    actionType.startsWith('ADMIN_AVATAR') ||
    actionType.startsWith('ADMIN_BIO') ||
    actionType.startsWith('ADMIN_IDENTITY') ||
    actionType.startsWith('ADMIN_POST') ||
    actionType.startsWith('ADMIN_DEVICE')
  ) {
    return 'Users'
  }
  if (actionType.startsWith('ADMIN_AGENCY_')) return 'Agency'
  if (actionType.startsWith('WITHDRAWAL_')) return 'Payroll'
  if (
    actionType.startsWith('ADMIN_SYSTEM_MESSAGE') ||
    actionType.startsWith('ADMIN_NOTIFICATION') ||
    actionType.startsWith('ADMIN_PUSH') ||
    actionType === 'ADMIN_USER_WARNING'
  ) {
    return 'Messaging'
  }
  if (actionType.startsWith('ADMIN_LIVE') || actionType.startsWith('ADMIN_HOST_STREAM')) return 'Live'
  if (actionType.startsWith('ADMIN_GIFT') || actionType.startsWith('ADMIN_CUSTOM_GIFT')) return 'Gifts'
  if (actionType.startsWith('ADMIN_STORE_')) return 'Store'
  if (actionType.startsWith('ADMIN_BANNER_')) return 'Banners'
  if (actionType.startsWith('ADMIN_SYSTEM_SETTINGS') || actionType.startsWith('ADMIN_ACCOUNT_DELETION'))
    return 'Settings'
  if (actionType.startsWith('ADMIN_SUPPORT_')) return 'Support'
  return 'Other'
}

export function actionTypeLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType.replace(/_/g, ' ').toLowerCase()
}

export function groupActionTypes(actionTypes: string[]) {
  const byGroup = new Map<string, string[]>()
  for (const type of actionTypes) {
    const group = groupForAction(type)
    const list = byGroup.get(group) ?? []
    list.push(type)
    byGroup.set(group, list)
  }
  return GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({
    group,
    types: byGroup.get(group) ?? [],
  }))
}

export function destinationHref(resourceType: string | null, resourceId: string | null): string {
  if (!resourceType || !resourceId) return ''
  switch (resourceType) {
    case 'user':
    case 'agency':
      return `/admin/users/${resourceId}`
    case 'withdrawal':
      return `/admin/agency-payroll/w/${resourceId}`
    case 'support_ticket':
      return `/admin/support/tickets/${resourceId}`
    case 'gift':
    case 'gift_category':
    case 'gift_gallery':
      return '/admin/gifts'
    case 'store_item':
      return '/admin/store'
    case 'banner':
      return '/admin/banners'
    case 'custom_gift_request':
    case 'custom_gift_config':
      return '/admin/custom-gifts'
    case 'system_settings':
      return resourceId === 'account-deletion' ? '/admin/account-deletions' : '/admin/system-settings'
    case 'account_deletion':
      return '/admin/account-deletions'
    default:
      return ''
  }
}
