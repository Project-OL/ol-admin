import api, { walletIdempotencyKey } from '@/api/client'
import type {
  ApiDevicesResponse,
  ApiPostDetail,
  ApiPostsResponse,
  ApiTransactionListResponse,
  ApiUserDetail,
  ApiWallet,
  FaceVerificationResponse,
  PasswordResetResponse,
  PatchUserPayload,
  TagsResponse,
  TransactionFilterTypes,
  UserSearchResponse,
  WalletAdjustPayload,
  ApplyUserRestrictionPayload,
  ApiUserRestrictionsResponse,
  UserRestrictionType,
} from '@/types/api'
import type {
  AdminUserGuardianDossier,
  AdminUserVipDossier,
  GuardianDossierQuery,
  VipDossierQuery,
} from '@/types/userVipGuardian'
import type {
  AdminLocationsPage,
  AdminLocationsQuery,
  AdminUserLocations,
  UserLocationsQuery,
} from '@/types/userLocation'

export type AdminSetLevelResponse = {
  ok: boolean
  userId: string
  levelType: 'wealth' | 'livestream'
  previousLevel: number
  previousCumulative: string
  currentLevel: number
  cumulativeTotal: string
  snapshot?: {
    currentLevel: number
    cumulativeTotal: string
    nextLevelThreshold?: string
    distanceToUpgrade?: string
    progressNumerator?: string
    progressDenominator?: string
    leveledUp?: boolean
    previousLevel?: number
  }
}

export interface TransactionQuery {
  types?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
  direction?: 'credit' | 'debit'
}

function extractTransactions(data: ApiTransactionListResponse) {
  // Personal coins / points history returns `entries`; trading coins returns `items`.
  return data.entries ?? data.transactions ?? data.items ?? data.data ?? []
}

