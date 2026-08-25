export type UserStatus = 'active' | 'inactive' | 'banned' | 'suspended'
export type TransactionStatus = 'success' | 'pending' | 'failed'
export type FaceVerificationStatus =
  | 'verified'
  | 'pending'
  | 'failed'
  | 'duplicate'
  | 'revoked'
  | 'none'

export type LivePhotoStatus = 'verified' | 'pending' | 'failed' | 'rejected' | 'none'

export interface FaceMatchedUser {
  userId: string
  username?: string
  name?: string
  avatarUrl?: string | null
  publicId?: string
  displayPublicId?: string
}

export interface DeviceOtherActiveLogin {
  userId: string
  username?: string
  name?: string
  avatarUrl?: string | null
  publicId?: string
  displayPublicId?: string
  status?: string
  sessionId?: string
  deviceName?: string
  ipAddress?: string
  lastActiveAt?: string
  loginType?: string | null
}

export interface DeviceInfo {
  id: string
  name?: string
  platform?: string
  ipAddress?: string
  lastActiveAt?: string
  isBanned: boolean
  hasActiveSession?: boolean
  sessionId?: string
  loginType?: string
  otherActiveLogins?: DeviceOtherActiveLogin[]
}

export interface UserProfile {
  id: string
  /** Derived legal display name from API (`name`), or composed client-side. */
  name: string
  firstName?: string | null
  lastName?: string | null
  /** Handle used for PATCH `username` (distinct from display `name`). */
  username?: string
  avatar?: string
  vip: boolean
  status: UserStatus
  rawStatus?: string
  suspendedUntil?: string | null
  wealthLevel: number
  streamLevel: number
  /** Elite / RICH I–X from `GET /admin/users/:id` `vip.richTier`. `tier` 0 = none. */
  richTier?: { tier: number; displayName: string | null }
  walletCoins: number
  points: number
  totalEarnings: number
  totalPoints: number
  totalRechargeCoin: number
  lastActive: string
  mobile?: string
  email?: string
  /** Agency KYC contact when the user applied. Distinct from login `mobile`/`email`. */
  kycContact?: {
    phone: string | null
    email: string | null
    submittedAt: string | null
    govtIdUrl?: string | null
    govtIdSubmittedAt?: string | null
  } | null
  /** Present while an agency agent application row exists. */
  agencyApplication?: {
    id: string
    status: string
  } | null
  gender?: string
  country?: string
  city?: string
  tags: string[]
  registrationDate: string
  lastLogin: string
  inAgency: boolean
  agencyName?: string
  agencyPublicId?: string
  ipAddress?: string
  deviceName?: string
  deviceId?: string
  coinsFrozen: boolean
  tradingCoinsFrozen?: boolean
  pointsFrozen: boolean
  pointInDollar: number
  totalWithdrawUsd: number
  coinsInTrading: number
  faceVerified?: boolean
  /** When false, gender select is locked until face verification is revoked. */
  genderEditable?: boolean
  faceVerificationStatus: FaceVerificationStatus
  faceVerificationDetail?: {
    status?: string | null
    statusLabel?: string
    statusDetail?: string
    failureReason?: string | null
    notIndexedReason?: string | null
    hasReferenceImage?: boolean
    faceMatchSimilarity?: number | null
    duplicateUsername?: string
    matchedUsername?: string
    referenceImageUrl?: string | null
    matchedUser?: FaceMatchedUser | null
    duplicateOfUser?: FaceMatchedUser | null
  }
  livePhotoStatus?: LivePhotoStatus
  livePhotoDetail?: {
    hasLivePhoto?: boolean
    isVerified?: boolean
    verificationState?: string | null
    statusLabel?: string
    statusDetail?: string
    verdictReason?: string | null
    failureReason?: string | null
    failureReasonDetail?: string | null
    replaceFailedReason?: string | null
    replaceFailedReasonDetail?: string | null
    replaceInProgress?: boolean
    similarityScore?: number | null
    verifiedAt?: string | null
    imageUrl?: string | null
    pendingImageUrl?: string | null
  }
  postingBanned?: boolean
  postingSuspendedUntil?: string | null
  /** Numeric/public user id from the profile. */
  publicId?: string
  /** Prefer VIP display id when present (`vip.displayPublicId`). */
  displayPublicId?: string
}

export interface TxCounterpartyDetails {
  userId?: string
  name?: string
  publicId?: string
  avatarUrl?: string | null
  storeItemName?: string
  price?: string
  rarePublicId?: string
  membershipType?: string
  addedByAdmin?: { adminUserId: string; name?: string; publicId?: string }
  transactionId?: string
}

export interface CoinTransaction {
  id: string
  date: string
  /** Primary row title — prefer API `transactionName`. */
  transactionName: string
  /** Secondary line when present. */
  description: string | null
  amount: number
  balanceAfter?: number
  direction?: 'credit' | 'debit'
  status: TransactionStatus
  type?: string
  counterpartyId?: string | null
  counterpartyDetails?: TxCounterpartyDetails | null
  giftTransactionId?: string | null
  coinTradingTransferId?: string | null
  linkSummary?: string | null
  canRevert: boolean
  /** Present when per-user API adds explorer-parity revert routing. */
  revertVia?: {
    endpoint: 'coin_ledger' | 'coin_trading_transfer' | 'withdrawal'
    id: string
  } | null
}

export interface PointTransaction {
  id: string
  date: string
  transactionName: string
  description: string | null
  amount: number
  balanceAfter?: number
  direction?: 'credit' | 'debit'
  status: TransactionStatus
  type?: string
  counterpartyId?: string | null
  counterpartyDetails?: TxCounterpartyDetails | null
  canRevert: boolean
  revertVia?: {
    endpoint: 'coin_ledger' | 'coin_trading_transfer' | 'withdrawal'
    id: string
  } | null
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
  /** Prefer API `name`; else username. Used for chips / primary label. */
  name: string
  firstName?: string | null
  lastName?: string | null
  username?: string
  publicId?: string
  email?: string
  phone?: string
  status?: string
  avatar?: string
  tags?: string[]
  matchedBy?: string
}

export interface UpdateUserPayload {
  username?: string
  firstName?: string
  lastName?: string
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

export interface LivePhotoRemoveOptions {
  reason?: string
}
