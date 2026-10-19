/** INF-23: GET /admin/infra/capacity */
export interface GcpCapacityProfile {
  id: string
  label: string
  minReplicas: number
  maxReplicas: number
}

export interface GcpCapacityApiGroup {
  autoscaler: string
  targetSize: number
  isStable: boolean
  minReplicas: number
  maxReplicas: number
  cpuTarget: number
  caps: { minMax: number; maxMax: number }
}

export interface GcpCapacityRedis {
  name: string
  tier: string
  state: string
  sizeGb: number
  usedRatio: number | null
  usedGb: number | null
  allowedSizes: number[]
}

export interface GcpCapacityChangeEntry {
  createdAt: string
  adminUserId: string | null
  actionStatus: string
  actionDetails: { summary?: string; reason?: string | null } | null
}

export interface GcpCapacity {
  configured: boolean
  hasOpsPassword: boolean
  cooldownSeconds: number
  profiles: GcpCapacityProfile[]
  api: GcpCapacityApiGroup | null
  redis: GcpCapacityRedis | null
  recentChanges: GcpCapacityChangeEntry[]
}

/** What the admin asked for, before the step-up token is attached. */
export type GcpCapacityRequest =
  | { kind: 'api'; minReplicas: number; maxReplicas: number }
  | { kind: 'redis'; sizeGb: number }

export type GcpCapacityChange = GcpCapacityRequest & { stepUpToken: string; reason?: string }

export interface GcpCapacityChangeResult {
  before: Record<string, number>
  operation: { kind: string; ref: string }
}
