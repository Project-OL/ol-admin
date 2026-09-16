export type RewardClaimType = 'NORMAL_HOST' | 'ROYAL_HOST' | 'LIVESTREAM_STREAK'

export type RewardClaim = {
  type: RewardClaimType
  typeLabel: string
  date: string
  pointsAmount: string
  ledgerEntryId: string
  claimedAt: string
  reverted: boolean
}

export type RewardClaimUser = {
  userId: string
  username: string
  country: string | null
  publicId: string
  totalPoints: string
  claimCount: number
  claims: RewardClaim[]
}

export type ListRewardClaimsQuery = {
  country?: string
  type?: RewardClaimType
  agencyUserId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export type ListRewardClaimsResponse = {
  users: RewardClaimUser[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export type BulkDebitPointsResult = {
  succeeded: number
  failed: number
  results: { userId: string; ok: boolean; error?: string }[]
}
