import api from '@/api/client'
import type {
  AdminCurrencyAdjustBody,
  AdminCurrencyAdjustmentsResponse,
  AdminCurrencyKind,
  AdminCurrencySupplySummary,
  CompanyCashCreateBody,
  CompanyCashDirection,
  CompanyCashJournalResponse,
  CompanyCashReason,
  LedgerGrain,
  MasterLedgerDashboard,
  MasterLedgerStock,
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

  ledgerStock(params: { at?: string } = {}) {
    return api.get<MasterLedgerStock>('/admin/ledger/stock', { params })
  },

  ledgerPnl(
    params: {
      from?: string
      to?: string
      grain?: LedgerGrain
      at?: string
    } = {},
  ) {
    return api.get<MasterLedgerDashboard>('/admin/ledger/pnl', { params })
  },

  listCashJournal(
    params: {
      from?: string
      to?: string
      reason?: CompanyCashReason
      direction?: CompanyCashDirection
      cursor?: string
      limit?: number
    } = {},
  ) {
    return api.get<CompanyCashJournalResponse>('/admin/currency/cash-journal', { params })
  },

  createCashJournal(body: CompanyCashCreateBody) {
    return api.post('/admin/currency/cash-journal', body)
  },
}
