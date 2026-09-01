<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { format } from 'date-fns'
import { userAdminApi } from '@/api/userAdmin'
import { formatCoins } from '@/utils/format'
import { showToast } from '@/utils/toast'
import type {
  AdminUserVipDailyClaim,
  AdminUserVipDossier,
  AdminUserVipPurchase,
} from '@/types/userVipGuardian'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'

const props = defineProps<{ userId: string }>()

const dossier = ref<AdminUserVipDossier | null>(null)
const purchases = ref<AdminUserVipPurchase[]>([])
const claims = ref<AdminUserVipDailyClaim[]>([])
const purchasesCursor = ref<string | null>(null)
const purchasesHasMore = ref(false)
const claimsCursor = ref<string | null>(null)
const claimsHasMore = ref(false)

const loading = ref(false)
const loadingMorePurchases = ref(false)
const loadingMoreClaims = ref(false)

const PRIVILEGE_LABELS: { key: keyof AdminUserVipDossier['membership']['privileges']; label: string }[] = [
  { key: 'vipExclusiveProfileCard', label: 'Exclusive profile card' },
  { key: 'vipDistinguishedLogo', label: 'Distinguished logo' },
  { key: 'vipExclusiveMessageBackground', label: 'Message background' },
  { key: 'vipSpecialEntryEffect', label: 'Special entry effect' },
  { key: 'vipPreventBeingKicked', label: 'Prevent kick' },
  { key: 'vipLiveTranslationEnabled', label: 'Live translation' },
]

const membership = computed(() => dossier.value?.membership ?? null)

function formatCoinStr(value: string) {
  const n = Number(value)
  return Number.isFinite(n) ? formatCoins(n) : value
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm')
  } catch {
    return value
  }
}

async function load() {
  if (!props.userId) return
  loading.value = true
  try {
    const { data } = await userAdminApi.getUserVip(props.userId, {
      purchasesLimit: 50,
      claimsLimit: 50,
    })
    dossier.value = data
    purchases.value = data.purchases.items
    purchasesCursor.value = data.purchases.nextCursor
    purchasesHasMore.value = data.purchases.hasMore
    claims.value = data.dailyClaims.items
    claimsCursor.value = data.dailyClaims.nextCursor
    claimsHasMore.value = data.dailyClaims.hasMore
  } catch {
    dossier.value = null
    purchases.value = []
    claims.value = []
    showToast('Failed to load VIP dossier', 'error')
  } finally {
    loading.value = false
  }
}

async function loadMorePurchases() {
  if (!props.userId || loadingMorePurchases.value || !purchasesHasMore.value || !purchasesCursor.value) {
    return
  }
  loadingMorePurchases.value = true
  try {
    const { data } = await userAdminApi.getUserVip(props.userId, {
      purchasesLimit: 50,
      purchasesCursor: purchasesCursor.value,
      claimsLimit: 1,
    })
    purchases.value = [...purchases.value, ...data.purchases.items]
    purchasesCursor.value = data.purchases.nextCursor
    purchasesHasMore.value = data.purchases.hasMore
  } catch {
    showToast('Failed to load more purchases', 'error')
  } finally {
    loadingMorePurchases.value = false
  }
}

async function loadMoreClaims() {
  if (!props.userId || loadingMoreClaims.value || !claimsHasMore.value || !claimsCursor.value) {
    return
  }
  loadingMoreClaims.value = true
  try {
    const { data } = await userAdminApi.getUserVip(props.userId, {
      claimsLimit: 50,
      claimsCursor: claimsCursor.value,
      purchasesLimit: 1,
    })
    claims.value = [...claims.value, ...data.dailyClaims.items]
    claimsCursor.value = data.dailyClaims.nextCursor
    claimsHasMore.value = data.dailyClaims.hasMore
  } catch {
    showToast('Failed to load more claims', 'error')
  } finally {
    loadingMoreClaims.value = false
  }
}

const {
  sortKey: purchasesSortKey,
  sortDir: purchasesSortDir,
  sortedRows: sortedPurchases,
  toggleSort: togglePurchasesSort,
} = useSortableRows(purchases, (row, key) => {
  switch (key) {
    case 'createdAt':
      return row.createdAt ? new Date(row.createdAt).getTime() : 0
    case 'tier':
      return row.tier ?? ''
    case 'periodDays':
      return row.periodDays ?? 0
    case 'coinCost':
      return Number(row.coinCost ?? 0)
    case 'expiresAtAfter':
      return row.expiresAtAfter ? new Date(row.expiresAtAfter).getTime() : 0
    default:
      return undefined
  }
})

const {
  sortKey: claimsSortKey,
  sortDir: claimsSortDir,
  sortedRows: sortedClaims,
  toggleSort: toggleClaimsSort,
} = useSortableRows(claims, (row, key) => {
  switch (key) {
    case 'claimDate':
      return row.claimDate ?? ''
    case 'coinAmount':
      return Number(row.coinAmount ?? 0)
    case 'claimedAt':
      return row.claimedAt ? new Date(row.claimedAt).getTime() : 0
    case 'ledgerEntryId':
      return row.ledgerEntryId ?? ''
    default:
      return undefined
  }
})

