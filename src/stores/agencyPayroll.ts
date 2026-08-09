import { defineStore } from 'pinia'
import { agencyPayrollAdminApi } from '@/api/agencyPayrollAdmin'
import type {
  AdminDisputedPayrollItem,
  AdminPayrollAssignment,
  AdminPayrollAssignmentsQuery,
  AdminPendingPlatformWithdrawal,
} from '@/types/agencyPayroll'
import { showToast } from '@/utils/toast'

export const useAgencyPayrollStore = defineStore('agencyPayroll', {
  state: () => ({
    assignments: [] as AdminPayrollAssignment[],
    assignmentsCursor: null as string | null,
    assignmentsHasMore: false,
    loadingAssignments: false,
    loadingMoreAssignments: false,

    disputed: [] as AdminDisputedPayrollItem[],
    disputedCursor: null as string | null,
    disputedHasMore: false,
    loadingDisputed: false,
    loadingMoreDisputed: false,

    pendingPlatform: [] as AdminPendingPlatformWithdrawal[],
    pendingCursor: null as string | null,
    pendingHasMore: false,
    loadingPending: false,
    loadingMorePending: false,

    detail: null as AdminPayrollAssignment | null,
    loadingDetail: false,
    acting: false,
  }),

  actions: {
    async fetchAssignments(params: AdminPayrollAssignmentsQuery = {}, append = false) {
      if (append) this.loadingMoreAssignments = true
      else this.loadingAssignments = true
      try {
        const { data } = await agencyPayrollAdminApi.listAssignments({
          limit: 20,
          ...params,
          cursor: append ? (this.assignmentsCursor ?? undefined) : undefined,
        })
        this.assignments = append ? [...this.assignments, ...data.items] : data.items
        this.assignmentsCursor = data.nextCursor
        this.assignmentsHasMore = data.hasMore
      } finally {
        this.loadingAssignments = false
        this.loadingMoreAssignments = false
      }
    },

    async fetchDisputed(append = false) {
      if (append) this.loadingMoreDisputed = true
      else this.loadingDisputed = true
      try {
        const { data } = await agencyPayrollAdminApi.listDisputed({
          limit: 20,
          cursor: append ? (this.disputedCursor ?? undefined) : undefined,
        })
        this.disputed = append ? [...this.disputed, ...data.items] : data.items
        this.disputedCursor = data.nextCursor
        this.disputedHasMore = data.hasMore
      } finally {
        this.loadingDisputed = false
        this.loadingMoreDisputed = false
      }
    },

    async fetchPendingPlatform(append = false) {
      if (append) this.loadingMorePending = true
      else this.loadingPending = true
      try {
        const { data } = await agencyPayrollAdminApi.listPendingPlatform({
          limit: 20,
          cursor: append ? (this.pendingCursor ?? undefined) : undefined,
        })
        this.pendingPlatform = append ? [...this.pendingPlatform, ...data.items] : data.items
        this.pendingCursor = data.nextCursor ?? null
        this.pendingHasMore = data.hasMore
      } finally {
        this.loadingPending = false
        this.loadingMorePending = false
      }
    },

    async fetchDetail(assignmentId: string) {
      this.loadingDetail = true
      try {
        const { data } = await agencyPayrollAdminApi.getAssignment(assignmentId)
        this.detail = data
        return data
      } finally {
        this.loadingDetail = false
      }
    },

    clearDetail() {
      this.detail = null
    },

    async assignWithdrawal(withdrawalId: string, agencyUserId?: string) {
      this.acting = true
      try {
        await agencyPayrollAdminApi.assignWithdrawal(withdrawalId, agencyUserId)
        showToast('Withdrawal assigned', 'success')
        if (this.detail?.withdrawal.withdrawalId === withdrawalId) {
          await this.fetchDetail(this.detail.assignmentId)
        }
      } finally {
        this.acting = false
      }
    },

    async reverseWithdrawal(withdrawalId: string, reason: string) {
      this.acting = true
      try {
        await agencyPayrollAdminApi.reverseWithdrawal(withdrawalId, reason)
        showToast('Withdrawal reversed', 'success')
        if (this.detail?.withdrawal.withdrawalId === withdrawalId) {
          await this.fetchDetail(this.detail.assignmentId)
        }
      } finally {
        this.acting = false
      }
    },

    async resolveFavourAgent(withdrawalId: string, reason: string) {
      this.acting = true
      try {
        await agencyPayrollAdminApi.resolveDisputeFavourAgent(withdrawalId, reason)
        showToast('Dispute resolved in favour of agent', 'success')
        if (this.detail?.withdrawal.withdrawalId === withdrawalId) {
          await this.fetchDetail(this.detail.assignmentId)
        }
        await this.fetchDisputed()
      } finally {
        this.acting = false
      }
    },

    async resolveFavourHost(withdrawalId: string, reason: string, agencyUserId?: string) {
      this.acting = true
      try {
        await agencyPayrollAdminApi.resolveDisputeFavourHost(withdrawalId, reason, agencyUserId)
        showToast('Dispute resolved in favour of host', 'success')
        if (this.detail?.withdrawal.withdrawalId === withdrawalId) {
          await this.fetchDetail(this.detail.assignmentId)
        }
        await this.fetchDisputed()
      } finally {
        this.acting = false
      }
    },
  },
})
