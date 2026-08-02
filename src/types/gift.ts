export type GiftAdminStatus = 'active' | 'disabled'

export interface GiftAnalytics {
  totalGifts: number
  totalActiveGifts: number
  totalDisabledGifts: number
  totalGiftsSentAllTime: number
  totalGiftsSentToday: number
  totalGiftRevenueAllTime: number
  todayGiftRevenue: number
  todayGiftRevenueChangePercent: number | null
  monthGiftRevenue: number
  mostSentGifts: Array<{
    giftId: string
    name: string
    code: string
    displayImageUrl: string
    coinCost: number
    timesSent: number
    revenue: number
  }>
}

export interface GiftAdminListItem {
  id: string
  name: string
  code: string
  displayImageUrl: string
  effectUrl: string | null
  category: { id: string; name: string; slug: string } | null
  coinCost: number
  displayOrder: number
  vipOnly: boolean
  timesSent: number
  status: GiftAdminStatus
  createdAt: string
}

export interface GiftListResponse {
  items: GiftAdminListItem[]
  total: number
  page: number
  limit: number
}

export interface GiftCategoryAdmin {
  id: string
  name: string
  slug: string
  displayOrder: number
  status: 'active' | 'hidden'
  giftCount: number
  createdAt: string
}

export interface GalleryGiftItem {
  itemId: string
  giftId: string
  name: string
  code: string
  displayImageUrl: string
  coinCost: number
  sortOrder: number
}

export interface GalleryCategoryAdmin {
  id: string
  name: string
  displayOrder: number
  status: 'active' | 'hidden'
  enabledAt: string | null
  giftCount: number
  gifts: GalleryGiftItem[]
}

export interface GiftListQuery {
  status?: 'all' | 'active' | 'disabled'
  categoryId?: string
  search?: string
  minPrice?: number
  maxPrice?: number
  page?: number
  limit?: number
}

export interface CreateGiftPayload {
  name: string
  code: string
  coinCost: number
  displayImageUrl: string
  effectUrl?: string | null
  categoryId?: string | null
  displayOrder?: number
  vipOnly?: boolean
  isActive?: boolean
}

export interface PatchGiftPayload {
  name?: string
  code?: string
  coinCost?: number
  displayImageUrl?: string
  effectUrl?: string | null
  categoryId?: string | null
  displayOrder?: number
  vipOnly?: boolean
  isActive?: boolean
}

export interface CreateGiftCategoryPayload {
  name: string
  slug: string
  displayOrder?: number
  isActive?: boolean
}

export interface PatchGiftCategoryPayload {
  name?: string
  slug?: string
  displayOrder?: number
  isActive?: boolean
}

export interface CreateGalleryCategoryPayload {
  name: string
  displayOrder?: number
  enabledAt?: string | null
  isActive?: boolean
}

export interface PatchGalleryCategoryPayload {
  name?: string
  displayOrder?: number
  enabledAt?: string | null
  isActive?: boolean
}
