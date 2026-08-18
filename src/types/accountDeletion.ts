export type AccountDeletionStatus = 'open' | 'cancelled' | 'deleted' | 'all'

export type AccountDeletionSearchType = 'auto' | 'userId' | 'publicId' | 'displayId'

export type AccountDeletionConfig = {
  gracePeriodDays: number
  deletionPeriodDays: number
  updatedAt: string
}

export type AccountDeletionConfigUpdate = {
  gracePeriodDays?: number
  deletionPeriodDays?: number
}

export type AccountDeletionUser = {
  userId: string
  username: string
  name: string
  publicId: string
  displayPublicId: string
  status: string
  avatarUrl: string | null
  email: string | null
  phone: string | null
}

export type AccountDeletionRequest = {
  id: string
  status: Exclude<AccountDeletionStatus, 'all'>
  scheduledAt: string
  deactivationUntil: string
  deletionAt: string
  canReactivate: boolean
  reminderSentAt: string | null
  cancelledAt: string | null
  deletedAt: string | null
  reason: string | null
  ipAddress: string | null
  user: AccountDeletionUser
}

export type AccountDeletionListResponse = {
  page: number
  limit: number
  total: number
  items: AccountDeletionRequest[]
}

export type AccountDeletionListQuery = {
  page?: number
  limit?: number
  status?: AccountDeletionStatus
  q?: string
  qType?: AccountDeletionSearchType
}

export type AccountDeletionCancelResponse = {
  success: boolean
  message: string
  status: string
  cancelledAt: string
  userId: string
  request: AccountDeletionRequest | null
}
