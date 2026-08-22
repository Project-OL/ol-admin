import api from '@/api/client'
import type {
  CoinPackage,
  CoinPackagesBody,
  CommissionLevel,
  CommissionLevelsBody,
  CommissionLevelsResponse,
  CommissionWindowSnapshot,
  CommissionWindowUpdate,
  CommissionWindowUpdateResponse,
  HostRevenueShares,
  HostRevenueSharesUpdate,
  LevelThreshold,
  MessagingConfigDto,
  MessagingConfigUpdate,
  PayrollConfigSnapshot,
  PayrollConfigUpdate,
  PayoutRailsConfig,
  PayoutRailsConfigUpdate,
  RateTier,
  RateTierBody,
  SupportReviewWindowConfigDto,
  SupportReviewWindowConfigUpdate,
  AdminAuthConfigDto,
  AdminAuthConfigUpdate,
  AgencyHostConfigDto,
  AgencyHostConfigUpdate,
  LivestreamRewardConfigDto,
  LivestreamRewardConfigUpdate,
  RestrictedIdentityWordsBody,
  RestrictedIdentityWordsDto,
  SystemRatesAggregate,
  TradingPackage,
  TradingPackagesBody,
  VideoCallPriceCapsBody,
  VideoCallPriceCapsSnapshot,
  WalletLevelConfigsBody,
  RichTierConfig,
  RichTierConfigBody,
} from '@/types/systemRates'