export const userAdminApi = {
  searchUsers(q: string, type = 'auto', limit = 20) {
    return api.get<UserSearchResponse>('/admin/users/search', { params: { q, type, limit } })
  },

  /** Last 10 profiles opened / exact-matched by this admin. */
  getSearchHistory() {
    return api.get<UserSearchResponse>('/admin/users/search/history')
  },

  getUser(id: string) {
    return api.get<ApiUserDetail>(`/admin/users/${id}`)
  },

  updateUser(id: string, payload: PatchUserPayload) {
    return api.patch<ApiUserDetail>(`/admin/users/${id}`, payload)
  },

  updateTags(id: string, tags: string[]) {
    return api.put<TagsResponse>(`/admin/users/${id}/tags`, { tags })
  },

  getWallet(id: string) {
    return api.get<ApiWallet>(`/admin/users/${id}/wallet`)
  },

  getDevices(id: string) {
    return api.get<ApiDevicesResponse>(`/admin/users/${id}/devices`)
  },

  getTransactionFilterTypes() {
    return api.get<TransactionFilterTypes>('/admin/users/transactions/filter-types')
  },

  getCoinTransactions(id: string, params: TransactionQuery) {
    return api.get<ApiTransactionListResponse>(`/admin/users/${id}/transactions/coins`, { params })
  },

  getPointTransactions(id: string, params: TransactionQuery) {
    return api.get<ApiTransactionListResponse>(`/admin/users/${id}/transactions/points`, { params })
  },

  getTradingCoinTransactions(id: string, params: TransactionQuery) {
    return api.get<ApiTransactionListResponse>(`/admin/users/${id}/transactions/trading-coins`, { params })
  },

  addPersonalCoins(id: string, amount: number, description?: string) {
    const payload: WalletAdjustPayload = {
      amount: String(amount),
      description,
      idempotencyKey: walletIdempotencyKey('coins-add'),
    }
    return api.post(`/admin/users/${id}/wallet/personal-coins/add`, payload)
  },

  deductPersonalCoins(id: string, amount: number, description?: string) {
    const payload: WalletAdjustPayload = {
      amount: String(amount),
      description,
      idempotencyKey: walletIdempotencyKey('coins-deduct'),
    }
    return api.post(`/admin/users/${id}/wallet/personal-coins/deduct`, payload)
  },

  addTradingCoins(id: string, amount: number, description?: string) {
    const payload: WalletAdjustPayload = {
      amount: String(amount),
      description,
      idempotencyKey: walletIdempotencyKey('trading-add'),
    }
    return api.post(`/admin/users/${id}/wallet/trading-coins/add`, payload)
  },

  deductTradingCoins(id: string, amount: number, description?: string) {
    const payload: WalletAdjustPayload = {
      amount: String(amount),
      description,
      idempotencyKey: walletIdempotencyKey('trading-deduct'),
    }
    return api.post(`/admin/users/${id}/wallet/trading-coins/deduct`, payload)
  },

  addPoints(id: string, amount: number, description?: string) {
    const payload: WalletAdjustPayload = {
      amount: String(amount),
      description,
      idempotencyKey: walletIdempotencyKey('points-add'),
    }
    return api.post(`/admin/users/${id}/wallet/points/add`, payload)
  },

  deductPoints(id: string, amount: number, description?: string) {
    const payload: WalletAdjustPayload = {
      amount: String(amount),
      description,
      idempotencyKey: walletIdempotencyKey('points-deduct'),
    }
    return api.post(`/admin/users/${id}/wallet/points/deduct`, payload)
  },

  freezePersonalCoins(id: string) {
    return api.post(`/admin/users/${id}/wallet/personal-coins/freeze`)
  },

  unfreezePersonalCoins(id: string) {
    return api.post(`/admin/users/${id}/wallet/personal-coins/unfreeze`)
  },

  freezeTradingCoins(id: string) {
    return api.post(`/admin/users/${id}/wallet/trading-coins/freeze`)
  },

  unfreezeTradingCoins(id: string) {
    return api.post(`/admin/users/${id}/wallet/trading-coins/unfreeze`)
  },

  freezePoints(id: string) {
    return api.post(`/admin/users/${id}/wallet/points/freeze`)
  },

  unfreezePoints(id: string) {
    return api.post(`/admin/users/${id}/wallet/points/unfreeze`)
  },

  getPosts(userId: string, params?: { cursor?: string; limit?: number }) {
    return api.get<ApiPostsResponse>('/admin/posts', { params: { userId, ...params } })
  },

  getPost(postId: string) {
    return api.get<ApiPostDetail>(`/admin/posts/${postId}`)
  },

  deletePost(postId: string) {
    return api.delete(`/admin/posts/${postId}`)
  },

  suspendPosting(id: string, suspendedUntil: string) {
    return api.post(`/admin/users/${id}/posting/suspend`, { suspendedUntil })
  },

  banPosting(id: string) {
    return api.post(`/admin/users/${id}/posting/ban`)
  },

  /** Preferred — clears ban + suspension */
  activatePosting(id: string) {
    return api.post<{
      ok: true
      userId: string
      postingBanned: false
      postingSuspendedUntil: null
    }>(`/admin/users/${id}/posting/activate`)
  },

  /** Alias of activatePosting */
  restorePosting(id: string) {
    return api.post<{
      ok: true
      userId: string
      postingBanned: false
      postingSuspendedUntil: null
    }>(`/admin/users/${id}/posting/activate`)
  },

  resetPassword(id: string, newPassword?: string) {
    return api.post<PasswordResetResponse>(
      `/admin/users/${id}/password/reset`,
      newPassword ? { newPassword } : {},
    )
  },

  getFaceVerification(id: string) {
    return api.get<FaceVerificationResponse>(`/admin/users/${id}/face-verification`)
  },

  revokeFaceVerification(id: string, reason?: string, revokeRelated = false) {
    return api.delete(`/admin/users/${id}/face-verification`, {
      data: { reason, revokeRelated },
    })
  },

  removeProfilePicture(id: string) {
    return api.post(`/admin/users/${id}/profile/remove-avatar`)
  },

  removeBio(id: string) {
    return api.post(`/admin/users/${id}/profile/remove-bio`)
  },

  resetIdentity(id: string) {
    return api.post(`/admin/users/${id}/profile/reset-identity`)
  },

  removeFromAgency(id: string) {
    return api.post(`/admin/users/${id}/agency/remove`)
  },

  banDevices(id: string, payload?: { deviceId?: string; reason?: string }) {
    return api.post(`/admin/users/${id}/devices/ban`, payload ?? {})
  },

  unbanDevice(deviceId: string) {
    return api.delete(`/admin/devices/${deviceId}/ban`)
  },

  setUserLevel(
    id: string,
    type: 'wealth' | 'livestream',
    body: { targetLevel: number; reason?: string },
  ) {
    return api.post<AdminSetLevelResponse>(`/admin/users/${id}/levels/${type}`, body)
  },

  setUserStatus(id: string, action: 'active' | 'suspend' | 'ban', options?: {
    suspendDays?: number
    suspendedUntil?: string
  }) {
    return api.patch<ApiUserDetail>(`/admin/users/${id}`, {
      status: { action, ...options },
    })
  },

  listRestrictions(id: string, includeCleared = false) {
    return api.get<ApiUserRestrictionsResponse>(`/admin/users/${id}/restrictions`, {
      params: includeCleared ? { includeCleared: true } : undefined,
    })
  },

  applyRestriction(id: string, payload: ApplyUserRestrictionPayload) {
    return api.post(`/admin/users/${id}/restrictions`, payload)
  },

  deleteRestriction(id: string, restrictionId: string) {
    return api.delete(`/admin/users/${id}/restrictions/${restrictionId}`)
  },

  clearRestrictionByType(id: string, type: UserRestrictionType) {
    return api.post(`/admin/users/${id}/restrictions/${type}/clear`)
  },

  getUserVip(id: string, params: VipDossierQuery = {}) {
    return api.get<AdminUserVipDossier>(`/admin/users/${id}/vip`, { params })
  },

  getUserGuardians(id: string, params: GuardianDossierQuery = {}) {
    return api.get<AdminUserGuardianDossier>(`/admin/users/${id}/guardians`, { params })
  },

  getUserLocations(id: string, params: UserLocationsQuery = {}) {
    return api.get<AdminUserLocations>(`/admin/users/${id}/locations`, { params })
  },

  listLocations(params: AdminLocationsQuery = {}) {
    return api.get<AdminLocationsPage>('/admin/locations', { params })
  },

  extractTransactions,
}

export default api
