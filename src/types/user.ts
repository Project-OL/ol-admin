export type UserStatus = 'active' | 'inactive' | 'banned' | 'suspended'
export type TransactionStatus = 'success' | 'pending' | 'failed'
export type FaceVerificationStatus = 'verified' | 'pending' | 'failed' | 'none'

export interface DeviceInfo {
  id: string
  name?: string
  platform?: string
  ipAddress?: string
  lastActiveAt?: string
  isBanned: boolean
}

export interface UserProfile {
  id: string
  name: string
  avatar?: string
  vip: boolean
  status: UserStatus
  rawStatus?: string
  suspendedUntil?: string | null
  wealthLevel: number
  streamLevel: number
  walletCoins: number
  points: number
  totalEarnings: number
  totalPoints: number
  totalRechargeCoin: number
  lastActive: string
  mobile?: string
  email?: string
  gender?: string
  country?: string
  city?: string
  tags: string[]
  registrationDate: string
  lastLogin: string
  inAgency: boolean
  agencyName?: string
  ipAddress?: string
  deviceName?: string
  deviceId?: string
  coinsFrozen: boolean
  tradingCoinsFrozen?: boolean
  pointsFrozen: boolean
  pointInDollar: number
  totalWithdrawUsd: number
  coinsInTrading: number
  faceVerificationStatus: FaceVerificationStatus
  faceVerificationDetail?: {
    duplicateUsername?: string
    matchedUsername?: string
    referenceImageUrl?: string | null
  }
  postingBanned?: boolean
  postingSuspendedUntil?: string | null
  publicId?: string
}

export interface CoinTransaction {
  id: string
  date: string
  description: string
  amount: number
  status: TransactionStatus
  type?: string
}

export interface PointTransaction {
  id: string
  date: string
  description: string
  amount: number
  status: TransactionStatus
  type?: string
}

export interface Post {
  id: string
  thumbnail: string
  caption: string
  type: 'image' | 'video'
  date: string
  url?: string
}

export interface ReportSummary {
  nudity: number
  abuse: number
  fakeStreaming: number
}

export interface LiveSummary {
  liveHours: number
  receivingCount: number
}

export interface UserSearchResult {
  id: string
  name: string
  username?: string
  publicId?: string
  email?: string
  phone?: string
  status?: string
  avatar?: string
  tags?: string[]
}

export interface UpdateUserPayload {
  username?: string
  email?: string
  phone?: string
  gender?: string
  country?: string
  tags?: string[]
}

export interface TransactionParams {
  types?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
  direction?: 'credit' | 'debit'
}

export interface StatusActionOptions {
  action: 'active' | 'suspend' | 'ban'
  suspendDays?: number
  suspendedUntil?: string
}

export interface DeviceBanOptions {
  deviceId?: string
  reason?: string
}

export interface FaceRevokeOptions {
  reason?: string
  revokeRelated?: boolean
}
