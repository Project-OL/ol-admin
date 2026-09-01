<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { format } from 'date-fns'
import { userAdminApi } from '@/api/userAdmin'
import { formatCoins } from '@/utils/format'
import { showToast } from '@/utils/toast'
import type {
  AdminGuardianRelation,
  AdminUserGuardianDossier,
  GuardianCounterparty,
} from '@/types/userVipGuardian'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'

const props = defineProps<{ userId: string }>()

type InnerTab = 'asGuardian' | 'asTarget' | 'purchases'

const dossier = ref<AdminUserGuardianDossier | null>(null)
const loading = ref(false)
const activeTab = ref<InnerTab>('asGuardian')

const tabs: { id: InnerTab; label: string }[] = [
  { id: 'asGuardian', label: 'Guarding others' },
  { id: 'asTarget', label: 'Guarded by' },
  { id: 'purchases', label: 'Purchase history' },
]

const summary = computed(() => dossier.value?.summary ?? null)

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

function counterpartyLabel(c: GuardianCounterparty | null | undefined) {
  if (!c) return '—'
  return c.displayName || c.name || c.username || c.displayPublicId || c.publicId || c.userId
}

function counterpartyPublicId(c: GuardianCounterparty | null | undefined) {
  if (!c) return '—'
  return c.displayPublicId || c.publicId || '—'
}

async function load() {
  if (!props.userId) return
  loading.value = true
  try {
    const { data } = await userAdminApi.getUserGuardians(props.userId, {
      purchaseHistoryLimit: 50,
    })
    dossier.value = data
  } catch {
    dossier.value = null
    showToast('Failed to load guardian dossier', 'error')
  } finally {
    loading.value = false
  }
}

function relationRows(): AdminGuardianRelation[] {
  if (!dossier.value) return []
  if (activeTab.value === 'asGuardian') return dossier.value.asGuardian
  if (activeTab.value === 'asTarget') return dossier.value.asTarget
  return []
}

const relationRowsList = computed<AdminGuardianRelation[]>(() => relationRows())
const purchasesList = computed(() => dossier.value?.purchases ?? [])

const {
  sortKey: relationsSortKey,
  sortDir: relationsSortDir,
  sortedRows: sortedRelations,
  toggleSort: toggleRelationsSort,
} = useSortableRows(relationRowsList, (row, key) => {
  switch (key) {
    case 'counterparty':
      return counterpartyLabel(row.counterparty).toLowerCase()
    case 'tier':
      return row.tier ?? ''
    case 'durationMonths':
      return row.durationMonths ?? 0
    case 'coinsPaid':
      return Number(row.coinsPaid ?? 0)
    case 'purchasedAt':
      return row.purchasedAt ? new Date(row.purchasedAt).getTime() : 0
    case 'expiresAt':
      return row.expiresAt ? new Date(row.expiresAt).getTime() : 0
    case 'status':
      return row.isExpired ? 0 : 1
    default:
      return undefined
  }
})

