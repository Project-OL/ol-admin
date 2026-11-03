import api from '@/api/client'
import type {
  GcpCostByService,
  GcpCostByServiceParams,
  GcpInfraFlag,
  GcpResourceConfig,
  GcpResourceConfigUpdate,
  GcpResourceWithUsage,
  GcpUsageHistoryPoint,
  LivekitBandwidth,
} from '@/types/gcpInfra'

export const gcpInfraApi = {
  getResources() {
    return api.get<GcpResourceWithUsage[]>('/admin/gcp-infra/resources')
  },

  getResourceHistory(resourceKey: string, range: '24h' | '7d' | '30d' = '24h') {
    return api.get<GcpUsageHistoryPoint[]>(
      `/admin/gcp-infra/resources/${encodeURIComponent(resourceKey)}/history`,
      { params: { range } },
    )
  },

  getResourceConfig(resourceKey: string) {
    return api.get<GcpResourceConfig>(`/admin/gcp-infra/resources/${encodeURIComponent(resourceKey)}/config`)
  },

  updateResourceConfig(resourceKey: string, payload: GcpResourceConfigUpdate) {
    return api.put<GcpResourceConfig>(
      `/admin/gcp-infra/resources/${encodeURIComponent(resourceKey)}/config`,
      payload,
    )
  },

  getCostByService(params: GcpCostByServiceParams = {}) {
    return api.get<GcpCostByService>('/admin/gcp-infra/cost-by-service', { params })
  },

  /** LIVE-63: LiveKit VPS media transfer vs the 32 TB/month allowance (cached 5 min server-side). */
  getLivekitBandwidth(refresh = false) {
    return api.get<LivekitBandwidth | { error: string }>('/admin/gcp-infra/livekit-bandwidth', {
      params: refresh ? { refresh: true } : undefined,
    })
  },

  getFlags(status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED') {
    return api.get<GcpInfraFlag[]>('/admin/gcp-infra/flags', { params: status ? { status } : undefined })
  },

  resolveFlag(id: string) {
    return api.post<GcpInfraFlag>(`/admin/gcp-infra/flags/${encodeURIComponent(id)}/resolve`)
  },
}
