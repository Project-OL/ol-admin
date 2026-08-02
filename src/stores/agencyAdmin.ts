import { defineStore } from 'pinia'
import axios from 'axios'
import { agencyAdminApi } from '@/api/agencyAdmin'
import { usePlatformMessagesStore } from '@/stores/platformMessages'
import type {
  AgencyBanPayload,
  AgencyCommissionHistoryQuery,
  AgencyDetail,
  AgencyListItem,
  AgencyListQuery,
  AgencyOverviewStats,
  AgencyPeriodQuery,
  ApproveApplicationPayload,
  PendingApplication,
  RejectApplicationPayload,
  SuspendAgencyPayload,
} from '@/types/agency'
import { showToast } from '@/utils/toast'

export const useAgencyAdminStore = defineStore('agencyAdmin', {
  state: () => ({
    stats: null as AgencyOverviewStats | null,
    agencies: [] as AgencyListItem[],
    agenciesTotal: 0,
    agenciesSkip: 0,
    agenciesTake: 20,
    pending: [] as PendingApplication[],
    pendingTotal: 0,
    pendingSkip: 0,
    detail: null as AgencyDetail | null,
    /** Kept after ban so ops can unbar without hunting the UUID */
    lastBannedAgencyUserId: null as string | null,
    loadingStats: false,
    loadingList: false,
    loadingPending: false,
    loadingDetail: false,
  }),

  actions: {
    async fetchStats() {
      this.loadingStats = true
      try {
        const { data } = await agencyAdminApi.getStats()
        this.stats = data
      } finally {
        this.loadingStats = false
      }
    },

    async fetchAgencies(params: AgencyListQuery = {}) {
      this.loadingList = true
      try {
        const skip = params.skip ?? this.agenciesSkip
        const take = params.take ?? this.agenciesTake
        const { data } = await agencyAdminApi.listAgencies({ ...params, skip, take })
        this.agencies = data.items
        this.agenciesTotal = data.total
        this.agenciesSkip = data.skip
        this.agenciesTake = data.take
      } finally {
        this.loadingList = false
      }
    },

    async fetchPending(params: { skip?: number; take?: number } = {}) {
      this.loadingPending = true
      try {
        const skip = params.skip ?? this.pendingSkip
        const take = params.take ?? 20
        const { data } = await agencyAdminApi.listPendingApplications({ skip, take })
        this.pending = data.items
        this.pendingTotal = data.total
        this.pendingSkip = data.skip
      } finally {
        this.loadingPending = false
      }
    },

    async fetchDetail(identifier: string) {
      this.loadingDetail = true
      try {
        const { data } = await agencyAdminApi.getAgency(identifier)
        this.detail = data
        return data
      } finally {
        this.loadingDetail = false
      }
    },

    clearDetail() {
      this.detail = null
    },

    async approveApplication(applicantUserId: string, payload: ApproveApplicationPayload) {
      try {
        const { data } = await agencyAdminApi.approveApplication(applicantUserId, payload)
        showToast(`Agency approved (${data.agencyPublicId})`, 'success')
        await Promise.all([this.fetchPending(), this.fetchStats(), this.fetchAgencies()])
        return data
      } catch (err) {
        const code = axios.isAxiosError(err)
          ? (err.response?.data as { code?: string } | undefined)?.code
          : undefined
        if (code === 'AGENCY_BARRED') {
          showToast('User is agency-barred — unbar before approving', 'error')
        }
        throw err
      }
    },

    async rejectApplication(applicantUserId: string, payload: RejectApplicationPayload) {
      await agencyAdminApi.rejectApplication(applicantUserId, payload)
      showToast('Application rejected', 'success')
      await this.fetchPending()
    },

    async updateCommissionTier(agencyIdentifier: string, commissionTier: string) {
      await agencyAdminApi.updateCommissionTier(agencyIdentifier, commissionTier)
      showToast(`Commission tier set to ${commissionTier}`, 'success')
      await this.fetchDetail(agencyIdentifier)
    },

    async sendSystemMessageToOwner(agencyUserId: string, message: string) {
      const platformStore = usePlatformMessagesStore()
      await platformStore.sendSystemMessage(agencyUserId, message)
    },

    async addHost(agencyIdentifier: string, hostUserId: string) {
      await agencyAdminApi.addHost(agencyIdentifier, hostUserId)
      showToast('Host added to agency', 'success')
      await this.fetchDetail(agencyIdentifier)
    },

    async transferHosts(
      agencyIdentifier: string,
      targetAgencyIdentifier: string,
      hostUserIds: string[],
    ) {
      await agencyAdminApi.transferHosts(agencyIdentifier, { targetAgencyIdentifier, hostUserIds })
      showToast('Hosts transferred', 'success')
      await this.fetchDetail(agencyIdentifier)
    },

    async suspendAgency(agencyIdentifier: string, payload: SuspendAgencyPayload) {
      await agencyAdminApi.suspendAgency(agencyIdentifier, payload)
      showToast('Agency suspended', 'success')
      await Promise.all([this.fetchDetail(agencyIdentifier), this.fetchAgencies()])
    },

    async unpauseAgency(agencyUserId: string, agencyIdentifier: string) {
      await agencyAdminApi.unpauseAgency(agencyUserId)
      showToast('Agency reactivated', 'success')
      await Promise.all([this.fetchDetail(agencyIdentifier), this.fetchAgencies()])
    },

    /**
     * Grant or revoke payroll privilege (admin-only).
     * Revoke forces agent accept off so assignments stop immediately.
     */
    async setPayrollPrivilege(agencyIdentifier: string, privilegeGranted: boolean) {
      const { data } = await agencyAdminApi.setPayrollPrivilege(agencyIdentifier, privilegeGranted)
      showToast(
        privilegeGranted
          ? 'Payroll privilege granted — agent can turn accept on'
          : 'Payroll privilege revoked — accept forced off',
        'success',
      )
      if (this.detail) {
        this.detail.payrollPrivilegeGranted = data.payrollPrivilegeGranted
        this.detail.payrollEnabled = data.payrollEnabled
      }
      await this.fetchDetail(agencyIdentifier)
      return data
    },

    /** @deprecated Prefer setPayrollPrivilege */
    async setPayroll(agencyIdentifier: string, payrollEnabled: boolean) {
      return this.setPayrollPrivilege(agencyIdentifier, payrollEnabled)
    },

    async banAgency(agencyIdentifier: string, payload: AgencyBanPayload = {}) {
      const { data } = await agencyAdminApi.banAgency(agencyIdentifier, payload)
      showToast('Agency banned and barred from re-applying', 'success')
      this.lastBannedAgencyUserId = data.agencyUserId
      this.detail = null
      await Promise.all([this.fetchStats(), this.fetchAgencies()])
      return data
    },

    async unbarUser(userId: string) {
      try {
        const { data } = await agencyAdminApi.unbarUser(userId)
        showToast('Agency bar cleared — user can re-apply', 'success')
        if (this.lastBannedAgencyUserId === userId) this.lastBannedAgencyUserId = null
        return data
      } catch (err) {
        const code = axios.isAxiosError(err)
          ? (err.response?.data as { code?: string } | undefined)?.code
          : undefined
        if (code === 'NOT_AGENCY_BARRED') {
          showToast('User is not agency-barred', 'error')
        }
        throw err
      }
    },

    async deleteAgency(agencyIdentifier: string) {
      await agencyAdminApi.deleteAgency(agencyIdentifier)
      showToast('Agency deleted', 'success')
      this.detail = null
      await Promise.all([this.fetchStats(), this.fetchAgencies()])
    },

    async recomputeLevel(agencyIdentifier: string) {
      const { data } = await agencyAdminApi.recomputeLevel(agencyIdentifier)
      const before = data.before.currentLevel
      const after = data.after.currentLevel
      showToast(
        before === after
          ? `Tier unchanged (${after}) · window ${formatPointsWindow(data.after.currentWindowTotalPoints)} pts`
          : `Tier ${before} → ${after}`,
        'success',
      )
      await this.fetchDetail(agencyIdentifier)
      return data
    },

    async recomputeMaster() {
      const { data } = await agencyAdminApi.recomputeMaster()
      showToast('All-agency tier recompute queued for the worker', 'success')
      return data
    },

    async fetchHostEarnings(agencyIdentifier: string, params: AgencyPeriodQuery = {}) {
      const { data } = await agencyAdminApi.listHostEarnings(agencyIdentifier, params)
      return data
    },

    async fetchCommissionHistory(
      agencyIdentifier: string,
      params: AgencyCommissionHistoryQuery = {},
    ) {
      const { data } = await agencyAdminApi.listCommissionHistory(agencyIdentifier, params)
      return data
    },
  },
})

function formatPointsWindow(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return new Intl.NumberFormat('en-IN').format(n)
}
