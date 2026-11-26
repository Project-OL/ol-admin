<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { format, parseISO } from 'date-fns'
import axios from 'axios'
import { paymentsApi } from '@/api/payments'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import type {
  PaymentChannel,
  PaymentSuspect,
  PaymentTxn,
  PaymentTxnKind,
  SuspectIdentityType,
  SuspectStatus,
} from '@/types/payments'
import { formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'

type Tab = 'transactions' | 'suspects'

const CHANNEL_OPTIONS: { value: PaymentChannel | ''; label: string }[] = [
  { value: '', label: 'All channels' },
  { value: 'EPAY', label: 'Epay' },
  { value: 'GOOGLE_PLAY', label: 'Google Play' },
  { value: 'APPLE', label: 'Apple' },
]
const KIND_OPTIONS: { value: PaymentTxnKind | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'PURCHASE', label: 'Purchases' },
  { value: 'REFUND', label: 'Refunds' },
  { value: 'PAYOUT', label: 'Payouts' },
  { value: 'PAYOUT_REVERSAL', label: 'Payout reversals' },
]
const IDENTITY_OPTIONS: { value: SuspectIdentityType | ''; label: string }[] = [
  { value: '', label: 'All identities' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'DEVICE', label: 'Device' },
  { value: 'USER', label: 'User' },
]
const LIMIT = 50

const tab = ref<Tab>('transactions')

// ── Transactions ─────────────────────────────────────────────────────────────
const txns = ref<PaymentTxn[]>([])
const txnCursors = ref<(string | undefined)[]>([undefined])
const txnPage = ref(0)
const txnNext = ref<string | null>(null)
const txnLoading = ref(false)
const txnFilters = reactive({
  channel: '' as PaymentChannel | '',
  kind: '' as PaymentTxnKind | '',
  externalId: '',
  userId: '',
  from: '',
  to: '',
})

async function loadTxns(pageIndex = 0) {
  txnLoading.value = true
  try {
    const { data } = await paymentsApi.listTransactions({
      channel: txnFilters.channel || undefined,
      kind: txnFilters.kind || undefined,
      externalId: txnFilters.externalId.trim() || undefined,
      userId: txnFilters.userId.trim() || undefined,
      from: txnFilters.from ? new Date(txnFilters.from).toISOString() : undefined,
      to: txnFilters.to ? new Date(`${txnFilters.to}T23:59:59.999`).toISOString() : undefined,
      cursor: txnCursors.value[pageIndex],
      limit: LIMIT,
    })
    txns.value = data.items ?? []
    txnNext.value = data.nextCursor
    txnPage.value = pageIndex
    if (data.nextCursor) txnCursors.value[pageIndex + 1] = data.nextCursor
  } catch (err) {
    showToast(errorMessage(err, 'Could not load payment transactions'), 'error')
  } finally {
    txnLoading.value = false
  }
}

function searchTxns() {
  txnCursors.value = [undefined]
  void loadTxns(0)
}

function resetTxns() {
  Object.assign(txnFilters, { channel: '', kind: '', externalId: '', userId: '', from: '', to: '' })
  searchTxns()
}

// ── Suspects ─────────────────────────────────────────────────────────────────
const suspects = ref<PaymentSuspect[]>([])
const suspectTotal = ref(0)
const suspectPage = ref(1)
const suspectLoading = ref(false)
const suspectFilters = reactive({
  status: 'ACTIVE' as SuspectStatus | '',
  identityType: '' as SuspectIdentityType | '',
  q: '',
})

async function loadSuspects(p = 1) {
  suspectLoading.value = true
  try {
    const { data } = await paymentsApi.listSuspects({
      status: suspectFilters.status || undefined,
      identityType: suspectFilters.identityType || undefined,
      q: suspectFilters.q.trim() || undefined,
      page: p,
      limit: LIMIT,
    })
    suspects.value = data.items ?? []
    suspectTotal.value = data.total ?? 0
    suspectPage.value = p
  } catch (err) {
    showToast(errorMessage(err, 'Could not load the suspect list'), 'error')
  } finally {
    suspectLoading.value = false
  }
}