const {
  sortKey: purchasesSortKey,
  sortDir: purchasesSortDir,
  sortedRows: sortedPurchases,
  toggleSort: togglePurchasesSort,
} = useSortableRows(purchasesList, (row, key) => {
  switch (key) {
    case 'purchasedAt':
      return row.purchasedAt ? new Date(row.purchasedAt).getTime() : 0
    case 'counterparty':
      return (row.counterparty ? counterpartyLabel(row.counterparty) : '').toLowerCase()
    case 'tier':
      return row.tier ?? ''
    case 'durationMonths':
      return row.durationMonths ?? -1
    case 'coinsPaid':
      return Number(row.coinsPaid ?? 0)
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

    <template v-else-if="dossier && summary">
      <div class="admin-card">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">Guardian</h2>
            <p class="mt-0.5 text-xs text-admin-subtext">
              Relationships and ledger purchase history
            </p>
          </div>
          <div class="flex flex-wrap gap-3 text-xs text-admin-subtext">
            <span>
              Guarding
              <strong class="text-admin-text">{{ summary.activeAsGuardianCount }}</strong>
              / {{ summary.asGuardianCount }}
            </span>
            <span>
              Guarded by
              <strong class="text-admin-text">{{ summary.activeAsTargetCount }}</strong>
              / {{ summary.asTargetCount }}
            </span>
            <span>
              Purchases
              <strong class="text-admin-text">{{ summary.purchaseHistoryCount }}</strong>
            </span>
          </div>
        </div>

        <div class="mb-4 flex flex-wrap gap-1 rounded-lg bg-admin-bg p-1">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            :class="[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-admin-accent text-white'
                : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
            <span
              v-if="tab.id === 'asGuardian'"
              class="ml-1 opacity-80"
            >({{ dossier.asGuardian.length }})</span>
            <span
              v-else-if="tab.id === 'asTarget'"
              class="ml-1 opacity-80"
            >({{ dossier.asTarget.length }})</span>
            <span
              v-else
              class="ml-1 opacity-80"
            >({{ dossier.purchases.length }})</span>
          </button>
        </div>

        <!-- Relationships -->
        <div v-if="activeTab !== 'purchases'" class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Counterparty" sort-key="counterparty" :active-key="relationsSortKey" :direction="relationsSortDir" @sort="toggleRelationsSort" />
                <SortableTh label="Tier" sort-key="tier" :active-key="relationsSortKey" :direction="relationsSortDir" @sort="toggleRelationsSort" />
                <SortableTh label="Duration" sort-key="durationMonths" :active-key="relationsSortKey" :direction="relationsSortDir" @sort="toggleRelationsSort" />
                <SortableTh label="Coins" sort-key="coinsPaid" :active-key="relationsSortKey" :direction="relationsSortDir" @sort="toggleRelationsSort" />
                <SortableTh label="Purchased" sort-key="purchasedAt" :active-key="relationsSortKey" :direction="relationsSortDir" @sort="toggleRelationsSort" />
                <SortableTh label="Expires" sort-key="expiresAt" :active-key="relationsSortKey" :direction="relationsSortDir" @sort="toggleRelationsSort" />
                <SortableTh label="Status" sort-key="status" :active-key="relationsSortKey" :direction="relationsSortDir" @sort="toggleRelationsSort" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedRelations" :key="row.guardianId + row.role">
                <td>
                  <div class="flex items-center gap-2">
                    <img
                      v-if="row.counterparty.avatarUrl"
                      :src="row.counterparty.avatarUrl"
                      alt=""
                      class="h-7 w-7 rounded-full object-cover"
                    />
                    <div class="min-w-0">
                      <RouterLink
                        :to="`/admin/users/${row.counterparty.userId}`"
                        class="truncate font-medium text-admin-accent hover:underline"
                      >
                        {{ counterpartyLabel(row.counterparty) }}
                      </RouterLink>
                      <p class="truncate font-mono text-xs text-admin-subtext">
                        {{ counterpartyPublicId(row.counterparty) }}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="rounded bg-admin-accent/15 px-2 py-0.5 text-xs font-semibold text-admin-accent">
                    {{ row.tier }}
                  </span>
                </td>
                <td class="tabular-nums text-sm">{{ row.durationMonths }} mo</td>
                <td class="tabular-nums text-sm font-medium">{{ formatCoinStr(row.coinsPaid) }}</td>
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.purchasedAt) }}</td>
                <td class="whitespace-nowrap text-xs">
                  {{ formatDate(row.expiresAt) }}
                  <span v-if="!row.isExpired" class="block text-admin-muted">
                    {{ row.daysRemaining }}d left
                  </span>
                </td>
                <td>
                  <div class="flex flex-col gap-1">
                    <span
                      :class="[
                        'inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium',
                        row.isExpired
                          ? 'bg-admin-muted/20 text-admin-subtext'
                          : 'bg-emerald-500/15 text-emerald-400',
                      ]"
                    >
                      {{ row.isExpired ? 'Expired' : 'Active' }}
                    </span>
                    <span
                      v-if="row.isTopGuardian && activeTab === 'asTarget'"
                      class="inline-flex w-fit rounded-full bg-admin-warn/20 px-2 py-0.5 text-xs font-medium text-admin-warn"
                    >
                      Top guardian
                    </span>
                  </div>
                </td>
              </tr>
              <tr v-if="!relationRows().length">
                <td colspan="7" class="py-8 text-center text-admin-muted">No relationships</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Purchase history (ledger) -->
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Date" sort-key="purchasedAt" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
                <SortableTh label="Counterparty" sort-key="counterparty" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
                <SortableTh label="Tier" sort-key="tier" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
                <SortableTh label="Duration" sort-key="durationMonths" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
                <SortableTh label="Coins" sort-key="coinsPaid" :active-key="purchasesSortKey" :direction="purchasesSortDir" @sort="togglePurchasesSort" />
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedPurchases" :key="row.ledgerEntryId">
                <td class="whitespace-nowrap text-xs">{{ formatDate(row.purchasedAt) }}</td>
                <td>
                  <template v-if="row.counterparty">
                    <RouterLink
                      :to="`/admin/users/${row.counterparty.userId}`"
                      class="font-medium text-admin-accent hover:underline"
                    >
                      {{ counterpartyLabel(row.counterparty) }}
                    </RouterLink>
                    <p class="font-mono text-xs text-admin-subtext">
                      {{ counterpartyPublicId(row.counterparty) }}
                    </p>
                  </template>
                  <span v-else class="text-admin-muted">—</span>
                </td>
                <td>
                  <span
                    v-if="row.tier"
                    class="rounded bg-admin-accent/15 px-2 py-0.5 text-xs font-semibold text-admin-accent"
                  >
                    {{ row.tier }}
                  </span>
                  <span v-else class="text-admin-muted">—</span>
                </td>
                <td class="tabular-nums text-sm">
                  {{ row.durationMonths != null ? `${row.durationMonths} mo` : '—' }}
                </td>
                <td class="tabular-nums text-sm font-medium">{{ formatCoinStr(row.coinsPaid) }}</td>
                <td class="max-w-[180px] truncate text-sm" :title="row.description ?? undefined">
                  {{ row.description ?? '—' }}
                </td>
              </tr>
              <tr v-if="!dossier.purchases.length">
                <td colspan="6" class="py-8 text-center text-admin-muted">No purchase history</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else class="admin-card py-10 text-center text-admin-muted">
      Guardian dossier unavailable
    </div>
  </div>
</template>
