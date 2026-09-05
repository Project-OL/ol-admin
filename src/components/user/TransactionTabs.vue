<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { format } from 'date-fns'
import axios from 'axios'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import { useUserDetailStore } from '@/stores/userDetail'
import { userAdminApi } from '@/api/userAdmin'
import { transactionsApi } from '@/api/transactions'
import { formatCoins, formatNumber, formatPoints } from '@/utils/format'
import { showToast } from '@/utils/toast'
import { resolveUserWalletRevert } from '@/utils/transactionRevert'
import type { ApiTransaction } from '@/types/api'
import type { CoinTransaction, TxCounterpartyDetails } from '@/types/user'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'

const props = defineProps<{ userId: string }>()
const store = useUserDetailStore()
const router = useRouter()

type TabId = 'coins' | 'points' | 'trading' | 'diamonds'

const activeTab = ref<TabId>('coins')
const typesFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const direction = ref<'credit' | 'debit' | ''>('')
const loading = ref(false)
const loadingMore = ref(false)
const scrollEl = ref<HTMLElement | null>(null)
const filterOptions = ref<string[]>([])
const expandedId = ref<string | null>(null)

const rows = ref<CoinTransaction[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)

const revertOpen = ref(false)
const revertTarget = ref<CoinTransaction | null>(null)
const revertReason = ref('')
const reverting = ref(false)

/** Defensive normalize — keep enrichment; never invent canRevert. */
function normalizeEntry(raw: ApiTransaction | Record<string, unknown>): CoinTransaction {
  const tx = raw as ApiTransaction & Record<string, unknown>
  const amountRaw = tx.amount ?? 0
  const amountNum = typeof amountRaw === 'string' ? Number(amountRaw) : Number(amountRaw)
  const directionRaw = String(tx.direction ?? '').toLowerCase()
  const dir =
    directionRaw === 'debit' || directionRaw === 'credit'
      ? (directionRaw as 'credit' | 'debit')
      : undefined
  const signed =
    dir === 'debit' ? -Math.abs(amountNum) : dir === 'credit' ? Math.abs(amountNum) : amountNum

  const cpRaw = (tx.counterpartyDetails ?? null) as TxCounterpartyDetails | null
  const counterpartyDetails: TxCounterpartyDetails | null = cpRaw
    ? {
        userId: cpRaw.userId,
        name: cpRaw.name,
        publicId: cpRaw.publicId != null ? String(cpRaw.publicId) : undefined,
        avatarUrl: cpRaw.avatarUrl ?? null,
        storeItemName: cpRaw.storeItemName,
        price: cpRaw.price,
        rarePublicId: cpRaw.rarePublicId,
        membershipType: cpRaw.membershipType,
        addedByAdmin: cpRaw.addedByAdmin,
        transactionId: cpRaw.transactionId,
      }
    : null

  const transactionName =
    String(tx.transactionName ?? '').trim() ||
    String(tx.txType ?? tx.type ?? '').trim() ||
    'Transaction'

  const descriptionRaw = tx.description
  const description =
    descriptionRaw != null && String(descriptionRaw).trim()
      ? String(descriptionRaw).trim()
      : null

  const balanceRaw = tx.balanceAfter
  const balanceAfter =
    balanceRaw === undefined || balanceRaw === null || balanceRaw === ''
      ? undefined
      : Number(balanceRaw)

  const gift = tx.gift as { giftTransactionId?: string; giftName?: string } | null | undefined
  const storeItem = tx.storeItem as { name?: string } | null | undefined
  const vipPurchase = tx.vipPurchase as { tier?: string } | null | undefined
  const transfer = tx.coinTradingTransfer as { id?: string } | null | undefined
  const transferIdTop =
    typeof tx.transferId === 'string' && tx.transferId
      ? tx.transferId
      : typeof (tx as { transfer_id?: unknown }).transfer_id === 'string'
        ? String((tx as { transfer_id: string }).transfer_id)
        : null
  const resolvedTransferId = transfer?.id ?? transferIdTop

  const linkParts: string[] = []
  if (gift?.giftName) linkParts.push(`Gift: ${gift.giftName}`)
  if (storeItem?.name) linkParts.push(`Store: ${storeItem.name}`)
  if (vipPurchase?.tier) linkParts.push(`VIP: ${vipPurchase.tier}`)
  if (resolvedTransferId) linkParts.push('Trading transfer')
  if (counterpartyDetails?.storeItemName && !storeItem?.name) {
    linkParts.push(`Store: ${counterpartyDetails.storeItemName}`)
  }

  return {
    id: String(tx.id ?? tx.transactionId ?? crypto.randomUUID()),
    date: String(tx.createdAt ?? tx.date ?? new Date().toISOString()),
    transactionName,
    description,
    amount: Number.isFinite(signed) ? signed : 0,
    balanceAfter: Number.isFinite(balanceAfter as number) ? (balanceAfter as number) : undefined,
    direction: dir,
    status: 'success',
    type: (tx.txType ?? tx.type) as string | undefined,
    counterpartyId: (tx.counterpartyId as string | null | undefined) ?? counterpartyDetails?.userId ?? null,
    counterpartyDetails,
    giftTransactionId: gift?.giftTransactionId ?? null,
    coinTradingTransferId: resolvedTransferId,
    linkSummary: linkParts.length ? linkParts.join(' · ') : null,
    // Strict: only true when API sends canRevert === true (never from counterpartyId).
    canRevert: tx.canRevert === true,
    revertVia:
      tx.revertVia &&
      typeof tx.revertVia === 'object' &&
      typeof (tx.revertVia as { endpoint?: unknown }).endpoint === 'string' &&
      typeof (tx.revertVia as { id?: unknown }).id === 'string'
        ? {
            endpoint: (tx.revertVia as { endpoint: 'coin_ledger' | 'coin_trading_transfer' | 'withdrawal' })
              .endpoint,
            id: (tx.revertVia as { id: string }).id,
          }
        : null,
  }
}

