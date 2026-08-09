export type AdminUserLocationCurrent = {
  userId: string
  latitude: number | null
  longitude: number | null
  accuracyM: number | null
  locatedAt: string | null
}

export type AdminUserLocationSample = {
  id: string
  userId: string
  latitude: number
  longitude: number
  accuracyM: number | null
  source: string
  recordedAt: string
}

export type AdminUserLocations = {
  userId: string
  current: AdminUserLocationCurrent
  history: {
    items: AdminUserLocationSample[]
    nextCursor: string | null
    hasMore: boolean
  }
}

export type UserLocationsQuery = {
  limit?: number
  cursor?: string
}

export type AdminLocationFeedUser = {
  userId: string
  username: string
  displayName: string
  name: string
  publicId: string
  displayPublicId: string
  avatarUrl: string | null
  country: string | null
  currentLatitude: number | null
  currentLongitude: number | null
  lastLocatedAt: string | null
}

export type AdminLocationFeedItem = AdminUserLocationSample & {
  user: AdminLocationFeedUser
}

export type AdminLocationsPage = {
  items: AdminLocationFeedItem[]
  nextCursor: string | null
  hasMore: boolean
}

export type AdminLocationsQuery = {
  userId?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}
