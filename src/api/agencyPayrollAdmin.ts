import api from '@/api/client'
import type {
  AdminDisputedPayrollsPage,
  AdminPayrollAssignment,
  AdminPayrollAssignmentsPage,
  AdminPayrollAssignmentsQuery,
  AdminPendingPlatformPage,
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

  assignWithdrawal(withdrawalId: string, agencyUserId?: string) {
    return api.post<{ ok: boolean }>(
      `/admin/agency/withdrawal/${encodeURIComponent(withdrawalId)}/assign`,
      agencyUserId ? { agencyUserId } : {},
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
