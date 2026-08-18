import api from '@/api/client'
import type {
  AdminDisputedPayrollsPage,
  AdminPayrollAssignment,
  AdminPayrollAssignmentsPage,
  AdminPayrollAssignmentsQuery,
  AdminPendingPlatformPage,
  AdminWithdrawalDetail,
  CursorPageQuery,
} from '@/types/agencyPayroll'

export const agencyPayrollAdminApi = {
  listAssignments(params: AdminPayrollAssignmentsQuery = {}) {
    return api.get<AdminPayrollAssignmentsPage>('/admin/agency/payroll/assignments', { params })
  },

  getAssignment(assignmentId: string) {
    return api.get<AdminPayrollAssignment>(
      `/admin/agency/payroll/assignments/${encodeURIComponent(assignmentId)}`,
    )
  },

  listDisputed(params: CursorPageQuery = {}) {
    return api.get<AdminDisputedPayrollsPage>('/admin/agency/payroll/disputed', { params })
  },

  listPendingPlatform(params: CursorPageQuery = {}) {
    return api.get<AdminPendingPlatformPage>('/admin/agency/payroll/pending-platform', { params })
  },

  getWithdrawal(withdrawalId: string) {
    return api.get<AdminWithdrawalDetail>(
      `/admin/agency/withdrawal/${encodeURIComponent(withdrawalId)}`,
    )
  },

  getProofUploadUrl(withdrawalId: string, mimeType: string) {
    return api.post<{ uploadUrl: string; s3Key: string; s3Bucket: string }>(
      `/admin/agency/withdrawal/${encodeURIComponent(withdrawalId)}/proof-upload-url`,
      { mimeType },
    )
  },

  completePlatformPayout(withdrawalId: string, proofS3Key: string, proofS3Bucket: string) {
    return api.post<{ ok: boolean; hostPayoutPoints: string; waitingExpiresAt: string }>(
      `/admin/agency/withdrawal/${encodeURIComponent(withdrawalId)}/complete`,
      { proofS3Key, proofS3Bucket },
    )
  },

  assignWithdrawal(
    withdrawalId: string,
    agency?: { agencyUserId?: string; agencyPublicId?: string },
  ) {
    const body: { agencyUserId?: string; agencyPublicId?: string } = {}
    if (agency?.agencyUserId) body.agencyUserId = agency.agencyUserId
    if (agency?.agencyPublicId) body.agencyPublicId = agency.agencyPublicId
    return api.post<{ ok: boolean }>(
      `/admin/agency/withdrawal/${encodeURIComponent(withdrawalId)}/assign`,
      body,
    )
  },

  reverseWithdrawal(withdrawalId: string, reason: string) {
    return api.post(`/admin/agency/withdrawal/${encodeURIComponent(withdrawalId)}/reverse`, {
      reason,
    })
  },

  resolveDisputeFavourAgent(withdrawalId: string, reason: string) {
    return api.post<{ ok: boolean }>(
      `/admin/agency/withdrawal/${encodeURIComponent(withdrawalId)}/resolve-dispute/favour-agent`,
      { reason },
    )
  },

  resolveDisputeFavourHost(withdrawalId: string, reason: string, agencyUserId?: string) {
    return api.post<{ ok: boolean }>(
      `/admin/agency/withdrawal/${encodeURIComponent(withdrawalId)}/resolve-dispute/favour-host`,
      { reason, agencyUserId },
    )
  },
}
