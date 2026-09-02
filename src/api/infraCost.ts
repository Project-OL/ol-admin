import api from '@/api/client'
import type { InfraCostByService, InfraCostByServiceParams, InfraInventory } from '@/types/infraCost'

export const infraCostApi = {
  getInventory(refresh = false) {
    return api.get<InfraInventory>('/admin/infra-cost/inventory', {
      params: refresh ? { refresh: true } : undefined,
    })
  },

  getCostByService(params: InfraCostByServiceParams = {}) {
    return api.get<InfraCostByService>('/admin/infra-cost/by-service', { params })
  },
}
