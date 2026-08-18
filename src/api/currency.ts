import api from '@/api/client'
import type {
  AdminCurrencyAdjustBody,
  AdminCurrencyAdjustmentsResponse,
  AdminCurrencyKind,
  AdminCurrencySupplySummary,
} from '@/types/currency'

export const currencyApi = {
  adjust(body: AdminCurrencyAdjustBody) {
    return api.post('/admin/currency/adjust', body)
  },

  supplySummary(params: { from?: string; to?: string } = {}) {
    return api.get<AdminCurrencySupplySummary>('/admin/currency/supply-summary', { params })
  },

  listAdjustments(
    params: {
      currency?: AdminCurrencyKind
      direction?: 'credit' | 'debit'
      userId?: string
      from?: string
      to?: string
      cursor?: string
      limit?: number
    } = {},
  ) {
    return api.get<AdminCurrencyAdjustmentsResponse>('/admin/currency/adjustments', { params })
  },
}