onMounted(() => load())
watch(() => props.userId, () => load())
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <div v-if="loading && !dossier" class="admin-card flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
    </div>

    <template v-else-if="dossier && membership">
      <!-- Membership header -->
      <div class="admin-card space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">VIP Membership</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Rich tier:
              {{
                dossier.richTier.displayName?.trim() ||
                (dossier.richTier.tier > 0 ? `Tier ${dossier.richTier.tier}` : 'None')
              }}
              <template v-if="dossier.richTier.tier > 0"> ({{ dossier.richTier.tier }})</template>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-if="membership.tier"
              class="rounded bg-admin-accent/15 px-2.5 py-1 text-xs font-semibold text-admin-accent"
            >
              {{ membership.tier }}
            </span>
            <span
              :class="[
                'rounded-full px-2.5 py-1 text-xs font-medium',
                membership.isActive
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-admin-muted/20 text-admin-subtext',
              ]"
            >
              {{ membership.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p class="text-xs text-admin-subtext">Expires</p>
            <p class="mt-0.5 text-sm font-medium">{{ formatDate(membership.expiresAt) }}</p>
          </div>
          <div>
            <p class="text-xs text-admin-subtext">Days remaining</p>
            <p class="mt-0.5 text-sm font-medium tabular-nums">{{ membership.daysRemaining }}</p>
          </div>
          <div>
            <p class="text-xs text-admin-subtext">Subscription</p>
            <p class="mt-0.5 text-sm font-medium">
              {{ membership.subscriptionActive ? 'Active' : 'Inactive' }}
            </p>
            <p v-if="membership.subscriptionExpiresAt" class="text-xs text-admin-muted">
              until {{ formatDate(membership.subscriptionExpiresAt) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-admin-subtext">Daily claim</p>
            <p class="mt-0.5 text-sm font-medium">
              {{ membership.dailyClaimAvailable ? 'Available' : 'Claimed' }}
            </p>
            <p v-if="membership.lastClaimedAt" class="text-xs text-admin-muted">
              last {{ formatDate(membership.lastClaimedAt) }}
            </p>
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-medium text-admin-subtext">Privileges</p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="p in PRIVILEGE_LABELS"
              :key="p.key"
              :class="[
                'rounded px-2 py-0.5 text-xs',
                membership.privileges[p.key]
                  ? 'bg-admin-success/20 text-admin-success'
                  : 'bg-admin-muted/20 text-admin-muted',
              ]"
            >
              {{ p.label }}
            </span>
          </div>
        </div>

        <div
          v-if="dossier.rareId.active"
          class="rounded-md border border-admin-border bg-admin-bg/50 p-3"
        >
          <p class="text-xs font-medium text-admin-subtext">Rare ID</p>
          <p class="mt-1 font-mono text-sm font-semibold">
            {{ dossier.rareId.currentVipPublicId ?? '—' }}
          </p>
          <p v-if="dossier.rareId.vipPublicIdExpiresAt" class="mt-0.5 text-xs text-admin-muted">
            Expires {{ formatDate(dossier.rareId.vipPublicIdExpiresAt) }}
          </p>
        </div>
      </div>

      <!-- Purchases -->
      <div class="admin-card">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Purchases</h3>
          <span class="text-xs text-admin-subtext">{{ dossier.purchases.total }} total</span>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Date" sort-key="createdAt" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
                <SortableTh label="Tier" sort-key="tier" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
                <SortableTh label="Period" sort-key="periodDays" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
                <SortableTh label="Coins" sort-key="coinCost" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
                <SortableTh label="Expiry after" sort-key="expiresAtAfter" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedPurchases" :key="row.id">
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.createdAt) }}</td>
                <td>
                  <span class="rounded bg-admin-accent/15 px-2 py-0.5 text-xs font-semibold text-admin-accent">
                    {{ row.tier }}
                  </span>
                </td>
                <td class="tabular-nums text-sm">{{ row.periodDays }}d</td>
                <td class="tabular-nums text-sm font-medium">{{ formatCoinStr(row.coinCost) }}</td>
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.expiresAtAfter) }}</td>
              </tr>
              <tr v-if="!purchases.length">
                <td colspan="5" class="py-8 text-center text-admin-muted">No purchases</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="purchasesHasMore" class="mt-3 flex justify-center">
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="loadingMorePurchases"
            @click="loadMorePurchases"
          >
            {{ loadingMorePurchases ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </div>

      <!-- Daily claims -->
      <div class="admin-card">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Daily claims</h3>
          <span class="text-xs text-admin-subtext">{{ dossier.dailyClaims.total }} total</span>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Claim date" sort-key="claimDate" :active-key="claimsSortKey" :direction="claimsSortDir" @sort="toggleClaimsSort" />
                <SortableTh label="Coins" sort-key="coinAmount" :active-key="claimsSortKey" :direction="claimsSortDir" @sort="toggleClaimsSort" />
                <SortableTh label="Claimed at" sort-key="claimedAt" :active-key="claimsSortKey" :direction="claimsSortDir" @sort="toggleClaimsSort" />
                <SortableTh label="Ledger" sort-key="ledgerEntryId" :active-key="claimsSortKey" :direction="claimsSortDir" @sort="toggleClaimsSort" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedClaims" :key="`${row.claimDate}-${row.ledgerEntryId}`">
                <td class="font-mono text-xs">{{ row.claimDate }}</td>
                <td class="tabular-nums text-sm font-medium">{{ formatCoinStr(row.coinAmount) }}</td>
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.claimedAt) }}</td>
                <td class="max-w-[120px] truncate font-mono text-xs" :title="row.ledgerEntryId">
                  {{ row.ledgerEntryId }}
                </td>
              </tr>
              <tr v-if="!claims.length">
                <td colspan="4" class="py-8 text-center text-admin-muted">No daily claims</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="claimsHasMore" class="mt-3 flex justify-center">
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="loadingMoreClaims"
            @click="loadMoreClaims"
          >
            {{ loadingMoreClaims ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </div>
    </template>

    <div v-else class="admin-card py-10 text-center text-admin-muted">
      VIP dossier unavailable
    </div>
  </div>
</template>
