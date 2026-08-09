export type VipTier = 'DIAMOND' | 'SVIP'
export type GuardianTier = 'SILVER' | 'GOLD' | 'KING'

export type AdminUserVipMembership = {
  isActive: boolean
  tier: VipTier | null
  expiresAt: string | null
  daysRemaining: number
  subscriptionActive: boolean
  subscriptionStartAt: string | null
  subscriptionExpiresAt: string | null
  dailyClaimAvailable: boolean
  lastClaimedAt: string | null
  privileges: {
    vipExclusiveProfileCard: boolean
    vipDistinguishedLogo: boolean
    vipExclusiveMessageBackground: boolean
    vipSpecialEntryEffect: boolean
    vipPreventBeingKicked: boolean
    vipLiveTranslationEnabled: boolean
  }
}

export type AdminUserVipPurchase = {
  id: string
  tier: VipTier
  periodDays: number
  coinCost: string
  expiresAtBefore: string | null
  expiresAtAfter: string
  createdAt: string
}

export type AdminUserVipDailyClaim = {
  claimDate: string
  coinAmount: string
  ledgerEntryId: string
  claimedAt: string
}

export type AdminUserVipDossier = {
  userId: string
  membership: AdminUserVipMembership
  rareId: {
    currentVipPublicId: string | null
    vipPublicIdExpiresAt: string | null
    active: boolean
  }
  richTier: { tier: number; displayName: string }
  config: {
    tiers: Array<{ tier: string; periodDays: number; coinCost: string }>
    dailyGrantCoins: string
    durationCapDays: number
  }
  purchases: {
    total: number
    items: AdminUserVipPurchase[]
    nextCursor: string | null
    hasMore: boolean
  }
  dailyClaims: {
    total: number
    items: AdminUserVipDailyClaim[]
    nextCursor: string | null
    hasMore: boolean
  }
}

export type VipDossierQuery = {
  purchasesLimit?: number
  purchasesCursor?: string
  claimsLimit?: number
  claimsCursor?: string
}

export type GuardianCounterparty = {
  userId: string
  username: string | null
  displayName: string | null
  name: string | null
  avatarUrl: string | null
  publicId: string | null
  displayPublicId: string | null
  country: string | null
  gender: string | null
  age: number | null
  livestreamLevel: number
  wealthLevel: number
}

export type AdminGuardianRelation = {
  guardianId: string
  role: 'guardian' | 'target'
  tier: GuardianTier
  durationMonths: number
  coinsPaid: string
  purchasedAt: string
  expiresAt: string
  daysRemaining: number
  isExpired: boolean
  isTopGuardian: boolean
  counterparty: GuardianCounterparty
}

export type AdminGuardianPurchase = {
  ledgerEntryId: string
  purchasedAt: string
  coinsPaid: string
  description: string | null
  idempotencyKey: string | null
  tier: GuardianTier | null
  durationMonths: number | null
  counterparty: GuardianCounterparty | null
}

export type AdminUserGuardianDossier = {
  userId: string
  asGuardian: AdminGuardianRelation[]
  asTarget: AdminGuardianRelation[]
  purchases: AdminGuardianPurchase[]
  summary: {
    asGuardianCount: number
    asTargetCount: number
    activeAsGuardianCount: number
    activeAsTargetCount: number
    purchaseHistoryCount: number
  }
}

export type GuardianDossierQuery = {
  purchaseHistoryLimit?: number
}
