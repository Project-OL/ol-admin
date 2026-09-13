import { defineStore } from 'pinia'
import { agencyPayrollAdminApi } from '@/api/agencyPayrollAdmin'
import type {
  AdminDisputedPayrollItem,
  AdminPayrollAssignment,
  AdminPayrollAssignmentsQuery,
  AdminPendingPlatformWithdrawal,
  AdminWithdrawalDetail,
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

    pendingAdminPay: [] as AdminPendingPlatformWithdrawal[],
    pendingAdminPayCursor: null as string | null,
    pendingAdminPayHasMore: false,
    loadingAdminPay: false,
    loadingMoreAdminPay: false,

    pendingAssign: [] as AdminPendingPlatformWithdrawal[],
    pendingAssignCursor: null as string | null,
    pendingAssignHasMore: false,
    loadingAssignQueue: false,
    loadingMoreAssignQueue: false,

    detail: null as AdminPayrollAssignment | null,
    withdrawalDetail: null as AdminWithdrawalDetail | null,
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

    async fetchPendingAdminPay(append = false) {
      if (append) this.loadingMoreAdminPay = true
      else this.loadingAdminPay = true
      try {
        const { data } = await agencyPayrollAdminApi.listPendingPlatform({
          limit: 20,
          handler: 'PLATFORM',
          cursor: append ? (this.pendingAdminPayCursor ?? undefined) : undefined,
        })
        this.pendingAdminPay = append ? [...this.pendingAdminPay, ...data.items] : data.items
        this.pendingAdminPayCursor = data.nextCursor ?? null
        this.pendingAdminPayHasMore = data.hasMore
      } finally {
        this.loadingAdminPay = false
        this.loadingMoreAdminPay = false
      }
    },

    async fetchPendingAssign(append = false) {
      if (append) this.loadingMoreAssignQueue = true
      else this.loadingAssignQueue = true
      try {
        const { data } = await agencyPayrollAdminApi.listPendingPlatform({
          limit: 20,
          handler: 'AGENCY',
          cursor: append ? (this.pendingAssignCursor ?? undefined) : undefined,
        })
        this.pendingAssign = append ? [...this.pendingAssign, ...data.items] : data.items
        this.pendingAssignCursor = data.nextCursor ?? null
        this.pendingAssignHasMore = data.hasMore
      } finally {
        this.loadingAssignQueue = false
        this.loadingMoreAssignQueue = false
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

    async fetchWithdrawalDetail(withdrawalId: string) {
      this.loadingDetail = true
      try {
        const { data } = await agencyPayrollAdminApi.getWithdrawal(withdrawalId)
        this.withdrawalDetail = data
        return data
      } finally {
        this.loadingDetail = false
      }
    },

    clearDetail() {
      this.detail = null
      this.withdrawalDetail = null
    },

    async completePlatformPayout(withdrawalId: string, file: File) {
      this.acting = true
      try {
        const { data: presign } = await agencyPayrollAdminApi.getProofUploadUrl(
          withdrawalId,
          file.type || 'image/jpeg',
        )
        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file,
        })
        if (!putRes.ok) {
          throw new Error(`Screenshot upload failed: ${putRes.status}`)
        }
        await agencyPayrollAdminApi.completePlatformPayout(
          withdrawalId,
          presign.s3Key,
          presign.s3Bucket,
        )
        showToast('EPAY payout marked waiting', 'success')
        await this.fetchPendingAdminPay()
        if (this.withdrawalDetail?.id === withdrawalId) {
          await this.fetchWithdrawalDetail(withdrawalId)
        }
      } finally {
        this.acting = false
      }
    },

    async updatePayrollProof(
      withdrawalId: string,
      file: File,
      target: { assignmentId?: string; agencyUserId?: string; agencyPublicId?: string },
      reason?: string,
    ) {
      this.acting = true
      try {
        const { data: presign } = await agencyPayrollAdminApi.getPayrollProofUploadUrl(
          withdrawalId,
          file.type || 'image/jpeg',
        )
        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file,
        })
        if (!putRes.ok) {
          throw new Error(`Screenshot upload failed: ${putRes.status}`)
        }
        const { data } = await agencyPayrollAdminApi.updatePayrollProof(withdrawalId, {
          ...target,
          proofS3Key: presign.s3Key,
          proofS3Bucket: presign.s3Bucket,
          reason: reason?.trim() || undefined,
        })
        showToast('Payroll screenshot updated', 'success')
        if (this.detail?.withdrawal.withdrawalId === withdrawalId) {
          await this.fetchDetail(this.detail.assignmentId)
        }
        if (this.withdrawalDetail?.id === withdrawalId) {
          await this.fetchWithdrawalDetail(withdrawalId)
        }
        return data
      } finally {
        this.acting = false
      }
    },

    async completePayrollManually(
      withdrawalId: string,
      file: File,
      agency: { agencyUserId?: string; agencyPublicId?: string },
      reason?: string,
    ) {
      this.acting = true
      try {
        const { data: presign } = await agencyPayrollAdminApi.getPayrollCompleteUploadUrl(
          withdrawalId,
          file.type || 'image/jpeg',
        )
        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file,
        })
        if (!putRes.ok) {
          throw new Error(`Screenshot upload failed: ${putRes.status}`)
        }
        const { data } = await agencyPayrollAdminApi.completePayrollManually(withdrawalId, {
          ...agency,
          proofS3Key: presign.s3Key,
          proofS3Bucket: presign.s3Bucket,
          reason: reason?.trim() || undefined,
        })
        showToast('Payroll marked complete - waiting on host review', 'success')
        if (this.detail?.withdrawal.withdrawalId === withdrawalId) {
          await this.fetchDetail(this.detail.assignmentId)
        }
        if (this.withdrawalDetail?.id === withdrawalId) {
          await this.fetchWithdrawalDetail(withdrawalId)
        }
        return data
      } finally {
        this.acting = false
      }
    },

    async assignWithdrawal(
      withdrawalId: string,
      agency?: { agencyUserId?: string; agencyPublicId?: string },
    ) {
      this.acting = true
      try {
        await agencyPayrollAdminApi.assignWithdrawal(withdrawalId, agency)
        showToast('Withdrawal assigned', 'success')
        if (this.detail?.withdrawal.withdrawalId === withdrawalId) {
          await this.fetchDetail(this.detail.assignmentId)
        }
        if (this.withdrawalDetail?.id === withdrawalId) {
          await this.fetchWithdrawalDetail(withdrawalId)
        }
        await this.fetchPendingAssign()
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
        if (this.withdrawalDetail?.id === withdrawalId) {
          await this.fetchWithdrawalDetail(withdrawalId)
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
        if (this.withdrawalDetail?.id === withdrawalId) {
          await this.fetchWithdrawalDetail(withdrawalId)
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
        if (this.withdrawalDetail?.id === withdrawalId) {
          await this.fetchWithdrawalDetail(withdrawalId)
        }
        await this.fetchDisputed()
      } finally {
        this.acting = false
      }
    },
  },
})
