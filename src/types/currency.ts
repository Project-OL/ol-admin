export type AdminCurrencyKind = 'COIN' | 'POINT' | 'TRADING_COIN'
export type AdminCurrencyDirection = 'credit' | 'debit'
export type LedgerGrain = 'month' | 'quarter' | 'year' | 'custom'
export type CompanyCashDirection = 'IN' | 'OUT'
export type CompanyCashReason = 'AGENCY_TRADING_PURCHASE' | 'EPAY_PAYOUT' | 'PAYROLL_TAKEOVER_PAYOUT'
export type LedgerAccountRoleType = 'TREASURY' | 'COMPANY_AGENCY'
export type TreasuryFlowKind = 'COIN_TRADING_TRANSFER' | 'AGENT_POINT_TRANSFER'
export type TreasuryFlowClassification = 'SALE' | 'PROMO' | 'INTERNAL' | 'WRITE_OFF'

export type PlatformProfitBuckets = {
  coins: string
  points: string
  tradingCoins: string
}

export type AdminCurrencyAdjustBody = {
  userId: string
  currency: AdminCurrencyKind
  direction: AdminCurrencyDirection
  amount: string
  description?: string
  idempotencyKey?: string
  forceTradingCredit?: boolean
  /** @deprecated Ignored under imputed ledger; kept for backward compatibility. */
  cashUsd?: string
  promotional?: boolean
}

export type AdminCurrencySupplySummary = {
  created: PlatformProfitBuckets
  returned: PlatformProfitBuckets
}

export type AdminCurrencyAdjustmentEntry = {
  id: string
  currency: AdminCurrencyKind
  direction: 'CREDIT' | 'DEBIT' | string
  amount: string
  balanceAfter: string
  description: string | null
  createdAt: string
  supplyEffect: 'created' | 'returned'
  user: {
    userId: string
    username: string
    name?: string
    displayName: string
    publicId: string
    displayPublicId: string
    avatarUrl: string | null
  }
}

export type AdminCurrencyAdjustmentsResponse = {
  entries: AdminCurrencyAdjustmentEntry[]
  nextCursor: string | null
  hasMore: boolean
}

export type LedgerLine = {
  id: string
  label: string
  units: string
  usd: string
}

export type MasterLedgerStock = {
  at: string
  companyAgencyUserId: string | null
  houseAccountIds: string[]
  treasuryAccountIds: string[]
  companyAgencyAccountIds: string[]
  identityOk: boolean
  identityDelta: string
  customerFloat: LedgerLine[]
  houseInventory: LedgerLine[]
  inventory: LedgerLine[]
  outstanding: string
  outstandingUsd: string
  customerFloatUnits: string
  customerFloatUsd: string
  houseInventoryUnits: string
  houseInventoryUsd: string
  netMinted: string
  houseMinted: string
  destroyedUnits: string
  ledgerNet: string
}

export type MasterLedgerPnl = {
  revenue: LedgerLine[]
  costs: LedgerLine[]
  memo?: LedgerLine[]
  operatingProfitUnits: string
  operatingProfitUsd: string
}

export type MasterLedgerImputed = {
  revenue: LedgerLine[]
  costs: LedgerLine[]
  grossSaleUnits: string
  grossSaleUsd: string
  companyPayoutUnits: string
  companyPayoutUsd: string
  netMarginUnits: string
  netMarginUsd: string
  saleCount: number
  treasuryConfigured: boolean
}

export type MasterLedgerReconciliation = {
  ok: boolean
  delta: string
  deltaUsd: string
  grossSaleUnits: string
  companyPayoutUnits: string
  openingCustomerFloatUnits: string
  closingCustomerFloatUnits: string
  deltaCustomerFloatUnits: string
  operatingProfitUnits: string
  openingFloatSource: 'snapshot' | 'live'
}

export type MasterLedgerDashboard = {
  period: { grain: LedgerGrain; from: string; to: string }
  hero: {
    capitalInUsd: string
    cashOutUsd: string
    cashProfitUsd: string
    operatingProfitUnits: string
    operatingProfitUsd: string
    identityOk: boolean
    identityDelta: string
    grossSaleUnits: string
    grossSaleUsd: string
    companyPayoutUnits: string
    companyPayoutUsd: string
    netImputedMarginUnits: string
    netImputedMarginUsd: string
    customerFloatUnits: string
    customerFloatUsd: string
    houseInventoryUnits: string
    houseInventoryUsd: string
    treasuryConfigured: boolean
    reconciliationOk: boolean
    reconciliationDelta: string
  }
  stock: MasterLedgerStock
  pnl: MasterLedgerPnl
  imputed: MasterLedgerImputed
  reconciliation: MasterLedgerReconciliation
  unitFlow: LedgerLine[]
  cash: {
    capitalInUsd: string
    cashOutUsd: string
    cashProfitUsd: string
    recordedOnly?: boolean
  }
}

export type HouseAccountEntry = {
  id: string
  userId: string
  role: LedgerAccountRoleType
  label: string | null
  isActive: boolean
  effectiveFrom: string
  note: string | null
  createdAt: string
  user: {
    userId: string
    username: string
    name: string
    displayName: string
    publicId: string
    isAgent: boolean
    avatarUrl: string | null
  }
}

export type HouseAccountsResponse = {
  accounts: HouseAccountEntry[]
  envCompanyAgencyUserId: string | null
  envFallbackActive: boolean
}

export type HouseAccountUpsertBody = {
  userId: string
  role: LedgerAccountRoleType
  label?: string
  note?: string
  effectiveFrom?: string
}

export type TreasuryFlowEntry = {
  flowKind: TreasuryFlowKind
  flowId: string
  units: string
  usd: string
  classification: TreasuryFlowClassification
  storedClassification: string | null
  locked: boolean
  reversedAt: string | null
  createdAt: string
  sender: {
    userId: string
    username: string
    name: string
    displayName: string
    publicId: string
    avatarUrl: string | null
    isAgent: boolean
    isHouse: boolean
  } | null
  recipient: {
    userId: string
    username: string
    name: string
    displayName: string
    publicId: string
    avatarUrl: string | null
    isAgent: boolean
    isHouse: boolean
  } | null
}

export type TreasuryFlowsResponse = {
  entries: TreasuryFlowEntry[]
  nextCursor: string | null
  hasMore: boolean
  houseAccountCount: number
}

export type TreasuryFlowClassifyBody = {
  flowKind: TreasuryFlowKind
  flowId: string
  classification: 'SALE' | 'PROMO' | 'WRITE_OFF'
  reason?: string
}

export type CompanyCashEntry = {
  id: string
  direction: CompanyCashDirection
  reason: CompanyCashReason
  amountUsd: string
  amountUsdDisplay: string
  unitsAmount: string | null
  currencyType: AdminCurrencyKind | null
  counterpartyUserId: string | null
  counterparty: { name: string; publicId: string; username: string } | null
  ledgerRefId: string | null
  withdrawalId: string | null
  description: string | null
  promotional: boolean
  adminUserId: string
  createdAt: string
}

export type CompanyCashJournalResponse = {
  entries: CompanyCashEntry[]
  nextCursor: string | null
  hasMore: boolean
}

export type CompanyCashCreateBody = {
  direction: CompanyCashDirection
  reason: CompanyCashReason
  amountUsd: string
  counterpartyUserId?: string
  description?: string
  unitsAmount?: string
}
