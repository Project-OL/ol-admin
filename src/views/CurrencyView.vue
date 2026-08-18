<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { currencyApi } from '@/api/currency'
import { userAdminApi } from '@/api/userAdmin'
import type {
  AdminCurrencyAdjustmentEntry,
  AdminCurrencyKind,
  AdminCurrencySupplySummary,
} from '@/types/currency'
import type { UserSearchItem } from '@/types/api'
import { formatCoins, formatPoints } from '@/utils/format'
import { showToast } from '@/utils/toast'
import { format, parseISO } from 'date-fns'

const supply = ref<AdminCurrencySupplySummary | null>(null)
const supplyLoading = ref(false)
const entries = ref<AdminCurrencyAdjustmentEntry[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const listLoading = ref(false)
const listLoadingMore = ref(false)

const filters = reactive({
  from: '',
  to: '',
  currency: '' as '' | AdminCurrencyKind,
  direction: '' as '' | 'credit' | 'debit',
})

const form = reactive({
  userQuery: '',
  userId: '',
  userLabel: '',
  currency: 'COIN' as AdminCurrencyKind,
  direction: 'credit' as 'credit' | 'debit',
  amount: '',
  description: '',
  forceTradingCredit: false,
})
const searchHits = ref<UserSearchItem[]>([])
const searching = ref(false)
const submitting = ref(false)

const dateParams = computed(() => ({
  from: filters.from ? new Date(filters.from).toISOString() : undefined,
  to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
}))

function formatDt(iso: string) {
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function formatBucket(kind: 'coins' | 'points' | 'tradingCoins', value: string | undefined) {
  const n = Number(value ?? 0)
  if (kind === 'points') return formatPoints(n)
  return formatCoins(n)
}

async function loadSupply() {
  supplyLoading.value = true
  try {
    const { data } = await currencyApi.supplySummary(dateParams.value)
    supply.value = data
  } catch (err) {
    supply.value = null
    showToast(axios.isAxiosError(err) ? err.response?.data?.message || 'Failed to load supply' : 'Failed to load supply', 'error')
  } finally {
    supplyLoading.value = false
  }
}

async function loadAdjustments(append = false) {
  if (append) {
    if (listLoadingMore.value || !hasMore.value || !nextCursor.value) return
    listLoadingMore.value = true
  } else {
    listLoading.value = true
  }
  try {
    const { data } = await currencyApi.listAdjustments({
      ...dateParams.value,
      currency: filters.currency || undefined,
      direction: filters.direction || undefined,
      cursor: append ? nextCursor.value ?? undefined : undefined,
      limit: 20,
      userId: form.userId || undefined,
    })
    const next = data.entries ?? []
    entries.value = append ? [...entries.value, ...next] : next
    nextCursor.value = data.nextCursor ?? null
    hasMore.value = Boolean(data.hasMore)
  } catch (err) {
    if (!append) {
      entries.value = []
      nextCursor.value = null
      hasMore.value = false
    }
    showToast(
      axios.isAxiosError(err) ? err.response?.data?.message || 'Failed to load adjustments' : 'Failed to load adjustments',
      'error',
    )
  } finally {
    listLoading.value = false
    listLoadingMore.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadSupply(), loadAdjustments(false)])
}

async function searchUsers() {
  const q = form.userQuery.trim()
  if (!q) {
    searchHits.value = []
    return
  }
  searching.value = true
  try {
    const { data } = await userAdminApi.searchUsers(q, 'auto', 10)
    searchHits.value = data.users ?? []
  } catch {
    searchHits.value = []
  } finally {
    searching.value = false
  }
}

function pickUser(hit: UserSearchItem) {
  const id = hit.userId
  if (!id) return
  form.userId = id
  form.userLabel = [hit.name, hit.username, hit.publicId]
    .filter(Boolean)
    .join(' · ')
  form.userQuery = form.userLabel
  searchHits.value = []
}

async function submitAdjust() {
  if (!form.userId) {
    showToast('Select a user first', 'error')
    return
  }
  if (!/^\d+$/.test(form.amount) || BigInt(form.amount) <= 0n) {
    showToast('Enter a positive integer amount', 'error')
    return
  }
  submitting.value = true
  try {
    await currencyApi.adjust({
      userId: form.userId,
      currency: form.currency,
      direction: form.direction,
      amount: form.amount,
      description: form.description.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
      forceTradingCredit:
        form.currency === 'TRADING_COIN' && form.direction === 'credit'
          ? form.forceTradingCredit
          : undefined,
    })
    showToast(
      `${form.direction === 'credit' ? 'Created' : 'Returned'} ${form.amount} ${form.currency}`,
      'success',
    )
    form.amount = ''
    form.description = ''
    await refreshAll()
  } catch (err) {
    showToast(
      axios.isAxiosError(err) ? err.response?.data?.message || 'Adjust failed' : 'Adjust failed',
      'error',
    )
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void refreshAll()
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Currency</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Mint or burn coins, points, and trading coins from one place. Created / returned track admin
          ADJUSTMENT only (not platform profit).
        </p>
      </div>
      <button type="button" class="admin-btn-secondary text-sm" :disabled="supplyLoading || listLoading" @click="refreshAll">
        Refresh
      </button>
    </div>

    <div class="admin-stats-grid">
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Created · Coins</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ supplyLoading ? '…' : formatBucket('coins', supply?.created.coins) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Created · Points</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ supplyLoading ? '…' : formatBucket('points', supply?.created.points) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Created · Trading</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ supplyLoading ? '…' : formatBucket('tradingCoins', supply?.created.tradingCoins) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Returned · Coins</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ supplyLoading ? '…' : formatBucket('coins', supply?.returned.coins) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Returned · Points</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ supplyLoading ? '…' : formatBucket('points', supply?.returned.points) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Returned · Trading</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">
          {{ supplyLoading ? '…' : formatBucket('tradingCoins', supply?.returned.tradingCoins) }}
        </p>
      </div>
    </div>

    <section class="admin-card space-y-3">
      <h2 class="text-sm font-semibold">Adjust currency</h2>
      <div class="relative">
        <input
          v-model="form.userQuery"
          type="search"
          class="admin-input w-full"
          placeholder="Search user by name, username, or public ID…"
          @keydown.enter.prevent="searchUsers"
          @input="searchUsers"
        />
        <div
          v-if="searchHits.length"
          class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-admin-border bg-admin-surface shadow-lg"
        >
          <button
            v-for="hit in searchHits"
            :key="hit.userId"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-admin-bg"
            @click="pickUser(hit)"
          >
            <span class="font-medium">{{ hit.name || hit.username }}</span>
            <span class="text-xs text-admin-muted">#{{ hit.publicId }}</span>
          </button>
        </div>
        <p v-if="form.userId" class="mt-1 text-xs text-admin-subtext">
          Selected: {{ form.userLabel }}
          <RouterLink class="ml-2 text-admin-accent underline" :to="`/admin/users/${form.userId}`">
            Open profile
          </RouterLink>
        </p>
        <p v-if="searching" class="mt-1 text-xs text-admin-muted">Searching…</p>
      </div>

      <div class="grid gap-2 sm:grid-cols-4">
        <select v-model="form.currency" class="admin-input">
          <option value="COIN">Personal coins</option>
          <option value="POINT">Points</option>
          <option value="TRADING_COIN">Trading coins</option>
        </select>
        <select v-model="form.direction" class="admin-input">
          <option value="credit">Create (credit)</option>
          <option value="debit">Return (debit)</option>
        </select>
        <input v-model="form.amount" type="text" inputmode="numeric" class="admin-input" placeholder="Amount" />
        <input v-model="form.description" type="text" class="admin-input" placeholder="Reason (optional)" />
      </div>
      <label
        v-if="form.currency === 'TRADING_COIN' && form.direction === 'credit'"
        class="flex items-center gap-2 text-sm text-admin-subtext"
      >
        <input v-model="form.forceTradingCredit" type="checkbox" />
        Force trading credit (even if user is not an agency agent)
      </label>
      <button
        type="button"
        class="admin-btn-primary"
        :disabled="submitting"
        @click="submitAdjust"
      >
        {{ submitting ? 'Submitting…' : form.direction === 'credit' ? 'Create currency' : 'Return currency' }}
      </button>
    </section>

    <section class="admin-card space-y-3">
      <div class="admin-filter-bar">
        <input v-model="filters.from" type="date" class="admin-input" title="From" />
        <input v-model="filters.to" type="date" class="admin-input" title="To" />
        <select v-model="filters.currency" class="admin-input">
          <option value="">All currencies</option>
          <option value="COIN">Coins</option>
          <option value="POINT">Points</option>
          <option value="TRADING_COIN">Trading</option>
        </select>
        <select v-model="filters.direction" class="admin-input">
          <option value="">All directions</option>
          <option value="credit">Created</option>
          <option value="debit">Returned</option>
        </select>
        <button type="button" class="admin-btn-primary" :disabled="listLoading" @click="refreshAll">
          Apply
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Currency</th>
              <th>Effect</th>
              <th>Amount</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in entries" :key="row.id">
              <td class="whitespace-nowrap text-xs">{{ formatDt(row.createdAt) }}</td>
              <td>
                <p class="text-sm">{{ row.user.name || row.user.displayName || row.user.username }}</p>
                <p class="text-xs text-admin-muted">#{{ row.user.displayPublicId || row.user.publicId }}</p>
              </td>
              <td>{{ row.currency }}</td>
              <td>
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    row.supplyEffect === 'created'
                      ? 'bg-admin-success/15 text-admin-success'
                      : 'bg-admin-warn/15 text-admin-warn'
                  "
                >
                  {{ row.supplyEffect }}
                </span>
              </td>
              <td class="tabular-nums font-semibold">
                {{
                  row.currency === 'POINT'
                    ? formatPoints(Number(row.amount))
                    : formatCoins(Number(row.amount))
                }}
              </td>
              <td class="text-xs text-admin-subtext">{{ row.description || '—' }}</td>
            </tr>
            <tr v-if="listLoading && !entries.length">
              <td colspan="6" class="py-8 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!entries.length">
              <td colspan="6" class="py-8 text-center text-admin-muted">No adjustments</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button
        v-if="hasMore"
        type="button"
        class="admin-btn-secondary"
        :disabled="listLoadingMore"
        @click="loadAdjustments(true)"
      >
        {{ listLoadingMore ? 'Loading…' : 'Load more' }}
      </button>
    </section>
  </div>
</template>
