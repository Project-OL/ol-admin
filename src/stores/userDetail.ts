import { defineStore } from 'pinia'

import { userAdminApi } from '@/api/userAdmin'

import {

  mapDevice,

  mapFaceStatus,

  mapFaceVerificationDetail,

  mapLivePhotoDetail,

  mapLivePhotoStatus,

  mapPointTransaction,

  mapPost,

  mapTransaction,

  mapUserDetail,

} from '@/api/mappers'

import type {

  CoinTransaction,

  DeviceInfo,

  DeviceBanOptions,

  FaceRevokeOptions,

  LivePhotoRemoveOptions,

  PointTransaction,

  Post,

  ReportSummary,

  LiveSummary,

  StatusActionOptions,

  TransactionParams,

  UpdateUserPayload,

  UserProfile,

} from '@/types/user'

import {

  filterTransactions,

  mockCoinTransactions,

  mockLiveSummary,

  mockPointTransactions,

  mockPosts,

  mockReportsSummary,

  mockUser,

  paginate,

} from '@/mocks/userDetail'

import { showToast } from '@/utils/toast'



const useMock = import.meta.env.VITE_USE_MOCK === 'true'



function delay(ms = 300) {

  return new Promise((resolve) => setTimeout(resolve, ms))

}



export const useUserDetailStore = defineStore('userDetail', {

  state: () => ({

    user: null as UserProfile | null,

    devices: [] as DeviceInfo[],

    coinTransactions: [] as CoinTransaction[],

    pointTransactions: [] as PointTransaction[],

    tradingTransactions: [] as CoinTransaction[],

    transactionFilterTypes: {

      coins: [] as string[],

      points: [] as string[],

      trading: [] as string[],

    },

    posts: [] as Post[],

    reportsSummary: { nudity: 0, abuse: 0, fakeStreaming: 0 } as ReportSummary,

    liveSummary: { liveHours: 0, receivingCount: 0 } as LiveSummary,

    loading: false,

    activeTab: 'details',

    coinCursor: null as string | null,

    pointCursor: null as string | null,

    tradingCursor: null as string | null,

    coinHasMore: false,

    pointHasMore: false,

    tradingHasMore: false,

  }),



  actions: {

    setActiveTab(tab: string) {

      this.activeTab = tab

    },



    async fetchUser(id: string) {

      this.loading = true

      try {

        if (useMock) {

          await delay()

          this.user = { ...mockUser, id }

          return

        }

        const [{ data: userData }, { data: walletData }] = await Promise.all([

          userAdminApi.getUser(id),

          userAdminApi.getWallet(id).catch(() => ({ data: null })),

        ])

        this.user = mapUserDetail(userData, walletData)

        await Promise.all([this.fetchFaceVerification(id), this.fetchLivePhoto(id)])

      } catch {

        if (useMock) this.user = { ...mockUser, id }

      } finally {

        this.loading = false

      }

    },



    async refreshWallet(id: string) {

      if (useMock || !this.user) return

      const { data: walletData } = await userAdminApi.getWallet(id)

      const personalCoins = Number(walletData.personalCoinBalance || 0) || 0

      const points = Number(walletData.personalPointBalance || 0) || 0

      const trading = Number(walletData.tradingCoinBalance || 0) || 0

      const totalRecharge = Number(walletData.totalCoinsRecharged || 0) || 0

      const totalWithdraw = Number(walletData.totalWithdrawalProcessedPoints || 0) || 0

      // Update wallet balances only — never remapping profile (would drop firstName/lastName/faceVerified).

      this.user = {

        ...this.user,

        walletCoins: personalCoins,

        points,

        totalEarnings: points,

        totalPoints: points,

        totalRechargeCoin: totalRecharge,

        totalWithdrawUsd: totalWithdraw,

        coinsInTrading: trading,

      }

    },



    async fetchDevices(id: string) {

      try {

        if (useMock) {

          await delay(200)

          this.devices = this.user?.deviceId

            ? [{

                id: this.user.deviceId,

                name: this.user.deviceName,

                isBanned: false,

              }]

            : []

          return

        }

        const { data } = await userAdminApi.getDevices(id)

        this.devices = data.devices.map(mapDevice)

      } catch {

        /* handled by interceptor */

      }

    },



    async fetchFaceVerification(id: string) {

      if (useMock || !this.user) return

      try {

        const { data } = await userAdminApi.getFaceVerification(id)

        this.user.faceVerificationStatus = mapFaceStatus(data)

        this.user.faceVerificationDetail = mapFaceVerificationDetail(data)

      } catch {

        /* optional endpoint */

      }

    },

    async fetchLivePhoto(id: string) {

      if (useMock || !this.user) return

      try {

        const { data } = await userAdminApi.getLivePhoto(id)

        this.user.livePhotoStatus = mapLivePhotoStatus(data)

        this.user.livePhotoDetail = mapLivePhotoDetail(data)

      } catch {

        /* optional endpoint */

      }

    },



    async fetchTransactionFilterTypes() {

      if (useMock) return

      try {

        const { data } = await userAdminApi.getTransactionFilterTypes()

        this.transactionFilterTypes = {

          coins: data.personalCoins?.filterValues ?? [],

          points: data.points?.filterValues ?? [],

          trading: data.tradingCoins?.filterValues ?? [],

        }

      } catch {

        /* optional */

      }

    },



    async fetchCoinTransactions(id: string, params: TransactionParams = {}, append = false) {

      const limit = params.limit ?? 20

      try {

        if (useMock) {

          await delay(200)

          const page = append ? 2 : 1

          const filtered = filterTransactions(mockCoinTransactions, params as never)

          const result = paginate(filtered, page, limit)

          this.coinTransactions = append

            ? [...this.coinTransactions, ...result.data]

            : result.data

          this.coinHasMore = result.hasMore

          return

        }

        const { data } = await userAdminApi.getCoinTransactions(id, { ...params, limit })

        const rows = userAdminApi.extractTransactions(data).map(mapTransaction)

        this.coinTransactions = append ? [...this.coinTransactions, ...rows] : rows

        this.coinCursor = data.nextCursor ?? null

        this.coinHasMore = Boolean(data.nextCursor ?? data.hasMore)

      } catch {

        /* handled by interceptor */

      }

    },



    async fetchPointTransactions(id: string, params: TransactionParams = {}, append = false) {

      const limit = params.limit ?? 20

      try {

        if (useMock) {

          await delay(200)

          const page = append ? 2 : 1

          const filtered = filterTransactions(mockPointTransactions, params as never)

          const result = paginate(filtered, page, limit)

          this.pointTransactions = append

            ? [...this.pointTransactions, ...result.data]

            : result.data

          this.pointHasMore = result.hasMore

          return

        }

        const { data } = await userAdminApi.getPointTransactions(id, { ...params, limit })

        const rows = userAdminApi.extractTransactions(data).map(mapPointTransaction)

        this.pointTransactions = append ? [...this.pointTransactions, ...rows] : rows

        this.pointCursor = data.nextCursor ?? null

        this.pointHasMore = Boolean(data.nextCursor ?? data.hasMore)

      } catch {

        /* handled by interceptor */

      }

    },



    async fetchTradingTransactions(id: string, params: TransactionParams = {}, append = false) {

      const limit = params.limit ?? 20

      try {

        if (useMock) return

        const { data } = await userAdminApi.getTradingCoinTransactions(id, { ...params, limit })

        const rows = userAdminApi.extractTransactions(data).map(mapTransaction)

        this.tradingTransactions = append ? [...this.tradingTransactions, ...rows] : rows

        this.tradingCursor = data.nextCursor ?? null

        this.tradingHasMore = Boolean(data.nextCursor ?? data.hasMore)

      } catch {

        /* handled by interceptor */

      }

    },



    async fetchPosts(id: string) {

      try {

        if (useMock) {

          await delay(200)

          this.posts = mockPosts

          return

        }

        const { data } = await userAdminApi.getPosts(id, { limit: 20 })

        this.posts = data.posts.map(mapPost)

      } catch {

        if (useMock) this.posts = mockPosts

      }

    },



    async fetchPostDetail(postId: string) {

      if (useMock) return this.posts.find((p) => p.id === postId)

      const { data } = await userAdminApi.getPost(postId)

      return mapPost(data)

    },



    async fetchReportsSummary(id: string) {

      try {

        if (useMock) {

          await delay(200)

          this.reportsSummary = mockReportsSummary

          return

        }

        const { data } = await userAdminApi.getUserLiveModeration(id, { limit: 1 })
        this.reportsSummary = {
          nudity: data.summary?.nudity ?? 0,
          abuse: data.summary?.abuse ?? 0,
          fakeStreaming: data.summary?.fakeStreaming ?? 0,
        }

      } catch {

        if (useMock) this.reportsSummary = mockReportsSummary

      }

    },



    async fetchLiveSummary(id: string) {

      try {

        if (useMock) {

          await delay(200)

          this.liveSummary = mockLiveSummary

          return

        }

        // Levels & activity come from user profile — derive from loaded user

        if (this.user) {

          this.liveSummary = {

            liveHours: this.user.streamLevel,

            receivingCount: this.user.wealthLevel,

          }

        }

      } catch {

        if (useMock) this.liveSummary = mockLiveSummary

      }

    },



    async updateUser(id: string, payload: UpdateUserPayload) {

      if (useMock) {

        await delay()

        if (this.user) {
          const nextFirst =
            payload.firstName !== undefined ? payload.firstName : this.user.firstName
          const nextLast =
            payload.lastName !== undefined
              ? payload.lastName === ''
                ? null
                : payload.lastName
              : this.user.lastName
          const composed = [nextFirst, nextLast]
            .map((p) => (p ?? '').trim())
            .filter(Boolean)
            .join(' ')

          this.user = {

            ...this.user,

            username: payload.username ?? this.user.username,

            firstName: nextFirst ?? null,

            lastName: nextLast ?? null,

            name: composed || payload.username || this.user.name,

            email: payload.email ?? this.user.email,

            mobile: payload.phone ?? this.user.mobile,

            gender: payload.gender ?? this.user.gender,

            country: payload.country ?? this.user.country,

            tags: payload.tags ?? this.user.tags,

          }

        }

        showToast('User updated successfully', 'success')

        return

      }



      // Send only dirty fields provided by the caller (partial PATCH).

      const patch: UpdateUserPayload = {}

      if (payload.username !== undefined) patch.username = payload.username

      if (payload.firstName !== undefined) patch.firstName = payload.firstName

      if (payload.lastName !== undefined) patch.lastName = payload.lastName

      if (payload.email !== undefined) patch.email = payload.email

      if (payload.phone !== undefined) patch.phone = payload.phone

      if (payload.gender !== undefined) patch.gender = payload.gender

      if (payload.country !== undefined) patch.country = payload.country

      if (payload.tags !== undefined) patch.tags = payload.tags

      if (!Object.keys(patch).length) {

        showToast('No changes to save', 'info')

        return

      }

      await userAdminApi.updateUser(id, patch)

      await this.fetchUser(id)

      showToast('User updated successfully', 'success')

    },



    async setUserStatus(id: string, options: StatusActionOptions) {

      if (useMock) {

        await delay()

        if (this.user) {

          this.user.status = options.action === 'ban' ? 'banned' : options.action === 'active' ? 'active' : 'inactive'

          this.user.rawStatus = options.action === 'ban' ? 'banned' : options.action

        }

        showToast(`User status updated to ${options.action}`, 'success')

        return

      }

      await userAdminApi.setUserStatus(id, options.action, {

        suspendDays: options.suspendDays,

        suspendedUntil: options.suspendedUntil,

      })

      await this.fetchUser(id)

      showToast(`User status updated to ${options.action}`, 'success')

    },



    async resetPassword(id: string, newPassword?: string) {
      if (useMock) {
        await delay()
        if (!newPassword) {
          showToast('Password reset successfully', 'success')
          return 'TempPass1!'
        }
        showToast('Password reset successfully', 'success')
        return undefined
      }

      const { data } = await userAdminApi.resetPassword(id, newPassword)
      showToast('Password reset successfully', 'success')
      return data.temporaryPassword
    },



    async revokeFaceVerification(id: string, options: FaceRevokeOptions = {}) {

      if (useMock) {

        await delay()

        if (this.user) {

          this.user.faceVerificationStatus = 'none'

          this.user.faceVerified = false

          this.user.genderEditable = true

        }

        showToast('Face verification revoked', 'success')

        return

      }

      await userAdminApi.revokeFaceVerification(id, options.reason, options.revokeRelated)

      // Refresh profile so genderEditable / faceVerified unlock for gender edits.

      await this.fetchUser(id)

      showToast('Face verification revoked', 'success')

    },

    async removeLivePhoto(id: string, options: LivePhotoRemoveOptions = {}) {

      if (useMock) {

        await delay()

        if (this.user) {

          this.user.livePhotoStatus = 'none'

          this.user.livePhotoDetail = {

            hasLivePhoto: false,

            isVerified: false,

            verificationState: 'NOT_UPLOADED',

            statusLabel: 'Not uploaded',

            statusDetail: 'This user has not uploaded a live photo.',

            imageUrl: null,

            pendingImageUrl: null,

          }

        }

        showToast('Live photo taken down', 'success')

        return

      }

      await userAdminApi.removeLivePhoto(id, options.reason)

      await this.fetchLivePhoto(id)

      showToast('Live photo taken down', 'success')

    },



    async walletAction(

      id: string,

      action:

        | 'addPersonalCoins'

        | 'deductPersonalCoins'

        | 'addTradingCoins'

        | 'deductTradingCoins'

        | 'addPoints'

        | 'deductPoints'

        | 'freezePersonalCoins'

        | 'unfreezePersonalCoins'

        | 'freezeTradingCoins'

        | 'unfreezeTradingCoins'

        | 'freezePoints'

        | 'unfreezePoints',

      amount?: number,

      description?: string,

    ) {

      if (useMock) {

        await delay()

        if (this.user && amount && action.includes('Personal')) {

          this.user.walletCoins += action.includes('add') ? amount : -amount

        }

        showToast('Wallet updated', 'success')

        return

      }



      const fnMap = {

        addPersonalCoins: () => userAdminApi.addPersonalCoins(id, amount!, description),

        deductPersonalCoins: () => userAdminApi.deductPersonalCoins(id, amount!, description),

        addTradingCoins: () => userAdminApi.addTradingCoins(id, amount!, description),

        deductTradingCoins: () => userAdminApi.deductTradingCoins(id, amount!, description),

        addPoints: () => userAdminApi.addPoints(id, amount!, description),

        deductPoints: () => userAdminApi.deductPoints(id, amount!, description),

        freezePersonalCoins: () => userAdminApi.freezePersonalCoins(id),

        unfreezePersonalCoins: () => userAdminApi.unfreezePersonalCoins(id),

        freezeTradingCoins: () => userAdminApi.freezeTradingCoins(id),

        unfreezeTradingCoins: () => userAdminApi.unfreezeTradingCoins(id),

        freezePoints: () => userAdminApi.freezePoints(id),

        unfreezePoints: () => userAdminApi.unfreezePoints(id),

      } as const



      await fnMap[action]()

      await this.fetchUser(id)

      showToast('Wallet updated', 'success')

    },



    async deletePost(postId: string) {

      if (useMock) {

        await delay()

        this.posts = this.posts.filter((p) => p.id !== postId)

        showToast('Post deleted', 'success')

        return

      }

      await userAdminApi.deletePost(postId)

      this.posts = this.posts.filter((p) => p.id !== postId)

      showToast('Post deleted', 'success')

    },



    async suspendPosting(id: string, suspendedUntil: string) {

      if (useMock) {

        await delay()

        if (this.user) {
          this.user.postingBanned = false
          this.user.postingSuspendedUntil = suspendedUntil
        }

        showToast('Posting suspended', 'success')

        return

      }

      await userAdminApi.suspendPosting(id, suspendedUntil)

      if (this.user) {
        this.user.postingBanned = false
        this.user.postingSuspendedUntil = suspendedUntil
      }

      await this.fetchUser(id)

      showToast('Posting suspended', 'success')

    },



    async banPosting(id: string) {

      if (useMock) {

        await delay()

        if (this.user) {
          this.user.postingBanned = true
          this.user.postingSuspendedUntil = null
        }

        showToast('Permanent posting ban applied', 'success')

        return

      }

      await userAdminApi.banPosting(id)

      if (this.user) {
        this.user.postingBanned = true
        this.user.postingSuspendedUntil = null
      }

      await this.fetchUser(id)

      showToast('Permanent posting ban applied', 'success')

    },



    async activatePosting(id: string) {

      if (useMock) {

        await delay()

        if (this.user) {
          this.user.postingBanned = false
          this.user.postingSuspendedUntil = null
        }

        showToast('Posting activated', 'success')

        return

      }

      await userAdminApi.activatePosting(id)

      if (this.user) {
        this.user.postingBanned = false
        this.user.postingSuspendedUntil = null
      }

      await this.fetchUser(id)

      showToast('Posting activated', 'success')

    },

    /** @deprecated Prefer activatePosting */
    async restorePosting(id: string) {
      return this.activatePosting(id)
    },



    async removeProfilePicture(id: string) {

      if (useMock) {

        await delay()

        if (this.user) this.user.avatar = undefined

        showToast('Profile picture removed', 'success')

        return

      }

      await userAdminApi.removeProfilePicture(id)

      await this.fetchUser(id)

      showToast('Profile picture removed', 'success')

    },



    async removeBio(id: string) {

      if (useMock) {

        await delay()

        showToast('Bio removed', 'success')

        return

      }

      await userAdminApi.removeBio(id)

      showToast('Bio removed', 'success')

    },



    async resetIdentity(id: string) {

      if (useMock) {

        await delay()

        if (this.user) this.user.name = `user_${this.user.publicId ?? id.slice(-4)}`

        showToast('Identity reset', 'success')

        return

      }

      await userAdminApi.resetIdentity(id)

      await this.fetchUser(id)

      showToast('Identity reset', 'success')

    },



    async removeFromAgency(id: string) {

      if (useMock) {

        await delay()

        if (this.user) {

          this.user.inAgency = false

          this.user.agencyName = undefined

          this.user.agencyPublicId = undefined

        }

        showToast('Removed from agency', 'success')

        return

      }

      await userAdminApi.removeFromAgency(id)

      await this.fetchUser(id)

      showToast('Removed from agency', 'success')

    },



    async banDevices(id: string, options: DeviceBanOptions = {}) {

      if (useMock) {

        await delay()

        showToast(options.deviceId ? 'Device banned' : 'All devices banned', 'success')

        return

      }

      await userAdminApi.banDevices(id, options)

      await this.fetchDevices(id)

      showToast(options.deviceId ? 'Device banned' : 'All devices banned', 'success')

    },



    async unbanDevice(deviceId: string, userId: string) {

      if (useMock) {

        await delay()

        showToast('Device ban lifted', 'success')

        return

      }

      await userAdminApi.unbanDevice(deviceId)

      await this.fetchDevices(userId)

      showToast('Device ban lifted', 'success')

    },

    async logoutAllDevices(id: string) {
      if (useMock) {
        await delay()
        this.devices = this.devices.map((d) => ({ ...d, hasActiveSession: false, sessionId: undefined }))
        showToast('Logged out all devices', 'success')
        return
      }
      const { data } = await userAdminApi.logoutAllDevices(id)
      await this.fetchDevices(id)
      showToast(data.message || 'Logged out all devices', 'success')
    },

  },

})

