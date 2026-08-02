import api from '@/api/client'
import type {
  OtpAuditListParams,
  OtpCostRates,
  OtpCostsByCountry,
  OtpDeliveryAuditList,
  OtpDeliveryAuditSummary,
  OtpMonthParams,
  OtpMonthlyCosts,
} from '@/types/otpAudit'

export const otpAuditApi = {
  listAudits(params: OtpAuditListParams = {}) {
    return api.get<OtpDeliveryAuditList>('/admin/otp-delivery/audits', { params })
  },

  summarizeAudits(params: Omit<OtpAuditListParams, 'page' | 'limit'> = {}) {
    return api.get<OtpDeliveryAuditSummary>('/admin/otp-delivery/audits/summary', { params })
  },

  getCostRates() {
    return api.get<OtpCostRates>('/admin/otp-delivery/cost-rates')
  },

  getMonthlyCosts(params: OtpMonthParams = {}) {
    return api.get<OtpMonthlyCosts>('/admin/otp-delivery/costs/monthly', { params })
  },

  getCostsByCountry(params: OtpMonthParams = {}) {
    return api.get<OtpCostsByCountry>('/admin/otp-delivery/costs/by-country', { params })
  },
}
