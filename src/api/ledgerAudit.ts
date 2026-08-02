import api from '@/api/client'
import type {
  LedgerAuditFlag,
  LedgerAuditFlagListQuery,
  LedgerAuditFlagListResponse,
  LedgerAuditFlagPatchBody,
  LedgerAuditRunResponse,
} from '@/types/ledgerAudit'

export const ledgerAuditApi = {
  listFlags(params: LedgerAuditFlagListQuery = {}) {
    return api.get<LedgerAuditFlagListResponse>('/admin/ledger-audit/flags', { params })
  },

  patchFlag(flagId: string, body: LedgerAuditFlagPatchBody) {
    return api.patch<LedgerAuditFlag>(`/admin/ledger-audit/flags/${flagId}`, body)
  },

  runAudit() {
    return api.post<LedgerAuditRunResponse>('/admin/ledger-audit/run')
  },
}