function rowCanRevert(tx: CoinTransaction) {
  return resolveUserWalletRevert(activeTab.value, tx) != null
}

function listParams(cursor?: string) {
  return {
    limit: 20,
    types: typesFilter.value || undefined,
    from: dateFrom.value ? new Date(dateFrom.value).toISOString() : undefined,
    to: dateTo.value ? new Date(dateTo.value + 'T23:59:59').toISOString() : undefined,
    direction: direction.value || undefined,
    cursor,
  }
}

function rowMatchesDirection(tx: CoinTransaction) {
  if (!direction.value) return true
  if (tx.direction === 'credit' || tx.direction === 'debit') {
    return tx.direction === direction.value
  }
  return direction.value === 'debit' ? tx.amount < 0 : tx.amount >= 0
}

async function requestPage(cursor?: string) {
  const params = listParams(cursor)
  const req =
    activeTab.value === 'coins'
      ? userAdminApi.getCoinTransactions(props.userId, params)
      : activeTab.value === 'points'
        ? userAdminApi.getPointTransactions(props.userId, params)
        : activeTab.value === 'diamonds'
          ? userAdminApi.getDiamondTransactions(props.userId, params)
          : userAdminApi.getTradingCoinTransactions(props.userId, params)

  const { data } = await req
  const extracted = userAdminApi.extractTransactions(data) as ApiTransaction[]
  return {
    mapped: extracted.map((e) => normalizeEntry(e)).filter(rowMatchesDirection),
    nextCursor: data.nextCursor ?? null,
    hasMore: Boolean(data.nextCursor ?? data.hasMore),
  }
}

