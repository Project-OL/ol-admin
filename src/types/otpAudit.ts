export type OtpPurpose =
  | 'signup'
  | 'login'
  | 'reset_password'
  | 'set_security_password'
  | 'bind_email'
  | 'bind_phone'
  | 'modify_email'
  | 'modify_phone'

export type OtpMeans = 'email' | 'whatsapp' | 'sms' | 'none'
export type OtpDeliveryStatus = 'success' | 'failed' | 'skipped'

export type OtpDeliveryAuditItem = {
  id: string
  userId: string | null
  purpose: OtpPurpose | string
  /** Alias of purpose — use for UI “flow” column. */
  flow: string
  means: OtpMeans | string
  provider: string | null
  status: OtpDeliveryStatus | string
  targetType: string
  targetMasked: string
  country: string | null
  /** Minor units (paise when currency is INR). */
  chargeMinor: number
  chargeCurrency: string
  providerMessageId: string | null
  fallbackFrom: string | null
  routeReason: string | null
  error: string | null
  createdAt: string
}

export type OtpDeliveryAuditList = {
  page: number
  limit: number
  total: number
  items: OtpDeliveryAuditItem[]
}

export type OtpDeliveryAuditSummary = {
  currency: string
  totalCount: number
  totalChargeMinor: number
  byMeans: Array<{ means: string; count: number; chargeMinor: number }>
  byPurpose: Array<{
    purpose: string
    flow: string
    count: number
    chargeMinor: number
  }>
}

export type OtpMeansCost = { count: number; chargeMinor: number }

export type OtpMonthlyCosts = {
  year: number
  month: number
  from: string
  to: string
  currency: string
  byMeans: {
    email: OtpMeansCost
    whatsapp: OtpMeansCost
    sms: OtpMeansCost
  }
  totalCount: number
  totalChargeMinor: number
}

export type OtpCountryCostRow = {
  country: string
  email: OtpMeansCost
  whatsapp: OtpMeansCost
  sms: OtpMeansCost
  totalCount: number
  totalChargeMinor: number
}

export type OtpCostsByCountry = OtpMonthlyCosts & {
  countries: OtpCountryCostRow[]
}

export type OtpCostRates = {
  currency: string
  rates: Record<OtpMeans, number>
  note: string
}

export type OtpAuditListParams = {
  page?: number
  limit?: number
  purpose?: OtpPurpose | string
  means?: OtpMeans | string
  status?: OtpDeliveryStatus | string
  userId?: string
  country?: string
  from?: string
  to?: string
}

export type OtpMonthParams = {
  year?: number
  month?: number
}
