export type PushEligibleUser = {
  userId: string
  username: string
  name: string
  publicId: string
  displayPublicId: string
  avatarUrl: string | null
  country: string | null
  status: string
  hasFcmToken: true
  fcmTokenUpdatedAt: string | null
}

export type ListPushUsersResponse = {
  users: PushEligibleUser[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

export type PushPayload = {
  title: string
  body: string
  /** FCM data map — values must be strings */
  data?: Record<string, string>
}

export type PushToUserResponse = { success: true }

export type PushBroadcastRequest = PushPayload & {
  userIds?: string[]
  country?: string
}

export type PushBroadcastResponse = {
  ok: true
  queued: true
  campaignId: string
}

export type PushDeliveryStatus = 'SENT' | 'FAILED' | 'SKIPPED'

export type PushDeliverySource =
  | 'ADMIN_SINGLE'
  | 'ADMIN_BROADCAST'
  | 'TRANSACTION'
  | 'NEW_MESSAGE'

export type PushTodayStats = {
  date: string
  timezone: 'UTC'
  sent: number
  failed: number
  skipped: number
  total: number
  bySource: Record<
    string,
    { sent: number; failed: number; skipped: number; total: number }
  >
}

export type PushDeliveryUser = {
  userId: string
  username: string
  name: string
  publicId: string
  displayPublicId: string
  avatarUrl: string | null
  country: string | null
  status: string
}

export type PushDelivery = {
  id: string
  status: PushDeliveryStatus
  source: PushDeliverySource
  campaignId: string | null
  title: string
  body: string
  data: Record<string, string> | null
  errorCode: string | null
  adminUserId: string | null
  createdAt: string
  user: PushDeliveryUser
}

export type ListPushDeliveriesResponse = {
  deliveries: PushDelivery[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}

export type ListPushUsersParams = {
  page?: number
  limit?: number
  country?: string
  q?: string
  activeOnly?: boolean
}

export type ListPushDeliveriesParams = {
  page?: number
  limit?: number
  status?: PushDeliveryStatus | ''
  source?: PushDeliverySource | ''
  campaignId?: string
  todayOnly?: boolean
}