const suspectPages = computed(() => Math.max(1, Math.ceil(suspectTotal.value / LIMIT)))

const statusDialog = reactive({
  open: false,
  row: null as PaymentSuspect | null,
  note: '',
  saving: false,
})

function openStatusDialog(row: PaymentSuspect) {
  statusDialog.row = row
  statusDialog.note = row.note ?? ''
  statusDialog.open = true
}

async function confirmStatus() {
  const row = statusDialog.row
  if (!row) return
  statusDialog.saving = true
  try {
    const next: SuspectStatus = row.status === 'ACTIVE' ? 'CLEARED' : 'ACTIVE'
    await paymentsApi.setSuspectStatus(row.id, {
      status: next,
      note: statusDialog.note.trim() || undefined,
    })
    showToast(next === 'CLEARED' ? 'Entry cleared' : 'Entry re-activated', 'success')
    statusDialog.open = false
    await loadSuspects(suspectPage.value)
  } catch (err) {
    showToast(errorMessage(err, 'Could not update the entry'), 'error')
  } finally {
    statusDialog.saving = false
  }
}

// ── Manual refund ────────────────────────────────────────────────────────────
const refundDialog = reactive({
  open: false,
  channel: 'GOOGLE_PLAY' as PaymentChannel,
  purchaseExternalId: '',
  refundExternalId: '',
  refundAmount: '',
  reason: '',
  saving: false,
})

function openRefund(txn?: PaymentTxn) {
  refundDialog.channel = txn?.channel ?? 'GOOGLE_PLAY'
  refundDialog.purchaseExternalId = txn?.externalId ?? ''
  refundDialog.refundExternalId = ''
  refundDialog.refundAmount = ''
  refundDialog.reason = ''
  refundDialog.open = true
}

const refundValid = computed(
  () =>
    refundDialog.purchaseExternalId.trim().length > 0 &&
    refundDialog.reason.trim().length >= 3 &&
    (refundDialog.refundAmount.trim() === '' ||
      /^\d+(\.\d{1,6})?$/.test(refundDialog.refundAmount.trim())),
)