async function fetchPage(append: boolean) {
  if (append) {
    if (loadingMore.value || !hasMore.value || !nextCursor.value) return
    loadingMore.value = true
  } else {
    loading.value = true
    expandedId.value = null
  }

  try {
    const acc: CoinTransaction[] = append ? [...rows.value] : []
    let cursor = append ? nextCursor.value ?? undefined : undefined
    let more = true
    let pages = 0
    const target = append ? acc.length + 1 : 20

    do {
      const page = await requestPage(cursor)
      acc.push(...page.mapped)
      cursor = page.nextCursor ?? undefined
      more = page.hasMore
      pages++
    } while (direction.value && acc.length < target && more && pages < 8)

    rows.value = acc
    nextCursor.value = cursor ?? null
    hasMore.value = more
  } catch {
    if (!append) {
      rows.value = []
      nextCursor.value = null
      hasMore.value = false
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function onScroll() {
  const el = scrollEl.value
  if (!el || loadingMore.value || loading.value || !hasMore.value) return
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48
  if (nearBottom) void fetchPage(true)
}

function updateFilterOptions() {
  if (activeTab.value === 'coins') filterOptions.value = store.transactionFilterTypes.coins
  else if (activeTab.value === 'points') filterOptions.value = store.transactionFilterTypes.points
  else if (activeTab.value === 'diamonds')
    filterOptions.value = store.transactionFilterTypes.diamonds
  else filterOptions.value = store.transactionFilterTypes.trading
}

function formatAmount(tx: CoinTransaction) {
  const abs = Math.abs(tx.amount)
  if (activeTab.value === 'points') return formatPoints(abs)
  return formatCoins(abs)
}

function peerName(tx: CoinTransaction) {
  const name = (tx.counterpartyDetails?.name ?? '').trim()
  return name || null
}

function peerInitial(tx: CoinTransaction) {
  const label = peerName(tx) || tx.counterpartyDetails?.publicId || '?'
  return label.charAt(0).toUpperCase()
}

function hasPeer(tx: CoinTransaction) {
  return Boolean(
    tx.counterpartyDetails?.userId ||
      tx.counterpartyDetails?.name ||
      tx.counterpartyDetails?.publicId,
  )
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

/** The global explorer has no diamonds tab yet, so the row action is hidden there. */
const canOpenInExplorer = computed(() => activeTab.value !== 'diamonds')

function openInExplorer(tx: CoinTransaction) {
  if (!canOpenInExplorer.value) return
  const tab =
    activeTab.value === 'coins'
      ? 'coins'
      : activeTab.value === 'points'
        ? 'points'
        : 'trading-coins'
  void router.push({
    path: '/admin/transactions',
    query: { tab, q: tx.id },
  })
}

function openRevert(tx: CoinTransaction) {
  if (!rowCanRevert(tx)) return
  revertTarget.value = tx
  revertReason.value = ''
  revertOpen.value = true
}

function closeRevert() {
  if (reverting.value) return
  revertOpen.value = false
  revertTarget.value = null
}

function revertErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) return 'Failed to revert transaction'
  const body = err.response?.data as {
    code?: string
    message?: string
    details?: { transferId?: string }
  } | undefined
  switch (body?.code) {
    case 'NOT_REVERTABLE':
      if (body.details?.transferId) {
        return 'Not revertable here — open Trading coins in the explorer'
      }
      return 'This row cannot be reverted'
    case 'ALREADY_REVERTED':
    case 'TRANSFER_ALREADY_REVERSED':
      return 'Already reverted'
    case 'INSUFFICIENT_COINS':
      return 'Receiver personal coins too low to cover revert'
    case 'INSUFFICIENT_TRADING_COINS':
      return 'Receiver trading coins too low to cover revert'
    case 'INSUFFICIENT_POINTS':
      return 'Receiver points too low to cover revert'
    case 'PERSONAL_COINS_FROZEN':
      return 'Receiver personal coins wallet is frozen'
    case 'TRADING_COINS_FROZEN':
      return 'Receiver trading coins wallet is frozen'
    case 'POINTS_FROZEN':
      return 'Receiver points wallet is frozen'
    case 'LEDGER_ENTRY_NOT_FOUND':
      return 'Ledger entry not found'
    case 'TRANSFER_NOT_FOUND':
      return 'Trading transfer not found'
    case 'GIFT_TRANSACTION_NOT_FOUND':
      return 'Gift transaction not found'
    case 'INVALID_REQUEST':
      return body.message || 'Invalid revert request'
    default:
      return body?.message || 'Failed to revert transaction'
  }
}

async function confirmRevert() {
  const tx = revertTarget.value
  const reason = revertReason.value.trim()
  if (!tx || !reason || reverting.value) return

  const action = resolveUserWalletRevert(activeTab.value, tx)
  if (!action) {
    showToast('Revert is not available for this row', 'error')
    return
  }

  reverting.value = true
  try {
    const body = {
      reason,
      idempotencyKey: `admin-user-tx-revert-${action.kind}-${action.id}-${Date.now()}`,
    }

    if (action.kind === 'points') {
      await transactionsApi.revertPoint(action.id, body)
    } else if (action.kind === 'withdrawal') {
      await transactionsApi.revertWithdrawal(action.id, body)
    } else if (action.kind === 'coin-trading-transfer') {
      // Prefer dedicated transfer revert when coinTradingTransferId is present.
      await transactionsApi.revertCoinTradingTransfer(action.id, body)
    } else {
      // TRADING_COIN peer → POST /transactions/coins/:id/revert (path quirk).
      await transactionsApi.revertCoin(action.id, body)
    }

    showToast('Transaction reverted', 'success')
    revertOpen.value = false
    revertTarget.value = null
    await fetchPage(false)
  } catch (err) {
    // If ledger route says use transfer id, retry once on the transfer endpoint.
    if (
      axios.isAxiosError(err) &&
      action.kind === 'trading-coins' &&
      (err.response?.data as { code?: string; details?: { transferId?: string } } | undefined)?.code ===
        'NOT_REVERTABLE'
    ) {
      const transferId = (
        err.response?.data as { details?: { transferId?: string } } | undefined
      )?.details?.transferId
      if (transferId) {
        try {
          await transactionsApi.revertCoinTradingTransfer(transferId, {
            reason,
            idempotencyKey: `admin-user-tx-revert-transfer-retry-${transferId}-${Date.now()}`,
          })
          showToast('Transaction reverted via trading transfer', 'success')
          revertOpen.value = false
          revertTarget.value = null
          await fetchPage(false)
          return
        } catch (retryErr) {
          showToast(revertErrorMessage(retryErr), 'error')
          return
        }
      }
    }
    showToast(revertErrorMessage(err), 'error')
  } finally {
    reverting.value = false
  }
}

const {
  sortKey: rowsSortKey,
  sortDir: rowsSortDir,
  sortedRows: sortedRowsList,
  toggleSort: toggleRowsSort,
} = useSortableRows(rows, (tx, key) => {
  switch (key) {
    case 'date':
      return tx.date ? new Date(tx.date).getTime() : 0
    case 'transactionName':
      return tx.transactionName?.toLowerCase() ?? ''
    case 'counterparty':
      return (peerName(tx) || '').toLowerCase()
    case 'amount':
      return Math.abs(tx.amount)
    case 'revertable':
      return rowCanRevert(tx) ? 1 : 0
    default:
      return undefined
  }
})

watch(activeTab, () => {
  typesFilter.value = ''
  direction.value = ''
  updateFilterOptions()
  void fetchPage(false)
})

watch([typesFilter, dateFrom, dateTo, direction], () => {
  void fetchPage(false)
})

watch(
  () => props.userId,
  () => {
    void fetchPage(false)
  },
)

onMounted(async () => {
  await store.fetchTransactionFilterTypes()
  updateFilterOptions()
  await fetchPage(false)
})
</script>

<template>
  <div class="admin-card">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-1 rounded-lg bg-admin-bg p-1">
        <button
          v-for="tab in [
            { id: 'coins', label: 'Coins' },
            { id: 'points', label: 'Points' },
            { id: 'trading', label: 'Trading' },
            { id: 'diamonds', label: 'Diamonds' },
          ]"
          :key="tab.id"
          type="button"
          :class="[
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === tab.id ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="activeTab = tab.id as TabId"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="admin-filter-bar w-full sm:w-auto">
        <input v-model="dateFrom" type="date" class="admin-input w-full min-w-0 py-1.5 text-xs sm:w-auto" />
        <input v-model="dateTo" type="date" class="admin-input w-full min-w-0 py-1.5 text-xs sm:w-auto" />
        <select
          v-if="filterOptions.length"
          v-model="typesFilter"
          class="admin-input w-full min-w-0 py-1.5 text-xs sm:w-auto sm:max-w-[180px]"
        >
          <option value="">All types</option>
          <option v-for="t in filterOptions" :key="t" :value="t">{{ t }}</option>
        </select>
        <select v-model="direction" class="admin-input w-full min-w-0 py-1.5 text-xs sm:w-auto">
          <option value="">All directions</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
      </div>
    </div>

    <p v-if="activeTab === 'coins'" class="mb-3 text-xs text-admin-muted">
      Revert appears only for personal COIN credits funded by an unreverted trading transfer
      (trading-coin source). Gifts and other personal spends are not admin-revertable.
    </p>
    <p v-else-if="activeTab === 'diamonds'" class="mb-3 text-xs text-admin-muted">
      Game wagers, results and refunds, plus Coin↔Diamond conversions and admin adjustments.
      Rows are not revertable — each game row is one leg of a double-entry pair settled against
      the game house account on the provider's order ID. To correct a balance, use Currency →
      Mint/adjust with currency Diamonds.
    </p>

    <div
      ref="scrollEl"
      class="admin-table-wrap max-h-96 overflow-y-auto"
      @scroll="onScroll"
    >
      <table class="admin-table">
        <thead>
          <tr>
            <SortableTh label="When" sort-key="date" :active-key="rowsSortKey" :direction="rowsSortDir" @sort="toggleRowsSort" />
            <SortableTh label="Summary" sort-key="transactionName" :active-key="rowsSortKey" :direction="rowsSortDir" @sort="toggleRowsSort" />
            <SortableTh label="Counterparty" sort-key="counterparty" :active-key="rowsSortKey" :direction="rowsSortDir" @sort="toggleRowsSort" />
            <SortableTh label="Amount" sort-key="amount" :active-key="rowsSortKey" :direction="rowsSortDir" @sort="toggleRowsSort" />
            <SortableTh label="Flags" sort-key="revertable" :active-key="rowsSortKey" :direction="rowsSortDir" @sort="toggleRowsSort" />
            <th />
          </tr>
        </thead>
        <tbody>
          <template v-for="tx in sortedRowsList" :key="tx.id">
            <tr
              class="cursor-pointer transition-colors hover:bg-admin-bg/60"
              @click="toggleExpand(tx.id)"
            >
              <td class="whitespace-nowrap text-xs">
                {{ format(new Date(tx.date), 'dd MMM yyyy HH:mm') }}
              </td>
              <td class="max-w-[220px]">
                <p class="truncate font-medium">{{ tx.transactionName }}</p>
                <p v-if="tx.description" class="truncate text-xs text-admin-subtext" :title="tx.description">
                  {{ tx.description }}
                </p>
                <p v-if="tx.type" class="truncate font-mono text-[10px] text-admin-muted">
                  {{ tx.type }}
                </p>
              </td>
              <td>
                <div v-if="hasPeer(tx)" class="flex min-w-0 items-center gap-2">
                  <img
                    v-if="tx.counterpartyDetails?.avatarUrl"
                    :src="tx.counterpartyDetails.avatarUrl"
                    :alt="peerName(tx) || 'User'"
                    class="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                  <span
                    v-else
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-admin-accent/20 text-[10px] font-bold text-admin-accent"
                  >
                    {{ peerInitial(tx) }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-sm">{{ peerName(tx) || 'User' }}</p>
                    <p
                      v-if="tx.counterpartyDetails?.publicId"
                      class="truncate font-mono text-xs text-admin-muted"
                    >
                      #{{ tx.counterpartyDetails.publicId }}
                    </p>
                  </div>
                </div>
                <span v-else class="text-xs text-admin-muted">—</span>
              </td>
              <td
                :class="[
                  'font-medium tabular-nums',
                  tx.amount >= 0 ? 'text-admin-success' : 'text-admin-danger',
                ]"
              >
                {{ tx.amount >= 0 ? '+' : '−' }}{{ formatAmount(tx) }}
                <p
                  v-if="tx.balanceAfter != null"
                  class="text-xs font-normal text-admin-muted"
                >
                  bal {{ formatNumber(tx.balanceAfter) }}
                </p>
              </td>
              <td>
                <span
                  v-if="rowCanRevert(tx)"
                  class="inline-flex rounded-full bg-admin-warn/15 px-2 py-0.5 text-xs font-medium text-admin-warn"
                >
                  Revertable
                </span>
                <StatusBadge v-else :status="tx.status" />
              </td>
              <td class="text-right" @click.stop>
                <button
                  v-if="rowCanRevert(tx)"
                  type="button"
                  class="admin-btn-secondary py-1 text-xs"
                  @click="openRevert(tx)"
                >
                  Revert
                </button>
                <button
                  v-else-if="canOpenInExplorer"
                  type="button"
                  class="text-xs font-medium text-admin-accent hover:underline"
                  @click="openInExplorer(tx)"
                >
                  Explorer
                </button>
                <span v-else class="text-xs text-admin-muted">—</span>
              </td>
            </tr>
            <tr v-if="expandedId === tx.id">
              <td colspan="6" class="bg-admin-bg/40 px-4 py-3 text-xs">
                <div class="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p class="text-admin-muted">Ledger ID</p>
                    <p class="break-all font-mono">{{ tx.id }}</p>
                  </div>
                  <div v-if="tx.counterpartyDetails?.userId">
                    <p class="text-admin-muted">Counterparty</p>
                    <RouterLink
                      :to="`/admin/users/${tx.counterpartyDetails.userId}`"
                      class="text-admin-accent hover:underline"
                    >
                      {{ peerName(tx) || tx.counterpartyDetails.userId }} →
                    </RouterLink>
                  </div>
                  <div v-if="tx.description">
                    <p class="text-admin-muted">Description</p>
                    <p>{{ tx.description }}</p>
                  </div>
                  <div v-if="tx.linkSummary">
                    <p class="text-admin-muted">Linked</p>
                    <p>{{ tx.linkSummary }}</p>
                  </div>
                  <div v-if="canOpenInExplorer">
                    <button
                      type="button"
                      class="text-admin-accent hover:underline"
                      @click="openInExplorer(tx)"
                    >
                      Open in Transactions explorer →
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="loading && !rows.length">
            <td colspan="6" class="py-8 text-center text-admin-muted">Loading…</td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="6" class="py-8 text-center text-admin-muted">No transactions found</td>
          </tr>
          <tr v-if="loadingMore">
            <td colspan="6" class="py-3 text-center text-xs text-admin-muted">Loading more…</td>
          </tr>
          <tr v-else-if="rows.length && !hasMore">
            <td colspan="6" class="py-3 text-center text-xs text-admin-muted">End of list</td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseDialog
      title="Revert transaction"
      :open="revertOpen"
      size="sm"
      @close="closeRevert"
    >
      <template #body>
        <div class="space-y-3 text-sm">
          <p class="text-admin-subtext">
            Debits the receiver first, then credits the sender. Levels and agency commission may also
            be clawed back where eligible.
          </p>
          <p v-if="revertTarget" class="rounded-md bg-admin-bg/60 px-3 py-2 text-xs">
            <span class="font-medium">{{ revertTarget.transactionName }}</span>
            <span v-if="revertTarget.description"> · {{ revertTarget.description }}</span>
            · {{ formatAmount(revertTarget) }}
            <span class="mt-1 block font-mono text-admin-muted">{{ revertTarget.id }}</span>
          </p>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Reason (required)</label>
            <textarea
              v-model="revertReason"
              rows="3"
              class="admin-input w-full resize-y"
              placeholder="Support ticket #123 — confirmed fraud"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" :disabled="reverting" @click="closeRevert">
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="reverting || !revertReason.trim()"
          @click="confirmRevert"
        >
          {{ reverting ? 'Reverting…' : 'Confirm revert' }}
        </button>
      </template>
    </BaseDialog>
  </div>
</template>
