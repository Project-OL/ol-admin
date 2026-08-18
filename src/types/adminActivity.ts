export type AdminActivityAdminBrief = {
  adminUserId: string
  email: string
  displayName: string
  role: string
}

export type AdminActivityUserBrief = {
  userId: string
  username: string
  name: string
  displayName: string
  publicId: string
  displayPublicId: string
  avatarUrl: string | null
}

export type AdminActivityDestination = {
  label: string
  resourceType: string | null
  resourceId: string | null
}

export type AdminActivityEntry = {
  id: string
  actionType: string
  actionStatus: string
  createdAt: string
  ipAddress: string | null
  userAgent: string | null
  deviceId: string | null
  admin: AdminActivityAdminBrief | null
  targetUser: AdminActivityUserBrief | null
  destination: AdminActivityDestination
  actionDetails: unknown
}

export type AdminActivityListResponse = {
  entries: AdminActivityEntry[]
  nextCursor: string | null
  hasMore: boolean
}

export type AdminActivityListQuery = {
  adminUserId?: string
  adminEmail?: string
  targetUserId?: string
  actionType?: string
  ipAddress?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export type AdminActivityActionTypesResponse = {
  actionTypes: string[]
}

export type AdminActivityAdminsResponse = {
  admins: AdminActivityAdminBrief[]
}
