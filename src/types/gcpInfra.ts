export type GcpResourceType =
  | 'COMPUTE_VM'
  | 'CLOUD_SQL'
  | 'MEMORYSTORE_REDIS'
  | 'LOAD_BALANCER'
  | 'CLOUD_NAT'
  | 'GCS_BUCKET'

export type GcpFlagSeverity = 'WARNING' | 'CRITICAL'
export type GcpFlagStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export type GcpThresholds = {
  cpuWarn?: number
  cpuCrit?: number
  memWarn?: number
  memCrit?: number
  diskWarn?: number
  diskCrit?: number
  connectionsWarn?: number
  connectionsCrit?: number
  eventLoopLagWarnMs?: number
  eventLoopLagCritMs?: number
}

export type GcpUsageMetrics = {
  cpuPct?: number | null
  memPct?: number | null
  diskPct?: number | null
  connections?: number | null
  eventLoopLagMs?: number | null
  eventLoopLagP99Ms?: number | null
  error?: string
}

export type GcpResourceWithUsage = {
  resourceKey: string
  resourceType: GcpResourceType
  displayName: string
  currentTier: string
  currentSpecs: Record<string, unknown>
  targetTierFor2x: string | null
  suggestedNextTier: string | null
  estimatedMonthlyCostUsd: number | null
  thresholds: GcpThresholds
  runbookMarkdown: string | null
  latestUsage: GcpUsageMetrics | null
  latestCapturedAt: string | null
  headroomFor2x: 'OK' | 'AT_RISK' | 'UNKNOWN'
}

export type GcpResourceConfig = {
  id: string
  resourceKey: string
  resourceType: GcpResourceType
  displayName: string
  currentTier: string
  currentSpecsJson: Record<string, unknown>
  targetTierFor2x: string | null
  suggestedNextTier: string | null
  estimatedMonthlyCostUsd: number | null
  thresholdsJson: GcpThresholds
  runbookMarkdown: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type GcpResourceConfigUpdate = {
  targetTierFor2x?: string | null
  suggestedNextTier?: string | null
  estimatedMonthlyCostUsd?: number | null
  thresholds?: GcpThresholds
  runbookMarkdown?: string | null
}

export type GcpUsageHistoryPoint = { capturedAt: string; metrics: GcpUsageMetrics }

export type GcpInfraFlag = {
  id: string
  resourceKey: string
  metric: string
  value: number
  threshold: number
  severity: GcpFlagSeverity
  status: GcpFlagStatus
  message: string
  firstDetectedAt: string
  lastNotifiedAt: string | null
  resolvedAt: string | null
  resolvedByAdminId: string | null
}

export type FetchError = { error: string }

export type GcpCostByServiceRow = { service: string; amount: number; unit: string }

export type GcpCostByService = {
  fetchedAt: string
  year: number
  month: number
  from: string
  to: string
} & ({ total: number; currency: string; byService: GcpCostByServiceRow[] } | FetchError)

export type GcpCostByServiceParams = {
  year?: number
  month?: number
  refresh?: boolean
}
