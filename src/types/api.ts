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
  /** Derived trim(first)+' '+trim(last); empty string if both missing. */
  name: string
  firstName?: string | null
  lastName?: string | null
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
  /** Read-only derived legal name — do not PATCH. */
  name?: string
  firstName?: string | null
  lastName?: string | null
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
    richTier?: { tier?: number; displayName?: string | null }
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
  /** Trim, 1–50 chars; cannot clear (omit to leave unchanged). */
  firstName?: string
  /** Trim, 0–50 chars; `""` clears to null. */
  lastName?: string
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
  description?: string | null
  amount?: string | number
  balanceAfter?: string | number
  /** Ledger APIs use CREDIT/DEBIT; trading admin history uses credit/debit. */
  direction?: 'credit' | 'debit' | 'CREDIT' | 'DEBIT'
  txType?: string
  type?: string
  status?: string
  counterpartyId?: string | null
  counterpartyDetails?: {
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
  } | null
  gift?: {
    giftTransactionId?: string
    giftId?: string
    giftName?: string
    displayImageUrl?: string | null
    coinCost?: number
    pointsAwarded?: number
    quantity?: number
  } | null
  storeItem?: {
    id?: string
    name?: string
    category?: string
    coinCost?: number
    displayImageUrl?: string | null
  } | null
  vipPurchase?: {
    id?: string
    tier?: string
    periodDays?: number
    coinCost?: string
  } | null
  coinTradingTransfer?: {
    id?: string
    tradingCoinsDebited?: string
    coinsCredited?: string
    recipientWalletType?: string
    reversedAt?: string | null
  } | null
  canRevert?: boolean
  transferId?: string | null
  revertVia?: {
    endpoint: 'coin_ledger' | 'coin_trading_transfer'
    id: string
  } | null
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

export interface FaceMatchedUserResponse {
  userId?: string
  username?: string
  name?: string
  avatarUrl?: string | null
  publicId?: string
  displayPublicId?: string
}

export interface FaceVerificationResponse {
  userId?: string
  isFaceVerified: boolean
  kycFaceVerified?: boolean
  hasReferenceImage?: boolean
  statusLabel?: string
  statusDetail?: string
  notIndexedReason?: string | null
  profile?: {
    faceProfileId?: string
    status?: string
    rekognitionFaceId?: string | null
    collectionId?: string | null
    indexedAt?: string | null
    lastVerifiedAt?: string | null
    revokedAt?: string | null
    failureReason?: string | null
    imageQualityScore?: number | null
    livenessConfidence?: number | null
    faceMatchSimilarity?: number | null
    hasReferenceImage?: boolean
    isIndexed?: boolean
    statusLabel?: string
    statusDetail?: string
    notIndexedReason?: string | null
    duplicateOfUserId?: string | null
    matchedUserId?: string | null
    referenceImageUrl?: string | null
    duplicateOfUser?: FaceMatchedUserResponse | null
    matchedUser?: FaceMatchedUserResponse | null
  } | null
  /** Legacy flat fields (older API shapes) */
  duplicateOfUser?: FaceMatchedUserResponse | null
  matchedUser?: FaceMatchedUserResponse | null
  referenceImageUrl?: string | null
}

export interface LivePhotoResponse {
  userId?: string
  hasLivePhoto: boolean
  isVerified: boolean
  verificationState?: string
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
  latestAttempt?: {
    matched?: boolean
    failureReason?: string | null
    failureReasonDetail?: string | null
    similarityScore?: number | null
    createdAt?: string
  } | null
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
  userId?: string
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
  /**
   * MESSAGING_DISABLE only. Recipients this account cannot message.
   * `null` / omitted = global send ban (cannot message anyone).
   */
  targetUserIds?: string[] | null
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
  /** MESSAGING_DISABLE only. Omit for a global send ban. */
  targetUserIds?: string[]
  /**
   * MESSAGING_DISABLE only. Union `targetUserIds` with the active ban and
   * keep the later `restrictedUntil`.
   */
  extend?: boolean
}