async function confirmRefund() {
  if (!refundValid.value) return
  refundDialog.saving = true
  try {
    const { data } = await paymentsApi.applyRefund({
      channel: refundDialog.channel,
      purchaseExternalId: refundDialog.purchaseExternalId.trim(),
      refundExternalId: refundDialog.refundExternalId.trim() || undefined,
      refundAmount: refundDialog.refundAmount.trim() || undefined,
      reason: refundDialog.reason.trim(),
    })
    showToast(
      data.outcome === 'APPLIED'
        ? `Refund applied: ${formatNumber(Number(data.clawedUnits))} coins taken back, account suspended`
        : 'This refund was already applied',
      'success',
    )
    refundDialog.open = false
    await loadTxns(txnPage.value)
  } catch (err) {
    showToast(errorMessage(err, 'Could not apply the refund'), 'error')
  } finally {
    refundDialog.saving = false
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function errorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { code?: string; message?: string } | undefined
    if (body?.code === 'PURCHASE_NOT_FOUND') return 'No recorded purchase with that id'
    if (body?.message) return body.message
  }
  return fallback
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function channelLabel(c: string) {
  return c === 'GOOGLE_PLAY' ? 'Google Play' : c === 'APPLE' ? 'Apple' : c === 'EPAY' ? 'Epay' : c
}

function kindClass(kind: string) {
  if (kind === 'REFUND' || kind === 'PAYOUT_REVERSAL') return 'bg-admin-danger/20 text-admin-danger'
  if (kind === 'PAYOUT') return 'bg-admin-warn/20 text-admin-warn'
  return 'bg-admin-accent/15 text-admin-accent'
}

function unitsLabel(t: PaymentTxn) {
  if (!t.units) return '—'
  const unit =
    t.walletCurrency === 'TRADING_COIN'
      ? 'trading coins'
      : t.walletCurrency === 'POINT'
        ? 'points'
        : 'coins'
  return `${formatNumber(Number(t.units))} ${unit}`
}

function setTab(next: Tab) {
  tab.value = next
  if (next === 'suspects' && !suspects.value.length) void loadSuspects(1)
}

onMounted(() => {
  void loadTxns(0)
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Payments</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Every purchase, refund and payout with Epay, Google Play and Apple, and the payment
          suspect list
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="admin-btn-secondary text-sm"
          :disabled="txnLoading || suspectLoading"
          @click="tab === 'transactions' ? loadTxns(txnPage) : loadSuspects(suspectPage)"
        >
          Refresh
        </button>
        <button type="button" class="admin-btn-warn text-sm" @click="openRefund()">
          Record a refund
        </button>
      </div>
    </div>

    <div class="flex w-fit gap-1 rounded-lg border border-admin-border bg-admin-surface p-1">
      <button
        v-for="t in [
          { value: 'transactions', label: 'Transactions' },
          { value: 'suspects', label: 'Suspect list' },
        ] as const"
        :key="t.value"
        type="button"
        :class="[
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          tab === t.value
            ? 'bg-admin-accent/15 text-admin-accent'
            : 'text-admin-subtext hover:text-admin-text',
        ]"
        @click="setTab(t.value)"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Transactions -->
    <section v-if="tab === 'transactions'" class="admin-card">
      <div class="mb-4 flex flex-wrap gap-2">
        <select v-model="txnFilters.channel" class="admin-input w-auto">
          <option v-for="o in CHANNEL_OPTIONS" :key="o.value || 'all'" :value="o.value">
            {{ o.label }}
          </option>
        </select>
        <select v-model="txnFilters.kind" class="admin-input w-auto">
          <option v-for="o in KIND_OPTIONS" :key="o.value || 'all'" :value="o.value">
            {{ o.label }}
          </option>
        </select>
        <input
          v-model="txnFilters.externalId"
          type="text"
          class="admin-input min-w-0 w-full flex-1 sm:min-w-[180px]"
          placeholder="Order / transaction id…"
          @keydown.enter="searchTxns"
        />
        <input
          v-model="txnFilters.userId"
          type="text"
          class="admin-input min-w-0 w-full flex-1 sm:min-w-[180px]"
          placeholder="User UUID…"
          @keydown.enter="searchTxns"
        />
        <input v-model="txnFilters.from" type="date" class="admin-input w-auto" title="From" />
        <input v-model="txnFilters.to" type="date" class="admin-input w-auto" title="To" />
        <button type="button" class="admin-btn-primary" :disabled="txnLoading" @click="searchTxns">
          {{ txnLoading ? 'Loading…' : 'Search' }}
        </button>
        <button type="button" class="admin-btn-secondary" :disabled="txnLoading" @click="resetTxns">
          Reset
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>User</th>
              <th>Amount</th>
              <th>Coins / points</th>
              <th>Id</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in txns" :key="t.id">
              <td class="whitespace-nowrap text-xs">{{ formatDt(t.occurredAt) }}</td>
              <td>
                <span
                  :class="[
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    kindClass(t.kind),
                  ]"
                >
                  {{ t.kind }}
                </span>
                <p class="mt-0.5 text-xs text-admin-muted">{{ channelLabel(t.channel) }}</p>
              </td>
              <td>
                <RouterLink
                  :to="`/admin/users/${t.userId}`"
                  class="text-sm font-medium text-admin-accent hover:underline"
                >
                  {{ t.user?.name ?? t.user?.publicId ?? t.userId.slice(0, 8) }}
                </RouterLink>
                <p class="font-mono text-xs text-admin-subtext">
                  {{ t.user?.publicId ?? '—' }}
                  <span v-if="t.user && t.user.status !== 'active'" class="text-admin-danger">
                    · {{ t.user.status }}
                  </span>
                </p>
              </td>
              <td class="whitespace-nowrap font-mono text-sm">{{ t.amount }} {{ t.currency }}</td>
              <td class="whitespace-nowrap text-sm">{{ unitsLabel(t) }}</td>
              <td>
                <p class="font-mono text-xs">{{ t.externalId }}</p>
                <p v-if="t.providerRef" class="font-mono text-xs text-admin-muted">
                  {{ t.providerRef }}
                </p>
              </td>
              <td class="text-xs">
                {{ t.status }}
                <p v-if="t.reason" class="max-w-[220px] truncate text-admin-muted" :title="t.reason">
                  {{ t.reason }}
                </p>
              </td>
              <td>
                <button
                  v-if="t.kind === 'PURCHASE' && t.status === 'SUCCEEDED'"
                  type="button"
                  class="admin-btn-secondary text-xs"
                  @click="openRefund(t)"
                >
                  Refund…
                </button>
              </td>
            </tr>
            <tr v-if="txnLoading && !txns.length">
              <td colspan="8" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!txns.length">
              <td colspan="8" class="py-10 text-center text-admin-muted">
                No payment transactions found
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination mt-4">
        <span>Page {{ txnPage + 1 }}</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="txnPage === 0 || txnLoading"
            @click="loadTxns(txnPage - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="!txnNext || txnLoading"
            @click="loadTxns(txnPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <!-- Suspects -->
    <section v-else class="admin-card">
      <p class="mb-3 text-sm text-admin-subtext">
        Added automatically when a purchase is refunded: the buyer's phone, email, devices and
        account. Clearing an entry does not lift the account suspension; reactivate the user on
        their page.
      </p>
      <div class="mb-4 flex flex-wrap gap-2">
        <select v-model="suspectFilters.status" class="admin-input w-auto">
          <option value="ACTIVE">Active</option>
          <option value="CLEARED">Cleared</option>
          <option value="">All</option>
        </select>
        <select v-model="suspectFilters.identityType" class="admin-input w-auto">
          <option v-for="o in IDENTITY_OPTIONS" :key="o.value || 'all'" :value="o.value">
            {{ o.label }}
          </option>
        </select>
        <input
          v-model="suspectFilters.q"
          type="text"
          class="admin-input min-w-0 w-full flex-1 sm:min-w-[180px]"
          placeholder="Phone, email, device id…"
          @keydown.enter="loadSuspects(1)"
        />
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="suspectLoading"
          @click="loadSuspects(1)"
        >
          {{ suspectLoading ? 'Loading…' : 'Search' }}
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Identity</th>
              <th>User</th>
              <th>Reason</th>
              <th>Hits</th>
              <th>Last flagged</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in suspects" :key="s.id">
              <td>
                <p class="text-xs text-admin-muted">{{ s.identityType }}</p>
                <p class="max-w-[260px] truncate font-mono text-sm" :title="s.identityValue">
                  {{ s.identityValue }}
                </p>
              </td>
              <td>
                <RouterLink
                  :to="`/admin/users/${s.userId}`"
                  class="font-mono text-xs text-admin-accent hover:underline"
                >
                  {{ s.userId.slice(0, 8) }}…
                </RouterLink>
              </td>
              <td class="text-xs">{{ s.reason }}</td>
              <td class="text-sm">{{ s.hitCount }}</td>
              <td class="whitespace-nowrap text-xs">{{ formatDt(s.lastFlaggedAt) }}</td>
              <td class="text-xs">
                <span :class="s.status === 'ACTIVE' ? 'text-admin-danger' : 'text-admin-muted'">
                  {{ s.status }}
                </span>
                <p v-if="s.note" class="max-w-[200px] truncate text-admin-muted" :title="s.note">
                  {{ s.note }}
                </p>
              </td>
              <td>
                <button
                  type="button"
                  class="admin-btn-secondary text-xs"
                  @click="openStatusDialog(s)"
                >
                  {{ s.status === 'ACTIVE' ? 'Clear…' : 'Re-activate…' }}
                </button>
              </td>
            </tr>
            <tr v-if="suspectLoading && !suspects.length">
              <td colspan="7" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!suspects.length">
              <td colspan="7" class="py-10 text-center text-admin-muted">No entries found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination mt-4">
        <span>{{ formatNumber(suspectTotal) }} total</span>
        <div class="flex items-center gap-2">
          <span class="text-xs">Page {{ suspectPage }} / {{ suspectPages }}</span>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="suspectPage <= 1 || suspectLoading"
            @click="loadSuspects(suspectPage - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="suspectPage >= suspectPages || suspectLoading"
            @click="loadSuspects(suspectPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <!-- Clear / re-activate a suspect entry -->
    <BaseDialog
      :open="statusDialog.open"
      :title="statusDialog.row?.status === 'ACTIVE' ? 'Clear suspect entry' : 'Re-activate entry'"
      size="sm"
      @close="statusDialog.open = false"
    >
      <template #body>
        <p class="mb-3 text-sm text-admin-subtext">
          <span class="font-mono text-admin-text">{{ statusDialog.row?.identityValue }}</span>
          · optional note
        </p>
        <textarea
          v-model="statusDialog.note"
          rows="3"
          maxlength="2000"
          class="admin-input resize-none"
          placeholder="Why…"
        />
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="statusDialog.open = false">
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="statusDialog.saving"
          @click="confirmStatus"
        >
          {{ statusDialog.saving ? 'Saving…' : 'Confirm' }}
        </button>
      </template>
    </BaseDialog>

    <!-- Record a refund -->
    <BaseDialog
      :open="refundDialog.open"
      title="Record a refund"
      size="md"
      @close="refundDialog.open = false"
    >
      <template #body>
        <div class="space-y-3">
          <p class="rounded-md border border-admin-danger/40 bg-admin-danger/10 p-3 text-sm">
            This takes the purchased coins back (the balance may go negative),
            <strong>suspends the account indefinitely</strong>, freezes all of its wallets,
            cancels open withdrawals and adds the buyer to the suspect list.
          </p>
          <label class="block text-sm">
            Channel
            <select v-model="refundDialog.channel" class="admin-input mt-1">
              <option value="GOOGLE_PLAY">Google Play</option>
              <option value="APPLE">Apple</option>
              <option value="EPAY">Epay</option>
            </select>
          </label>
          <label class="block text-sm">
            Purchase id (order / transaction id)
            <input v-model="refundDialog.purchaseExternalId" type="text" class="admin-input mt-1" />
          </label>
          <label class="block text-sm">
            Refund id from the provider (optional)
            <input v-model="refundDialog.refundExternalId" type="text" class="admin-input mt-1" />
          </label>
          <label class="block text-sm">
            Refunded amount (optional; empty = full refund)
            <input
              v-model="refundDialog.refundAmount"
              type="text"
              inputmode="decimal"
              class="admin-input mt-1"
              placeholder="e.g. 9.99"
            />
          </label>
          <label class="block text-sm">
            Reason
            <textarea
              v-model="refundDialog.reason"
              rows="2"
              maxlength="500"
              class="admin-input mt-1 resize-none"
              placeholder="e.g. Refund seen in Play Console, order GPA.1234…"
            />
          </label>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="refundDialog.open = false">
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-warn"
          :disabled="!refundValid || refundDialog.saving"
          @click="confirmRefund"
        >
          {{ refundDialog.saving ? 'Applying…' : 'Apply refund' }}
        </button>
      </template>
    </BaseDialog>
  </div>
</template>
