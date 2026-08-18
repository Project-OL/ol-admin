import api from '@/api/client'
import type {
  AdminCoinTradingTransfer,
  AdminGiftTransaction,
  AdminLedgerEntry,
  AdminStorePurchase,
  AdminSubscription,
  AdminTransactionRevertBody,
  AdminTransactionsListQuery,
  AdminTransactionsListResponse,
  AdminVipPurchase,
  PlatformProfitSummaryResponse,
  TransactionsTab,
} from '@/types/transactions'

export const transactionsApi = {
  platformProfitSummary(params: { from?: string; to?: string } = {}) {
    return api.get<PlatformProfitSummaryResponse>(
      '/admin/transactions/platform-profit/summary',
      { params },
    )
  },

  list(tab: TransactionsTab, params: AdminTransactionsListQuery = {}) {
    return api.get<AdminTransactionsListResponse>(`/admin/transactions/${tab}`, { params })
  },

  listCoins(params: AdminTransactionsListQuery = {}) {
    return api.get<AdminTransactionsListResponse<AdminLedgerEntry>>('/admin/transactions/coins', {
      params,
    })
  },

  listPoints(params: AdminTransactionsListQuery = {}) {
    return api.get<AdminTransactionsListResponse<AdminLedgerEntry>>('/admin/transactions/points', {
      params,
    })
  },

  listTradingCoins(params: AdminTransactionsListQuery = {}) {
    return api.get<AdminTransactionsListResponse<AdminLedgerEntry>>(
      '/admin/transactions/trading-coins',
      { params },
    )
  },

  listCoinTradingTransfers(params: AdminTransactionsListQuery = {}) {
    return api.get<AdminTransactionsListResponse<AdminCoinTradingTransfer>>(
      '/admin/transactions/coin-trading-transfers',
      { params },
    )
  },

  listGifts(params: AdminTransactionsListQuery = {}) {
    return api.get<AdminTransactionsListResponse<AdminGiftTransaction>>(
      '/admin/transactions/gifts',
      { params },
    )
  },

  listSubscriptions(params: AdminTransactionsListQuery = {}) {
    return api.get<AdminTransactionsListResponse<AdminSubscription>>(
      '/admin/transactions/subscriptions',
      { params },
    )
  },

  listVipPurchases(params: AdminTransactionsListQuery = {}) {
    return api.get<AdminTransactionsListResponse<AdminVipPurchase>>(
      '/admin/transactions/vip-purchases',
      { params },
    )
  },

  listStorePurchases(params: AdminTransactionsListQuery = {}) {
    return api.get<AdminTransactionsListResponse<AdminStorePurchase>>(
      '/admin/transactions/store-purchases',
      { params },
    )
  },

  revertCoin(ledgerEntryId: string, body: AdminTransactionRevertBody) {
    return api.post(`/admin/transactions/coins/${ledgerEntryId}/revert`, body)
  },

  revertPoint(ledgerEntryId: string, body: AdminTransactionRevertBody) {
    return api.post(`/admin/transactions/points/${ledgerEntryId}/revert`, body)
  },

  revertCoinTradingTransfer(transferId: string, body: AdminTransactionRevertBody) {
    return api.post(`/admin/transactions/coin-trading-transfers/${transferId}/revert`, body)
  },

  revertWithdrawal(withdrawalId: string, body: AdminTransactionRevertBody) {
    return api.post(`/admin/agency/withdrawal/${encodeURIComponent(withdrawalId)}/reverse`, {
      reason: body.reason,
    })
  },

  revertGift(giftTransactionId: string, body: AdminTransactionRevertBody) {
    return api.post(`/admin/transactions/gifts/${giftTransactionId}/revert`, body)
  },
}
