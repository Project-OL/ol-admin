import api, { walletIdempotencyKey } from '@/api/client'
import type {
  AgencyBanPayload,
  AgencyBanResponse,
  AgencyCommissionHistoryQuery,
  AgencyCommissionHistoryResponse,
  AgencyDetail,
  AgencyHostEarningsResponse,
  AgencyListQuery,
  AgencyListResponse,
  AgencyOverviewStats,
  AgencyPayrollResponse,
  AgencyPeriodQuery,
  AgencyRecomputeLevelResponse,
  AgencyRecomputeMasterResponse,
  AgencyUnbarResponse,
  ApproveApplicationPayload,
  PendingApplicationsResponse,
  RejectApplicationPayload,
  SuspendAgencyPayload,
  TransferHostsPayload,
} from '@/types/agency'

export const agencyAdminApi = {
  getStats() {
    return api.get<AgencyOverviewStats>('/admin/agency/stats')
  },

  listAgencies(params: AgencyListQuery = {}) {
    return api.get<AgencyListResponse>('/admin/agency', { params })
  },

  listPendingApplications(params: { skip?: number; take?: number } = {}) {
    return api.get<PendingApplicationsResponse>('/admin/agency/applications/pending', { params })
  },

  getAgency(identifier: string) {
    return api.get<AgencyDetail>(`/admin/agency/${encodeURIComponent(identifier)}`)
  },

  approveApplication(applicantUserId: string, payload: ApproveApplicationPayload) {
    return api.post<{ ok: boolean; created: boolean; agencyPublicId: string }>(
      `/admin/agency/${applicantUserId}/approve`,
      payload,
    )
  },

  rejectApplication(applicantUserId: string, payload: RejectApplicationPayload) {
    return api.post(`/admin/agency/applications/${applicantUserId}/reject`, payload)
  },

  updateCommissionTier(agencyIdentifier: string, commissionTier: string) {
    return api.patch(`/admin/agency/${encodeURIComponent(agencyIdentifier)}/commission-tier`, {
      commissionTier,
    })
  },

  addHost(agencyIdentifier: string, hostUserId: string) {
    return api.post(`/admin/agency/${encodeURIComponent(agencyIdentifier)}/hosts`, { hostUserId })
  },

  transferHosts(agencyIdentifier: string, payload: TransferHostsPayload) {
    return api.post(`/admin/agency/${encodeURIComponent(agencyIdentifier)}/transfer-hosts`, payload)
  },

  suspendAgency(agencyIdentifier: string, payload: SuspendAgencyPayload) {
    return api.post(`/admin/agency/${encodeURIComponent(agencyIdentifier)}/suspend`, payload)
  },

  unpauseAgency(agencyUserId: string) {
    return api.post(`/admin/agency/${agencyUserId}/unpause`)
  },

  /**
   * Admin grant/revoke payroll privilege.
   * Body field is historically named `payrollEnabled` but means privilege.
   * Revoke also forces agent accept (`payrollEnabled`) off.
   */
  setPayrollPrivilege(agencyIdentifier: string, privilegeGranted: boolean) {
    return api.patch<AgencyPayrollResponse>(
      `/admin/agency/${encodeURIComponent(agencyIdentifier)}/payroll`,
      { payrollEnabled: privilegeGranted },
    )
  },

  /** @deprecated Use setPayrollPrivilege */
  setPayroll(agencyIdentifier: string, payrollEnabled: boolean) {
    return this.setPayrollPrivilege(agencyIdentifier, payrollEnabled)
  },

  banAgency(agencyIdentifier: string, payload: AgencyBanPayload = {}) {
    return api.post<AgencyBanResponse>(
      `/admin/agency/${encodeURIComponent(agencyIdentifier)}/ban`,
      payload,
    )
  },

  unbarUser(userId: string) {
    return api.post<AgencyUnbarResponse>(`/admin/agency/barred/${userId}/unbar`)
  },

  deleteAgency(agencyIdentifier: string) {
    return api.delete(`/admin/agency/${encodeURIComponent(agencyIdentifier)}`)
  },

  recomputeLevel(agencyIdentifier: string) {
    return api.post<AgencyRecomputeLevelResponse>(
      `/admin/agency/${encodeURIComponent(agencyIdentifier)}/recompute-level`,
    )
  },

  recomputeMaster(params: { utcDate?: string } = {}) {
    return api.post<AgencyRecomputeMasterResponse>('/admin/agency/recompute-master', undefined, {
      params,
    })
  },

  listHostEarnings(agencyIdentifier: string, params: AgencyPeriodQuery = {}) {
    return api.get<AgencyHostEarningsResponse>(
      `/admin/agency/${encodeURIComponent(agencyIdentifier)}/hosts/earnings`,
      { params },
    )
  },

  listCommissionHistory(agencyIdentifier: string, params: AgencyCommissionHistoryQuery = {}) {
    return api.get<AgencyCommissionHistoryResponse>(
      `/admin/agency/${encodeURIComponent(agencyIdentifier)}/commission/history`,
      { params },
    )
  },

  creditWallet(
    userId: string,
    payload: { points?: string; coins?: string; tradingCoins?: string; description?: string },
  ) {
    return api.post(`/admin/agency/users/${userId}/wallet/credit`, {
      ...payload,
      idempotencyKey: walletIdempotencyKey('agency-credit'),
    })
  },
}
