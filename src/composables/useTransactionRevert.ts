import { computed, ref } from 'vue'
import axios from 'axios'
import { transactionsApi } from '@/api/transactions'
import type {
  AdminRevertMode,
  AdminRevertPreview,
  AdminTransactionRevertBody,
} from '@/types/transactions'
import type { ExplorerRevertAction } from '@/utils/transactionRevert'

/** Every revert the admin UI can run: explorer/user-wallet actions + single-wallet reward/adjustment. */
export type TransactionRevertAction = ExplorerRevertAction | { kind: 'single-point'; id: string }

/** Codes that mean "the receiver can't cover a full revert" — show the force panel instead. */
const INSUFFICIENT_CODES = new Set([
  'INSUFFICIENT_POINTS',
  'INSUFFICIENT_COINS',
  'INSUFFICIENT_TRADING_COINS',
])

function callRevert(action: TransactionRevertAction, body: AdminTransactionRevertBody) {
  switch (action.kind) {
    case 'points':
      return transactionsApi.revertPoint(action.id, body)
    case 'trading-coins':
      return transactionsApi.revertCoin(action.id, body)
    case 'coin-trading-transfer':
      return transactionsApi.revertCoinTradingTransfer(action.id, body)
    case 'single-point':
      return transactionsApi.revertSinglePoint(action.id, body)
    case 'withdrawal':
      return transactionsApi.revertWithdrawal(action.id, body)
  }
}

export function isInsufficientRevertError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  const code = (err.response?.data as { code?: string } | undefined)?.code
  return !!code && INSUFFICIENT_CODES.has(code)
}

/**
 * Revert flow shared by the transactions explorer, user-detail wallet tabs and reward claims:
 * `loadPreview` (dryRun) when the dialog opens, then `execute` in `full` mode when the receiver can
 * cover it, or `force` (SUPER_ADMIN) to recover what the receiver still has.
 */
export function useTransactionRevert() {
  const preview = ref<AdminRevertPreview | null>(null)
  const previewLoading = ref(false)
  const previewError = ref<string | null>(null)

  /** Receiver can't cover the full amount. */
  const needsForce = computed(() => preview.value != null && !preview.value.sufficient)
  /** A force reverse would move something (SUPER_ADMIN and a non-zero recoverable amount). */
  const canForce = computed(
    () =>
      needsForce.value &&
      preview.value?.forceAllowed === true &&
      BigInt(preview.value?.recoverable ?? '0') > 0n,
  )
  /** Mode the confirm button runs; null = nothing can be run (short and not allowed to force). */
  const mode = computed<AdminRevertMode | null>(() => {
    if (previewLoading.value) return null
    if (!needsForce.value) return 'full'
    return canForce.value ? 'force' : null
  })

  function reset() {
    preview.value = null
    previewError.value = null
    previewLoading.value = false
  }

  async function loadPreview(action: TransactionRevertAction) {
    reset()
    // Withdrawal reverse is its own flow — no amounts to preview, never forced.
    if (action.kind === 'withdrawal') return
    previewLoading.value = true
    try {
      const res = await callRevert(action, { dryRun: true })
      preview.value = res.data as AdminRevertPreview
    } catch (err) {
      previewError.value = axios.isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ??
          'Could not check the receiver balance')
        : 'Could not check the receiver balance'
    } finally {
      previewLoading.value = false
    }
  }

  async function execute(
    action: TransactionRevertAction,
    params: { reason: string; idempotencyKey?: string; mode: AdminRevertMode },
  ) {
    const res = await callRevert(action, {
      reason: params.reason,
      idempotencyKey: params.idempotencyKey,
      mode: params.mode,
    })
    return res.data as {
      forced?: boolean
      recoveredAmount?: string
      shortfallAmount?: string
    }
  }

  return {
    preview,
    previewLoading,
    previewError,
    needsForce,
    canForce,
    mode,
    reset,
    loadPreview,
    execute,
  }
}

/** BigInt-safe thousands formatting for integer amount strings. */
export function formatAmount(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  try {
    return new Intl.NumberFormat('en-US').format(BigInt(value))
  } catch {
    return value
  }
}

/** Toast text after a successful revert (mentions the shortfall on a force). */
export function revertSuccessMessage(result: {
  forced?: boolean
  recoveredAmount?: string
  shortfallAmount?: string
}): string {
  if (result.forced) {
    return `Force reversed: recovered ${formatAmount(result.recoveredAmount)}, ${formatAmount(result.shortfallAmount)} unrecovered`
  }
  return 'Transaction reverted'
}
