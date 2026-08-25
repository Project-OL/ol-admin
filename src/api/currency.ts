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
  HouseAccountUpsertBody,
  HouseAccountsResponse,
  LedgerBreakageInvestigateResponse,
  LedgerGrain,
  LedgerReconciliationInvestigateResponse,
  MasterLedgerDashboard,
  MasterLedgerStock,
  TreasuryFlowClassifyBody,
  TreasuryFlowClassification,
  TreasuryFlowsResponse,
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

  investigateBreakage(params: { at?: string } = {}) {
    return api.get<LedgerBreakageInvestigateResponse>('/admin/ledger/investigate/breakage', {
      params,
    })
  },

  investigateReconciliation(
    params: {
      from?: string
      to?: string
      grain?: LedgerGrain
    } = {},
  ) {
    return api.get<LedgerReconciliationInvestigateResponse>(
      '/admin/ledger/investigate/reconciliation',
      { params },
    )
  },

  listHouseAccounts(params: { includeInactive?: boolean } = {}) {
    return api.get<HouseAccountsResponse>('/admin/ledger/house-accounts', { params })
  },

  upsertHouseAccount(body: HouseAccountUpsertBody) {
    return api.post('/admin/ledger/house-accounts', body)
  },

  deactivateHouseAccount(userId: string, body: { force?: boolean } = {}) {
    return api.delete(`/admin/ledger/house-accounts/${userId}`, { data: body })
  },

  listTreasuryFlows(
    params: {
      from?: string
      to?: string
      classification?: TreasuryFlowClassification
      senderUserId?: string
      cursor?: string
      limit?: number
    } = {},
  ) {
    return api.get<TreasuryFlowsResponse>('/admin/ledger/treasury-flows', { params })
  },

  classifyTreasuryFlow(body: TreasuryFlowClassifyBody) {
    return api.post('/admin/ledger/treasury-flows/classify', body)
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
