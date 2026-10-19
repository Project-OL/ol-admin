import api from '@/api/client'
import type { GcpCapacity, GcpCapacityChange, GcpCapacityChangeResult } from '@/types/gcpCapacity'

/** INF-23 capacity control (SUPER_ADMIN). Changes need a step-up token from the ops password. */
export const gcpCapacityApi = {
  get() {
    return api.get<GcpCapacity>('/admin/infra/capacity')
  },
  stepUp(opsPassword: string) {
    return api.post<{ stepUpToken: string; expiresInSec: number }>('/admin/infra/capacity/step-up', { opsPassword })
  },
  change(payload: GcpCapacityChange) {
    return api.put<GcpCapacityChangeResult>('/admin/infra/capacity', payload)
  },
  operation(ref: string) {
    return api.get<{ done: boolean; error: string | null }>('/admin/infra/capacity/operations', { params: { ref } })
  },
}
