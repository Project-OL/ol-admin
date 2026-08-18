import type { AdminCoinRevertVia, TransactionsTab } from '@/types/transactions'

/**
 * Admin transactions revert routing.
 *
 * Policy: only POINT / TRADING_COIN sourced movements.
 * - Prefer `revertVia` on coin/trading-coin ledger rows.
 * - Gifts (personal COIN source) are not revertable.
 */
export type ExplorerRevertAction =
  | { kind: 'points'; id: string }
  | { kind: 'trading-coins'; id: string }
  | { kind: 'coin-trading-transfer'; id: string }
  | { kind: 'withdrawal'; id: string }

function actionFromRevertVia(via: NonNullable<AdminCoinRevertVia>): ExplorerRevertAction {
  switch (via.endpoint) {
    case 'coin_ledger':
      return { kind: 'trading-coins', id: via.id }
    case 'coin_trading_transfer':
      return { kind: 'coin-trading-transfer', id: via.id }
    case 'withdrawal':
      return { kind: 'withdrawal', id: via.id }
  }
}

export function resolveExplorerRevert(
  tab: TransactionsTab,
  entry: {
    id: string
    canRevert?: boolean
    revertVia?: AdminCoinRevertVia
  },
): ExplorerRevertAction | null {
  if (!entry.canRevert) return null

  if (entry.revertVia) {
    return actionFromRevertVia(entry.revertVia)
  }

  switch (tab) {
    case 'points':
      return { kind: 'points', id: entry.id }
    case 'trading-coins':
      return { kind: 'trading-coins', id: entry.id }
    case 'coin-trading-transfers':
      return { kind: 'coin-trading-transfer', id: entry.id }
    case 'coins':
    case 'gifts':
    default:
      return null
  }
}

/** @deprecated Prefer resolveExplorerRevert — path form for display/debug. */
export function revertPathForExplorerTab(
  tab: TransactionsTab,
  entry: { id: string; canRevert?: boolean; revertVia?: AdminCoinRevertVia },
): string | null {
  const action = resolveExplorerRevert(tab, entry)
  if (!action) return null
  switch (action.kind) {
    case 'points':
      return `/admin/transactions/points/${action.id}/revert`
    case 'trading-coins':
      return `/admin/transactions/coins/${action.id}/revert`
    case 'coin-trading-transfer':
      return `/admin/transactions/coin-trading-transfers/${action.id}/revert`
    case 'withdrawal':
      return `/admin/agency/withdrawal/${action.id}/reverse`
  }
}

export type UserWalletRevertAction =
  | { kind: 'points'; id: string }
  | { kind: 'trading-coins'; id: string }
  | { kind: 'coin-trading-transfer'; id: string }
  | { kind: 'withdrawal'; id: string }

/** User-detail wallet tabs → only when API sent canRevert. Prefer transfer / revertVia. */
export function resolveUserWalletRevert(
  tab: 'coins' | 'points' | 'trading',
  tx: {
    id: string
    canRevert?: boolean
    coinTradingTransferId?: string | null
    revertVia?: AdminCoinRevertVia
  },
): UserWalletRevertAction | null {
  if (!tx.canRevert) return null

  if (tx.revertVia) {
    return actionFromRevertVia(tx.revertVia)
  }

  if (tab === 'points') return { kind: 'points', id: tx.id }
  if (tab === 'trading') {
    const transferId = (tx.coinTradingTransferId ?? '').trim()
    if (transferId) return { kind: 'coin-trading-transfer', id: transferId }
    return { kind: 'trading-coins', id: tx.id }
  }
  // Personal coins without trading-transfer revertVia: never
  return null
}

/** @deprecated Use resolveUserWalletRevert — kept for call sites that only need a boolean. */
export function revertKindForUserWalletTab(
  tab: 'coins' | 'points' | 'trading',
  canRevert: boolean | undefined,
): 'points' | 'trading-coins' | null {
  if (!canRevert) return null
  if (tab === 'points') return 'points'
  if (tab === 'trading') return 'trading-coins'
  return null
}