export interface AdminLiveStreamRow {
  source: 'host_live_session' | 'live_stream'
  id: string
  roomId: string
  streamId: string | null
  title: string | null
  status: string
  startedAt: string | null
  isLive: boolean
  hostUserId?: string
  host?: LiveModerationUserBrief | null
}

export interface AdminActiveLiveStreamsResponse {
  userId: string
  streams: AdminLiveStreamRow[]
}

export interface AdminGlobalActiveLiveStreamsResponse {
  items: AdminLiveStreamRow[]
  pagination: LiveModerationPagination
}

export interface AdminStopLiveStreamResponse {
  ok: true
  status: 'STOP_REQUESTED'
  roomId: string
  pendingLiveBackend: boolean
  livekitRoomDeleted?: boolean
  liveBackendNotified?: boolean
  message?: string
}

export type LiveModerationKind = 'nudity' | 'video_call' | 'user_report' | 'host_ban'
export type LiveNudityAction = 'WARNING' | 'BLOCK'

export interface LiveModerationListQuery {
  kind?: LiveModerationKind
  userId?: string
  action?: LiveNudityAction
  reason?: string
  status?: string
  page?: number
  limit?: number
}

export interface LiveModerationUserBrief {
  id: string
  name?: string
  username?: string | null
  publicId?: string
  avatarUrl?: string | null
}

export interface LiveNudityLogItem {
  kind: 'nudity'
  id: string
  streamDbId: string
  roomId: string | null
  title: string | null
  isLive: boolean
  detectedLabel: string
  confidence: number
  action: LiveNudityAction | string
  evidenceUrl: string | null
  checkedAt: string
  host: LiveModerationUserBrief | null
  hostUserId: string | null
}

export interface VideoCallNudityLogItem {
  kind: 'video_call'
  id: string
  sessionId: string
  livekitRoom: string | null
  sessionStatus: string | null
  detectedLabel: string
  confidence: number
  action: LiveNudityAction | string
  evidenceUrl: string | null
  checkedAt: string
  caller: LiveModerationUserBrief | null
  creator: LiveModerationUserBrief | null
}

export interface HostStreamBanItem {
  kind: 'host_ban'
  id: string
  userId: string
  streamId: string
  banNumber: number
  banDurationHours: number
  suspendedUntil: string
  createdAt: string
  active: boolean
  user?: LiveModerationUserBrief | null
}

export interface LiveUserReportItem {
  kind: 'user_report'
  id: string
  reason: string
  context: string
  status: string
  additionalInfo?: string | null
  liveSessionId?: string | null
  hostUserId?: string | null
  evidenceUrls: string[]
  createdAt: string
  reporter: LiveModerationUserBrief | null
  reportedUser: LiveModerationUserBrief | null
  hostUser: LiveModerationUserBrief | null
}

export interface LiveModerationPagination {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface UserLiveModerationDossier {
  userId: string
  hostStreamSuspendedUntil: string | null
  accountStatus: string
  summary: {
    nudity: number
    liveNudityDetections: number
    videoCallNudity: number
    abuse: number
    fakeStreaming: number
    liveBroadcast: number
    hostBans: number
    userReports: number
  }
  liveNudityLogs: LiveNudityLogItem[]
  liveNudityPagination: LiveModerationPagination
  videoCallLogs: VideoCallNudityLogItem[]
  videoCallPagination: LiveModerationPagination
  hostBans: HostStreamBanItem[]
  hostBanPagination: LiveModerationPagination
  userReports: LiveUserReportItem[]
  userReportPagination: LiveModerationPagination
}

export interface AdminGlobalRestrictionItem extends ApiUserRestriction {
  user?: LiveModerationUserBrief | null
}

export interface AdminGlobalRestrictionsResponse {
  items: AdminGlobalRestrictionItem[]
  pagination: LiveModerationPagination
}

export interface LiveModerationListResponse {
  kind: LiveModerationKind
  items: Array<LiveNudityLogItem | VideoCallNudityLogItem | HostStreamBanItem | LiveUserReportItem>
  pagination: LiveModerationPagination
}
