export type LuckyTierMode = 'off' | 'shadow' | 'enforce'

export type LuckyTierSeedChoice = 'seed' | 'start_empty' | 'capped_ladder'

export type LuckyTierListItem = {
  tierId: string
  version: number
  mode: LuckyTierMode
  priceMin: number
  priceMax: number | null
  rBp: number
  l0: string
  floor: string
  poolBalance: string | null
  shadowPoolBalance: string | null
  hasSeedDecision: boolean
  latestSeedChoice: LuckyTierSeedChoice | null
}

export type LuckyTierDashboard = {
  tierId: string
  configVersion: number
  mode: LuckyTierMode
  poolBalance: string
  shadowPoolBalance: string | null
  l0: string
  floor: string
  lambdaBp: string
  band: string
  rBp: number
  rtpTodayBp: number | null
  drawCountToday: number
  snapshotRtp7dBp: number | null
}

export type LuckyTierModeUpdate = {
  mode: LuckyTierMode
  enforceOverrideReason?: string
}

export type LuckyTierSeedBody = {
  choice: LuckyTierSeedChoice
  amount?: string
  reason?: string
}
