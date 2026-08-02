export type BannerStatus = 'ACTIVE' | 'SCHEDULED' | 'COMPLETED' | 'STOPPED'

export type BannerListStatusFilter = 'active' | 'scheduled' | 'completed' | 'stopped' | 'all'

export interface BannerAdmin {
  id: string
  title: string
  imageUrl: string
  position: string
  startAt: string
  endAt: string
  enabled: boolean
  status: BannerStatus
  createdByAdminId: string | null
  createdAt: string
  updatedAt: string
}

export interface BannerListResponse {
  banners: BannerAdmin[]
  total: number
  page: number
  limit: number
}

export interface BannerListQuery {
  status?: BannerListStatusFilter
  position?: string
  page?: number
  limit?: number
}

export interface BannerUploadUrlResponse {
  uploadUrl: string
  key: string
  publicUrl: string
  contentType: string
  expiresIn: number
  role?: string
}

export interface CreateBannerPayload {
  title: string
  imageUrl: string
  position: string
  startAt: string
  endAt?: string
  validityDays?: number
  enabled?: boolean
}

export interface PatchBannerPayload {
  title?: string
  imageUrl?: string
  position?: string
  startAt?: string
  endAt?: string
  validityDays?: number
  enabled?: boolean
}
