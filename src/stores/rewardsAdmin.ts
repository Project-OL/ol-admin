import { defineStore } from 'pinia'
import { rewardsAdminApi } from '@/api/rewardsAdmin'
import { transactionsApi } from '@/api/transactions'
import type { ListRewardClaimsQuery, RewardClaimUser } from '@/types/rewards'

export const useRewardsAdminStore = defineStore('rewardsAdmin', {
  state: () => ({
    users: [] as RewardClaimUser[],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    reverting: null as string | null,
  }),

  actions: {
    async fetchClaims(query: ListRewardClaimsQuery = {}) {
      this.loading = true
      try {
        const page = query.page ?? this.page
        const limit = query.limit ?? this.limit
        const { data } = await rewardsAdminApi.listClaims({ ...query, page, limit })
        this.users = data.users
        this.total = data.total
        this.page = data.page
        this.limit = data.limit
      } finally {
        this.loading = false
      }
    },

    async revertClaim(ledgerEntryId: string, reason: string) {
      this.reverting = ledgerEntryId
      try {
        await transactionsApi.revertSinglePoint(ledgerEntryId, {
          reason,
          idempotencyKey: `admin-reward-revert-${ledgerEntryId}-${Date.now()}`,
        })
        for (const user of this.users) {
          const claim = user.claims.find((c) => c.ledgerEntryId === ledgerEntryId)
          if (claim) claim.reverted = true
        }
      } finally {
        this.reverting = null
      }
    },
  },
})
