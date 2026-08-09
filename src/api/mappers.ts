import type {
  ApiDevice,
  ApiPost,
  ApiPostDetail,
  ApiTransaction,
  ApiUserDetail,
  ApiWallet,
  UserSearchItem,
} from '@/types/api'
import type {
  CoinTransaction,
  DeviceInfo,
  FaceVerificationStatus,
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
    name: user.name || user.username || 'Unknown',
    username: user.username,
    avatar: user.avatarUrl ?? undefined,
    vip: Boolean(user.vip?.membership?.isActive || user.vip?.vipSubscriptionActive),
    status: mapUserStatus(user.status),
    rawStatus: user.status,
    suspendedUntil: user.suspendedUntil ?? null,
    wealthLevel: user.wealthLevel ?? 0,
    streamLevel: user.livestreamLevel ?? 0,
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
    name: item.name || item.username,
    username: item.username,
    publicId: item.displayPublicId || item.publicId,
    email: item.email ?? undefined,
    phone: item.phone ?? undefined,
    status: item.status,
    avatar: item.avatarUrl ?? undefined,
    tags: item.adminTags,
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
  const direction = (tx.direction ?? '').toLowerCase()
  const signed = direction === 'debit' ? -Math.abs(amountNum) : amountNum

  return {
    id: tx.transactionId ?? tx.id ?? crypto.randomUUID(),
    date: tx.createdAt ?? tx.date ?? new Date().toISOString(),
    description:
      tx.transactionName ?? tx.description ?? tx.txType ?? tx.type ?? 'Transaction',
    amount: signed,
    status: mapTxStatus(tx.status),
    type: tx.txType ?? tx.type,
  }
}

export function mapPointTransaction(tx: ApiTransaction): PointTransaction {
  const mapped = mapTransaction(tx)
  return { ...mapped }
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

export function mapFaceStatus(data: { isFaceVerified?: boolean }): FaceVerificationStatus {
  if (data.isFaceVerified) return 'verified'
  return 'none'
}
