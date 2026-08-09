export type AdminRole =
  | 'SUPER_ADMIN'
  | 'MODERATOR'
  | 'FINANCE'
  | 'CONTENT'
  | 'CUSTOMER_SUPPORT'

export interface AdminProfile {
  id: string
  email: string
  displayName: string
  role: AdminRole
  username?: string | null
  country?: string | null
  status?: string | null
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  admin: AdminProfile
}

export interface RefreshResponse {
  accessToken: string
}

export interface MeResponse {
  admin: Pick<AdminProfile, 'id' | 'role'> & Partial<AdminProfile>
}

export interface CreateAdminPayload {
  email: string
  password: string
  displayName: string
  role?: AdminRole
}

export interface CreateAdminResponse {
  id: string
  email: string
  displayName: string
  role: AdminRole
  createdAt: string
}

export interface UserSearchItem {
  userId: string
  name: string
  username: string
  publicId: string
  displayPublicId: string
  status: string
  isAgent: boolean
  adminTags: string[]
  avatarUrl: string | null
  email: string | null
  phone: string | null
  matchedBy: string
}

export interface UserSearchResponse {
  matchedBy?: string
  users: UserSearchItem[]
}

export interface ApiUserDetail {
  userId: string
  username: string
  name?: string
  publicId?: string
  avatarUrl?: string | null
  vip?: {
    displayPublicId?: string | null
    currentVipPublicId?: string | null
    vipPublicIdExpiresAt?: string | null
    rareIdActive?: boolean
    membership?: { isActive?: boolean; tier?: number | null; expiresAt?: string | null; daysRemaining?: number }
    vipSubscriptionActive?: boolean
    vipSubscriptionExpiresAt?: string | null
    richTier?: { tier?: number; displayName?: string }
  }
  email?: string | null
  phone?: string | null
  gender?: string | null
  country?: string | null
  /** Face INDEXED or KYC face flag — gates gender edits. */
  faceVerified?: boolean
  /** `!faceVerified` — enable gender control when true. */
  genderEditable?: boolean
  joinedAt?: string
  lastLoggedInAt?: string | null
  lastActiveAt?: string | null
  wealthLevel?: number
  livestreamLevel?: number
  tags?: string[]
  agency?: {
    isMember?: boolean
    role?: string
    agencyPublicId?: string
    agencyName?: string
  } | null
  ipAddress?: string | null
  ipAddresses?: string[]
  deviceName?: string | null
  deviceId?: string | null
  devices?: ApiDevice[]
  status: string
  suspendedUntil?: string | null
  walletFreeze?: {
    personalCoinsFrozen?: boolean
    tradingCoinsFrozen?: boolean
    pointsFrozen?: boolean
  }
  posting?: {
    banned?: boolean
    suspendedUntil?: string | null
  }
  /** Flat aliases some payloads may include */
  postingBanned?: boolean
  postingSuspendedUntil?: string | null
}

export interface ApiWallet {
  userId: string
  personalCoinBalance: string
  personalPointBalance: string
  availablePoints?: string
  unconfirmedPoints?: string
  tradingCoinBalance: string
  totalCoinsRecharged: string
  totalWithdrawalProcessedPoints: string
}

export interface ApiDevice {
  deviceId: string
  deviceName?: string | null
  platform?: string | null
  ipAddress?: string | null
  lastActiveAt?: string | null
  isBanned?: boolean
}

export interface ApiDevicesResponse {
  devices: ApiDevice[]
}

export interface StatusActionPayload {
  status: {
    action: 'active' | 'suspend' | 'ban'
    suspendDays?: number
    suspendedUntil?: string
  }
}

export interface PatchUserPayload {
  username?: string
  email?: string
  phone?: string
  gender?: string
  country?: string
  tags?: string[]
  status?: StatusActionPayload['status']
}

export interface TagsResponse {
  userId: string
  adminTags: string[]
}

export interface WalletAdjustPayload {
  amount: string
  description?: string
  idempotencyKey?: string
}

export interface TransactionFilterTypes {
  personalCoins?: { filterValues?: string[] }
  points?: { filterValues?: string[] }
  tradingCoins?: { filterValues?: string[] }
}

export interface ApiTransaction {
  id?: string
  transactionId?: string
  createdAt?: string
  date?: string
  transactionName?: string
  description?: string
  amount?: string | number
  /** Ledger APIs use CREDIT/DEBIT; trading admin history uses credit/debit. */
  direction?: 'credit' | 'debit' | 'CREDIT' | 'DEBIT'
  txType?: string
  type?: string
  status?: string
}

export interface ApiTransactionListResponse {
  /** Personal coin + point admin history (`coinWallet` / `pointWallet` getHistory). */
  entries?: ApiTransaction[]
  transactions?: ApiTransaction[]
  /** Trading-coin admin history. */
  items?: ApiTransaction[]
  data?: ApiTransaction[]
  nextCursor?: string | null
  hasMore?: boolean
}

export interface ApiPost {
  postId?: string
  id?: string
  caption?: string | null
  mediaType?: string
  type?: string
  thumbnailUrl?: string | null
  mediaUrl?: string | null
  createdAt?: string
  date?: string
}

export interface ApiPostsResponse {
  posts: ApiPost[]
  nextCursor?: string | null
}

export interface ApiPostDetail extends ApiPost {
  mediaUrl?: string | null
  thumbnailUrl?: string | null
}

export interface FaceVerificationResponse {
  userId?: string
  isFaceVerified: boolean
  kycFaceVerified?: boolean
  profile?: {
    faceProfileId?: string
    status?: string
    rekognitionFaceId?: string | null
    collectionId?: string | null
    indexedAt?: string | null
    revokedAt?: string | null
    duplicateOfUserId?: string | null
    matchedUserId?: string | null
    referenceImageUrl?: string | null
    duplicateOfUser?: {
      userId?: string
      username?: string
      name?: string
      avatarUrl?: string | null
    } | null
    matchedUser?: {
      userId?: string
      username?: string
      name?: string
      avatarUrl?: string | null
    } | null
  } | null
  /** Legacy flat fields (older API shapes) */
  duplicateOfUser?: {
    username?: string
    avatarUrl?: string | null
  } | null
  matchedUser?: {
    username?: string
    avatarUrl?: string | null
  } | null
  referenceImageUrl?: string | null
}

export interface PasswordResetResponse {
  temporaryPassword?: string
}

export interface AdminPasswordResetResponse {
  ok: true
  adminId: string
  email: string
  role: AdminRole
  temporaryPassword?: string
  sessionsRevoked: boolean
  message: string
}

export type UserRestrictionType =
  | 'LIVE_CHAT_MUTE'
  | 'LIVE_AUDIO_MUTE'
  | 'MESSAGING_DISABLE'
  | 'LIVE_STREAM_START_BAN'

export interface ApiUserRestriction {
  id: string
  type: UserRestrictionType
  restrictedUntil: string
  reason?: string | null
  reportId?: string | null
  active?: boolean
  createdByAdminId?: string
  clearedAt?: string | null
  clearedByAdminId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ApiUserRestrictionsResponse {
  userId: string
  active: ApiUserRestriction[]
  history?: ApiUserRestriction[]
}

export interface ApplyUserRestrictionPayload {
  type: UserRestrictionType
  restrictedUntil: string
  reason?: string
  reportId?: string
}
