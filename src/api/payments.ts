import api from '@/api/client'
import type {
  AdminPaymentRefundBody,
  AdminPaymentRefundResult,
  PaymentSuspect,
  PaymentSuspectListQuery,
  PaymentSuspectListResponse,
  PaymentTxnListQuery,
  PaymentTxnListResponse,
  SuspectStatus,
} from '@/types/payments'

export const paymentsApi = {
  listTransactions(params: PaymentTxnListQuery = {}) {
    return api.get<PaymentTxnListResponse>('/admin/payments/transactions', { params })
  },

  listSuspects(params: PaymentSuspectListQuery = {}) {
    return api.get<PaymentSuspectListResponse>('/admin/payments/suspects', { params })
  },

  setSuspectStatus(id: string, body: { status: SuspectStatus; note?: string }) {
    return api.patch<Pick<PaymentSuspect, 'id' | 'status' | 'note'>>(
      `/admin/payments/suspects/${id}`,
      body,
    )
  },

  applyRefund(body: AdminPaymentRefundBody) {
    return api.post<AdminPaymentRefundResult>('/admin/payments/refunds', body)
  },
}
