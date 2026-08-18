import type {
  ApiDevice,
  ApiPost,
  ApiPostDetail,
  ApiTransaction,
  ApiUserDetail,
  ApiWallet,
  FaceMatchedUserResponse,
  FaceVerificationResponse,
  LivePhotoResponse,
  UserSearchItem,
} from '@/types/api'
import type {
  CoinTransaction,
  DeviceInfo,
  FaceMatchedUser,
  FaceVerificationStatus,
  LivePhotoStatus,
  PointTransaction,
  Post,
  UserProfile,
  UserSearchResult,
  UserStatus,
} from '@/types/user'

function parseBigInt(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return 0
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? n : 0
}

function composeLegalName(
  name?: string | null,
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null,
): string {
  const fromApi = (name ?? '').trim()
  if (fromApi) return fromApi
  const composed = [firstName, lastName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ')
  if (composed) return composed
  return (fallback ?? '').trim() || 'Unknown'
}

function mapUserStatus(status: string): UserStatus {
  if (status === 'banned') return 'banned'
  if (status === 'suspended') return 'suspended'
  return status === 'active' ? 'active' : 'inactive'
}

export function mapUserDetail(user: ApiUserDetail, wallet?: ApiWallet | null): UserProfile {
  const personalCoins = wallet ? parseBigInt(wallet.personalCoinBalance) : 0
  const points = wallet ? parseBigInt(wallet.personalPointBalance) : 0
  const trading = wallet ? parseBigInt(wallet.tradingCoinBalance) : 0
  const totalRecharge = wallet ? parseBigInt(wallet.totalCoinsRecharged) : 0
  const totalWithdrawPoints = wallet ? parseBigInt(wallet.totalWithdrawalProcessedPoints) : 0

  const faceVerified = Boolean(user.faceVerified)
  const genderEditable =
    typeof user.genderEditable === 'boolean' ? user.genderEditable : !faceVerified

  return {
    id: user.userId,
    name: composeLegalName(user.name, user.firstName, user.lastName, user.username),
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    username: user.username,
    avatar: user.avatarUrl ?? undefined,
    vip: Boolean(user.vip?.membership?.isActive || user.vip?.vipSubscriptionActive),
    status: mapUserStatus(user.status),
    rawStatus: user.status,
    suspendedUntil: user.suspendedUntil ?? null,
    wealthLevel: user.wealthLevel ?? 0,
    streamLevel: user.livestreamLevel ?? 0,
    richTier: {
      tier: user.vip?.richTier?.tier ?? 0,
      displayName: user.vip?.richTier?.displayName ?? null,
    },
    walletCoins: personalCoins,
    points,
    totalEarnings: points,
    totalPoints: points,
    totalRechargeCoin: totalRecharge,
    lastActive: user.lastActiveAt ?? user.lastLoggedInAt ?? new Date().toISOString(),
    mobile: user.phone ?? undefined,
    email: user.email ?? undefined,
    gender: user.gender ?? undefined,
    country: user.country ?? undefined,
    tags: user.tags ?? [],
    registrationDate: user.joinedAt ?? new Date().toISOString(),
    lastLogin: user.lastLoggedInAt ?? user.joinedAt ?? new Date().toISOString(),
    inAgency: Boolean(user.agency?.isMember),
    agencyName: user.agency?.agencyName,
    agencyPublicId: user.agency?.agencyPublicId,
    ipAddress: user.ipAddress ?? user.ipAddresses?.[0],
    deviceName: user.deviceName ?? undefined,
    deviceId: user.deviceId ?? undefined,
    coinsFrozen: Boolean(user.walletFreeze?.personalCoinsFrozen),
    tradingCoinsFrozen: Boolean(user.walletFreeze?.tradingCoinsFrozen),
    pointsFrozen: Boolean(user.walletFreeze?.pointsFrozen),
    pointInDollar: 0,
    totalWithdrawUsd: totalWithdrawPoints,
    coinsInTrading: trading,
    faceVerified,
    genderEditable,
    faceVerificationStatus: (faceVerified ? 'verified' : 'none') as FaceVerificationStatus,
    postingBanned: Boolean(user.posting?.banned ?? user.postingBanned),
    postingSuspendedUntil:
      user.posting?.suspendedUntil ?? user.postingSuspendedUntil ?? null,
    publicId: user.publicId,
    displayPublicId: user.vip?.displayPublicId ?? user.publicId ?? undefined,
  }
}

export function mapSearchUser(item: UserSearchItem): UserSearchResult {
  return {
    id: item.userId,
    name: composeLegalName(item.name, item.firstName, item.lastName, item.username),
    firstName: item.firstName ?? null,
    lastName: item.lastName ?? null,
    username: item.username,
    publicId: item.displayPublicId || item.publicId,
    email: item.email ?? undefined,
    phone: item.phone ?? undefined,
    status: item.status,
    avatar: item.avatarUrl ?? undefined,
    tags: item.adminTags,
    matchedBy: item.matchedBy,
  }
}

export function mapDevice(device: ApiDevice): DeviceInfo {
  return {
    id: device.deviceId,
    name: device.deviceName ?? undefined,
    platform: device.platform ?? undefined,
    ipAddress: device.ipAddress ?? undefined,
    lastActiveAt: device.lastActiveAt ?? undefined,
    isBanned: Boolean(device.isBanned),
  }
}

export function mapTransaction(tx: ApiTransaction): CoinTransaction {
  const amountRaw = tx.amount ?? 0
  const amountNum = typeof amountRaw === 'string' ? Number(amountRaw) : amountRaw
  const directionRaw = (tx.direction ?? '').toLowerCase()
  const direction =
    directionRaw === 'debit' || directionRaw === 'credit'
      ? (directionRaw as 'credit' | 'debit')
      : undefined
  const signed =
    direction === 'debit' ? -Math.abs(amountNum) : direction === 'credit' ? Math.abs(amountNum) : amountNum

  const transactionName =
    (tx.transactionName ?? '').trim() ||
    (tx.txType ?? tx.type ?? '').trim() ||
    'Transaction'
  const description =
    tx.description != null && String(tx.description).trim()
      ? String(tx.description).trim()
      : null

  const linkParts: string[] = []
  if (tx.gift?.giftName) linkParts.push(`Gift: ${tx.gift.giftName}`)
  if (tx.storeItem?.name) linkParts.push(`Store: ${tx.storeItem.name}`)
  if (tx.vipPurchase?.tier) linkParts.push(`VIP: ${tx.vipPurchase.tier}`)
  if (tx.coinTradingTransfer?.id) linkParts.push('Trading transfer')
  if (tx.counterpartyDetails?.storeItemName && !tx.storeItem?.name) {
    linkParts.push(`Store: ${tx.counterpartyDetails.storeItemName}`)
  }

  const balanceRaw = tx.balanceAfter
  const balanceAfter =
    balanceRaw === undefined || balanceRaw === null || balanceRaw === ''
      ? undefined
      : typeof balanceRaw === 'string'
        ? Number(balanceRaw)
        : balanceRaw

  return {
    id: tx.id ?? tx.transactionId ?? crypto.randomUUID(),
    date: tx.createdAt ?? tx.date ?? new Date().toISOString(),
    transactionName,
    description,
    amount: signed,
    balanceAfter: Number.isFinite(balanceAfter as number) ? (balanceAfter as number) : undefined,
    direction,
    status: mapTxStatus(tx.status),
    type: tx.txType ?? tx.type,
    counterpartyId: tx.counterpartyId ?? tx.counterpartyDetails?.userId ?? null,
    counterpartyDetails: tx.counterpartyDetails
      ? {
          userId: tx.counterpartyDetails.userId,
          name: tx.counterpartyDetails.name,
          publicId: tx.counterpartyDetails.publicId,
          avatarUrl: tx.counterpartyDetails.avatarUrl ?? null,
          storeItemName: tx.counterpartyDetails.storeItemName,
          price: tx.counterpartyDetails.price,
          rarePublicId: tx.counterpartyDetails.rarePublicId,
          membershipType: tx.counterpartyDetails.membershipType,
          addedByAdmin: tx.counterpartyDetails.addedByAdmin,
          transactionId: tx.counterpartyDetails.transactionId,
        }
      : null,
    giftTransactionId: tx.gift?.giftTransactionId ?? null,
    coinTradingTransferId: tx.coinTradingTransfer?.id ?? null,
    linkSummary: linkParts.length ? linkParts.join(' · ') : null,
    canRevert: tx.canRevert === true,
    revertVia: tx.revertVia ?? null,
  }
}

export function mapPointTransaction(tx: ApiTransaction): PointTransaction {
  const mapped = mapTransaction(tx)
  return {
    id: mapped.id,
    date: mapped.date,
    transactionName: mapped.transactionName,
    description: mapped.description,
    amount: mapped.amount,
    balanceAfter: mapped.balanceAfter,
    direction: mapped.direction,
    status: mapped.status,
    type: mapped.type,
    counterpartyId: mapped.counterpartyId,
    counterpartyDetails: mapped.counterpartyDetails,
    canRevert: mapped.canRevert,
    revertVia: mapped.revertVia ?? null,
  }
}

function mapTxStatus(status?: string): CoinTransaction['status'] {
  if (!status) return 'success'
  const s = status.toLowerCase()
  if (s.includes('pending')) return 'pending'
  if (s.includes('fail')) return 'failed'
  return 'success'
}

export function mapPost(post: ApiPost | ApiPostDetail): Post {
  const mediaType = (post.mediaType ?? post.type ?? 'image').toLowerCase()
  return {
    id: post.postId ?? post.id ?? '',
    thumbnail: post.thumbnailUrl ?? post.mediaUrl ?? '',
    caption: post.caption ?? '',
    type: mediaType.includes('video') ? 'video' : 'image',
    date: post.createdAt ?? post.date ?? new Date().toISOString(),
    url: post.mediaUrl ?? post.thumbnailUrl ?? undefined,
  }
}

function mapFaceMatchedUser(
  row: FaceMatchedUserResponse | null | undefined,
): FaceMatchedUser | null {
  if (!row?.userId) return null
  return {
    userId: row.userId,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatarUrl,
    publicId: row.publicId,
    displayPublicId: row.displayPublicId,
  }
}

export function mapFaceStatus(data: FaceVerificationResponse): FaceVerificationStatus {
  const status = data.profile?.status
  if (status === 'INDEXED') return 'verified'
  if (status === 'PENDING_INDEX') return 'pending'
  if (status === 'DUPLICATE_FACE') return 'duplicate'
  if (status === 'FAILED') return 'failed'
  if (status === 'REVOKED') return 'revoked'
  if (data.isFaceVerified) return 'verified'
  return 'none'
}

export function mapFaceVerificationDetail(
  data: FaceVerificationResponse,
): NonNullable<UserProfile['faceVerificationDetail']> {
  const matchedUser =
    mapFaceMatchedUser(data.profile?.matchedUser) ?? mapFaceMatchedUser(data.matchedUser)
  const duplicateOfUser =
    mapFaceMatchedUser(data.profile?.duplicateOfUser) ?? mapFaceMatchedUser(data.duplicateOfUser)
  return {
    status: data.profile?.status ?? null,
    statusLabel: data.profile?.statusLabel ?? data.statusLabel,
    statusDetail: data.profile?.statusDetail ?? data.statusDetail,
    failureReason: data.profile?.failureReason ?? null,
    notIndexedReason: data.profile?.notIndexedReason ?? data.notIndexedReason ?? null,
    hasReferenceImage: data.profile?.hasReferenceImage ?? data.hasReferenceImage,
    faceMatchSimilarity: data.profile?.faceMatchSimilarity ?? null,
    duplicateUsername: duplicateOfUser?.username ?? data.duplicateOfUser?.username,
    matchedUsername: matchedUser?.username ?? data.matchedUser?.username,
    referenceImageUrl: data.profile?.referenceImageUrl ?? data.referenceImageUrl ?? null,
    matchedUser,
    duplicateOfUser,
  }
}

export function mapLivePhotoStatus(data: LivePhotoResponse): LivePhotoStatus {
  if (data.isVerified || data.verificationState === 'VERIFIED') return 'verified'
  const state = data.verificationState
  if (state === 'FAILED') return 'failed'
  if (state === 'REJECTED') return 'rejected'
  if (
    state === 'PENDING_UPLOAD' ||
    state === 'PENDING_VERIFICATION' ||
    state === 'PROCESSING'
  ) {
    return 'pending'
  }
  return 'none'
}

export function mapLivePhotoDetail(
  data: LivePhotoResponse,
): NonNullable<UserProfile['livePhotoDetail']> {
  return {
    hasLivePhoto: data.hasLivePhoto,
    isVerified: data.isVerified,
    verificationState: data.verificationState ?? null,
    statusLabel: data.statusLabel,
    statusDetail: data.statusDetail,
    verdictReason: data.verdictReason ?? null,
    failureReason: data.failureReason ?? null,
    failureReasonDetail: data.failureReasonDetail ?? null,
    replaceFailedReason: data.replaceFailedReason ?? null,
    replaceFailedReasonDetail: data.replaceFailedReasonDetail ?? null,
    replaceInProgress: data.replaceInProgress,
    similarityScore: data.similarityScore ?? null,
    verifiedAt: data.verifiedAt ?? null,
    imageUrl: data.imageUrl ?? null,
    pendingImageUrl: data.pendingImageUrl ?? null,
  }
}
