export type Ec2InstanceSummary = {
  instanceId: string | null
  type: string | null
  az: string | null
  name: string | null
  launchTime: string | null
  privateIp: string | null
}

export type RdsInstanceSummary = {
  id: string | null
  class: string | null
  engine: string | null
  multiAz: boolean
  status: string | null
  storageGb: number | null
}

export type ElastiCacheClusterSummary = {
  id: string | null
  nodeType: string | null
  engine: string | null
  numNodes: number | null
  status: string | null
}

export type FetchError = { error: string }

export type InfraInventory = {
  fetchedAt: string
  region: string
  ec2InstancesRunning: Ec2InstanceSummary[] | FetchError
  rdsInstances: RdsInstanceSummary[] | FetchError
  elastiCacheClusters: ElastiCacheClusterSummary[] | FetchError
}

export type CostByServiceRow = { service: string; amount: number; unit: string }

export type InfraCostByService = {
  fetchedAt: string
  year: number
  month: number
  from: string
  to: string
} & ({ total: number; currency: string; byService: CostByServiceRow[] } | FetchError)

export type InfraCostByServiceParams = {
  year?: number
  month?: number
  refresh?: boolean
}