export const systemSettingsApi = {
  getRatesAggregate() {
    return api.get<SystemRatesAggregate>('/admin/system-settings/rates')
  },

  getHostRevenueShares() {
    return api.get<HostRevenueShares>('/admin/system-settings/host-revenue-shares')
  },

  updateHostRevenueShares(payload: HostRevenueSharesUpdate) {
    return api.put<HostRevenueShares>('/admin/system-settings/host-revenue-shares', payload)
  },

  getPersonalExchangeRates() {
    return api.get<{ tiers: RateTier[] }>('/admin/system-settings/personal-exchange-rates')
  },

  updatePersonalExchangeRates(payload: RateTierBody) {
    return api.put<{ tiers: RateTier[] }>(
      '/admin/system-settings/personal-exchange-rates',
      payload,
    )
  },

  getCoinPackages() {
    return api.get<{ packages: CoinPackage[] }>('/admin/system-settings/coin-packages')
  },

  updateCoinPackages(payload: CoinPackagesBody) {
    return api.put<{ packages: CoinPackage[] }>('/admin/system-settings/coin-packages', payload)
  },

  getWalletLevelConfigs() {
    return api.get<{ wealth: LevelThreshold[]; livestream: LevelThreshold[] }>(
      '/admin/system-settings/wallet-level-configs',
    )
  },

  updateWalletLevelConfigs(payload: WalletLevelConfigsBody) {
    return api.put<{ wealth: LevelThreshold[]; livestream: LevelThreshold[] }>(
      '/admin/system-settings/wallet-level-configs',
      payload,
    )
  },

  getRichTierConfig() {
    return api.get<{ tiers: RichTierConfig[] }>('/admin/system-settings/rich-tier')
  },

  updateRichTierConfig(payload: RichTierConfigBody) {
    return api.put<{ tiers: RichTierConfig[] }>('/admin/system-settings/rich-tier', payload)
  },

  getTradingTopupRates() {
    return api.get<{ tiers: RateTier[] }>('/admin/agency/coin-trading/topup-rates')
  },

  updateTradingTopupRates(payload: RateTierBody) {
    return api.put<{ tiers: RateTier[] }>('/admin/agency/coin-trading/topup-rates', payload)
  },

  getAgentExchangeRates() {
    return api.get<{ tiers: RateTier[] }>('/admin/agency/coin-trading/exchange-rates')
  },

  updateAgentExchangeRates(payload: RateTierBody) {
    return api.put<{ tiers: RateTier[] }>('/admin/agency/coin-trading/exchange-rates', payload)
  },

  getTradingTopupPackages() {
    return api.get<{ packages: TradingPackage[] }>('/admin/agency/coin-trading/topup-packages')
  },

  updateTradingTopupPackages(payload: TradingPackagesBody) {
    return api.put<{ packages: TradingPackage[] }>(
      '/admin/agency/coin-trading/topup-packages',
      payload,
    )
  },

  getCommissionLevels() {
    return api.get<{ levels: CommissionLevel[] }>('/admin/agency/commission/levels')
  },

  updateCommissionLevels(payload: CommissionLevelsBody) {
    return api.put<CommissionLevelsResponse>('/admin/agency/commission/levels', payload)
  },

  getCommissionWindow() {
    return api.get<CommissionWindowSnapshot>('/admin/agency/commission/config')
  },

  updateCommissionWindow(payload: CommissionWindowUpdate) {
    return api.put<CommissionWindowUpdateResponse>('/admin/agency/commission/config', payload)
  },

  getPayrollConfig() {
    return api.get<PayrollConfigSnapshot>('/admin/agency/payroll/config')
  },

  updatePayrollConfig(payload: PayrollConfigUpdate) {
    return api.put<PayrollConfigSnapshot>('/admin/agency/payroll/config', payload)
  },

  getPayoutRailsConfig() {
    return api.get<PayoutRailsConfig>('/admin/agency/withdrawal/payout-rails')
  },

  updatePayoutRailsConfig(payload: PayoutRailsConfigUpdate) {
    return api.put<PayoutRailsConfig>('/admin/agency/withdrawal/payout-rails', payload)
  },

  getVideoCallPriceCaps() {
    return api.get<VideoCallPriceCapsSnapshot>(
      '/admin/system-settings/video-call-price-caps',
    )
  },

  updateVideoCallPriceCaps(payload: VideoCallPriceCapsBody) {
    return api.put<VideoCallPriceCapsSnapshot>(
      '/admin/system-settings/video-call-price-caps',
      payload,
    )
  },

  getMessagingConfig() {
    return api.get<MessagingConfigDto>('/admin/system-settings/messaging')
  },

  updateMessagingConfig(payload: MessagingConfigUpdate) {
    return api.put<MessagingConfigDto>('/admin/system-settings/messaging', payload)
  },

  getSupportReviewWindowConfig() {
    return api.get<SupportReviewWindowConfigDto>('/admin/system-settings/support')
  },

  updateSupportReviewWindowConfig(payload: SupportReviewWindowConfigUpdate) {
    return api.put<SupportReviewWindowConfigDto>('/admin/system-settings/support', payload)
  },

  getAdminAuthConfig() {
    return api.get<AdminAuthConfigDto>('/admin/system-settings/admin-auth')
  },

  updateAdminAuthConfig(payload: AdminAuthConfigUpdate) {
    return api.put<AdminAuthConfigDto>('/admin/system-settings/admin-auth', payload)
  },

  getAgencyHostConfig() {
    return api.get<AgencyHostConfigDto>('/admin/system-settings/agency-host')
  },

  updateAgencyHostConfig(payload: AgencyHostConfigUpdate) {
    return api.put<AgencyHostConfigDto>('/admin/system-settings/agency-host', payload)
  },

  getLivestreamRewardConfig() {
    return api.get<LivestreamRewardConfigDto>('/admin/system-settings/livestream-reward')
  },

  updateLivestreamRewardConfig(payload: LivestreamRewardConfigUpdate) {
    return api.put<LivestreamRewardConfigDto>(
      '/admin/system-settings/livestream-reward',
      payload,
    )
  },

  getRestrictedIdentityWords() {
    return api.get<RestrictedIdentityWordsDto>('/admin/system-settings/restricted-words')
  },

  updateRestrictedIdentityWords(payload: RestrictedIdentityWordsBody) {
    return api.put<RestrictedIdentityWordsDto>(
      '/admin/system-settings/restricted-words',
      payload,
    )
  },
}
