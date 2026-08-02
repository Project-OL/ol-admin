export type CustomGiftRequestStatus = 'PENDING' | 'COMPLETED' | 'FAILED'

export type CustomGiftDurationMonths = 1 | 3

export interface CustomGiftPackage {
  durationMonths: CustomGiftDurationMonths
  validityDays: number
  coinCost: string
  label: string
}

/** Full feature config returned by GET and PUT */
export interface CustomGiftConfig {
  /** Legacy alias — same value as 1-month package */
  coinCost: string
  coinCost1Month: string
  coinCost3Months: string
  enabled: boolean
  description: string | null
  /** All duration package types (always length 2 today) */
  packages: CustomGiftPackage[]
  updatedAt: string
  updatedByAdminId: string | null
}

/** Partial body for PUT — at least one field required */
export interface UpdateCustomGiftConfigPayload {
  /** Legacy: writes 1-month price (and syncs `coinCost` column) */
  coinCost?: number | string
  coinCost1Month?: number | string
  coinCost3Months?: number | string
  enabled?: boolean
  description?: string | null
}

export interface CustomGiftLinkedGift {
  id: string
  name: string
  code: string
  displayImageUrl: string
}

export interface CustomGiftRequestUser {
  id: string
  username: string
  publicId: string
  name: string
  avatarUrl: string | null
  country: string | null
}

export interface CustomGiftRequestAdmin {
  id: string
  whatsappNumber: string
  note: string | null
  validityDays: number | null
  coinCost: string
  status: CustomGiftRequestStatus
  failureReason: string | null
  refunded: boolean
  gift: CustomGiftLinkedGift | null
  createdAt: string
  resolvedAt: string | null
  user: CustomGiftRequestUser
  adminNote: string | null
  refundLedgerEntryId: string | null
  resolvedByAdminId: string | null
  updatedAt: string
}

export interface CustomGiftRequestListResponse {
  requests: CustomGiftRequestAdmin[]
  total: number
  page: number
  limit: number
  countsByStatus: Record<CustomGiftRequestStatus, number>
}

export interface CustomGiftRequestListQuery {
  status?: CustomGiftRequestStatus
  userId?: string
  page?: number
  limit?: number
}

export interface CompleteCustomGiftPayload {
  giftId?: string
  adminNote?: string
}

export interface FailCustomGiftPayload {
  reason: string
  refund: boolean
  adminNote?: string
}
