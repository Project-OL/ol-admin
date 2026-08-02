export type StoreItemCategory = 'RIDE' | 'AVATAR_FRAME' | 'CHAT_BUBBLE' | 'PROFILE_CARD'

export interface StoreAnalytics {
  totalStoreItems: number
  activeStoreItems: number
  disabledStoreItems: number
  totalPurchasesToday: number
  totalItemTypes: number
  itemsPerType: Array<{ category: StoreItemCategory; count: number }>
}

export interface StoreAdminListItem {
  id: string
  name: string
  description: string | null
  category: StoreItemCategory
  displayImageUrl: string
  effectUrl: string | null
  validityDays: number
  coinCost: number
  purchaseCount: number
  sortOrder: number
  status: 'active' | 'disabled'
  createdAt: string
}

export interface StoreListResponse {
  items: StoreAdminListItem[]
  total: number
  page: number
  limit: number
}

export interface StoreListQuery {
  status?: 'all' | 'active' | 'disabled'
  category?: StoreItemCategory
  minPrice?: number
  maxPrice?: number
  search?: string
  page?: number
  limit?: number
}

export interface CreateStoreItemPayload {
  name: string
  description?: string | null
  category: StoreItemCategory
  coinCost: number
  validityDays: number
  displayImageUrl: string
  effectUrl?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface PatchStoreItemPayload {
  name?: string
  description?: string | null
  category?: StoreItemCategory
  coinCost?: number
  validityDays?: number
  displayImageUrl?: string
  effectUrl?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface UserStoreOwnedItem {
  userStoreItemId: string
  isApplied: boolean
  isActive: boolean
  expiresAt: string
  purchasedById: string
  coinsPaid: number
  item: {
    id: string
    name: string
    category: StoreItemCategory
    coinCost: number
    validityDays: number
    displayImageUrl: string
    effectUrl: string | null
  }
}

export interface UserStoreSummary {
  ownedItems: UserStoreOwnedItem[]
  ownedRarePublicIds: unknown[]
  wearingItems: Record<string, unknown>
}

export const STORE_CATEGORIES: StoreItemCategory[] = [
  'RIDE',
  'AVATAR_FRAME',
  'CHAT_BUBBLE',
  'PROFILE_CARD',
]
