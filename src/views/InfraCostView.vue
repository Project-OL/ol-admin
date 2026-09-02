<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { format } from 'date-fns'
import { infraCostApi } from '@/api/infraCost'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'
import type {
  CostByServiceRow,
  Ec2InstanceSummary,
  ElastiCacheClusterSummary,
  FetchError,
  InfraCostByService,
  InfraInventory,
  RdsInstanceSummary,
} from '@/types/infraCost'
import { formatNumber, formatUsd } from '@/utils/format'
import { showToast } from '@/utils/toast'

function isFetchError(value: unknown): value is FetchError {
  return !!value && typeof value === 'object' && 'error' in (value as Record<string, unknown>)
}

function currentUtcMonthValue() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const monthValue = ref(currentUtcMonthValue())

const inventory = ref<InfraInventory | null>(null)
const costByService = ref<InfraCostByService | null>(null)
const loadingInventory = ref(false)
const loadingCost = ref(false)

async function loadInventory(refresh = false) {
  loadingInventory.value = true
  try {
    const res = await infraCostApi.getInventory(refresh)
    inventory.value = res.data
  } catch {
    inventory.value = null
    showToast('Failed to load AWS inventory', 'error')
  } finally {
    loadingInventory.value = false
  }
}

async function loadCost(refresh = false) {
  loadingCost.value = true
  try {
    const [y, m] = monthValue.value.split('-').map(Number)
    const res = await infraCostApi.getCostByService({ year: y, month: m, refresh })
    costByService.value = res.data
  } catch {
    costByService.value = null
    showToast('Failed to load Cost Explorer data', 'error')
  } finally {
    loadingCost.value = false
  }
}

function refreshAll() {
  loadInventory(true)
  loadCost(true)
}

const monthLabel = computed(() => {
  const [y, m] = monthValue.value.split('-').map(Number)
  if (!y || !m) return 'This month (UTC)'
  const d = new Date(Date.UTC(y, m - 1, 1))
  return format(d, 'MMMM yyyy') + ' (UTC)'
})

const costError = computed(() =>
  costByService.value && isFetchError(costByService.value) ? costByService.value.error : null,
)
const costTotal = computed(() =>
  costByService.value && !isFetchError(costByService.value) ? costByService.value.total : null,
)
const costCurrency = computed(() =>
  costByService.value && !isFetchError(costByService.value) ? costByService.value.currency : 'USD',
)
const costRows = computed<CostByServiceRow[]>(() =>
  costByService.value && !isFetchError(costByService.value) ? costByService.value.byService : [],
)

const {
  sortKey: costSortKey,
  sortDir: costSortDir,
  sortedRows: sortedCostRows,
  toggleSort: toggleCostSort,
} = useSortableRows(costRows, (row, key) => {
  if (key === 'service') return row.service.toLowerCase()
  if (key === 'amount') return row.amount
  return undefined
})

function inventoryList<T>(value: T[] | FetchError | undefined): T[] {
  if (!value || isFetchError(value)) return []
  return value
}

function inventoryError<T>(value: T[] | FetchError | undefined): string | null {
  return value && isFetchError(value) ? value.error : null
}

const ec2Rows = computed<Ec2InstanceSummary[]>(() =>
  inventoryList(inventory.value?.ec2InstancesRunning),
)
const rdsRows = computed<RdsInstanceSummary[]>(() => inventoryList(inventory.value?.rdsInstances))
const elastiCacheRows = computed<ElastiCacheClusterSummary[]>(() =>
  inventoryList(inventory.value?.elastiCacheClusters),
)

onMounted(async () => {
  await Promise.all([loadInventory(), loadCost()])
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Infra & AWS Cost</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Live EC2/RDS/ElastiCache inventory and Cost Explorer spend by service. Cached
          server-side — use Refresh for a live pull.
        </p>
      </div>
      <div class="flex items-end gap-2">
        <label class="flex flex-col gap-1 text-xs text-admin-subtext">
          Month (UTC)
          <input v-model="monthValue" type="month" class="admin-input w-auto" @change="loadCost()" />
        </label>
        <button
          type="button"
          class="admin-btn-secondary"
          :disabled="loadingInventory || loadingCost"
          @click="refreshAll"
        >
          {{ loadingInventory || loadingCost ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- Cost by service -->
    <section class="admin-card">
      <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-lg font-medium">Cost by service — {{ monthLabel }}</h2>
        <p v-if="costByService?.fetchedAt" class="text-xs text-admin-muted">
          Fetched {{ format(new Date(costByService.fetchedAt), 'dd MMM HH:mm:ss') }}
        </p>
      </div>

      <p v-if="costError" class="rounded-md bg-admin-danger/10 p-3 text-sm text-admin-danger">
        {{ costError }}
      </p>

      <template v-else>
        <div class="mb-4">
          <p class="text-xs text-admin-subtext">Total</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-admin-accent">
            {{ loadingCost ? '…' : costTotal != null ? formatUsd(costTotal) : '—' }}
          </p>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Service" sort-key="service" :active-key="costSortKey" :direction="costSortDir" @sort="toggleCostSort" />
                <SortableTh label="Amount" sort-key="amount" :active-key="costSortKey" :direction="costSortDir" @sort="toggleCostSort" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedCostRows" :key="row.service">
                <td>{{ row.service }}</td>
                <td class="tabular-nums text-sm">
                  {{ row.unit === costCurrency ? formatUsd(row.amount) : `${row.amount.toFixed(2)} ${row.unit}` }}
                </td>
              </tr>
              <tr v-if="loadingCost">
                <td colspan="2" class="py-10 text-center text-admin-muted">Loading…</td>
              </tr>
              <tr v-else-if="!sortedCostRows.length">
                <td colspan="2" class="py-10 text-center text-admin-muted">No spend recorded for this month</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <!-- EC2 -->
    <section class="admin-card">
      <h2 class="mb-4 text-lg font-medium">EC2 instances (running)</h2>
      <p v-if="inventoryError(inventory?.ec2InstancesRunning)" class="rounded-md bg-admin-danger/10 p-3 text-sm text-admin-danger">
        {{ inventoryError(inventory?.ec2InstancesRunning) }}
      </p>
      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Instance ID</th>
              <th>Type</th>
              <th>AZ</th>
              <th>Private IP</th>
              <th>Launched</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in ec2Rows" :key="i.instanceId ?? ''">
              <td class="font-medium">{{ i.name ?? '—' }}</td>
              <td class="font-mono text-xs">{{ i.instanceId ?? '—' }}</td>
              <td class="text-sm">{{ i.type ?? '—' }}</td>
              <td class="text-sm">{{ i.az ?? '—' }}</td>
              <td class="font-mono text-xs">{{ i.privateIp ?? '—' }}</td>
              <td class="whitespace-nowrap text-xs text-admin-muted">
                {{ i.launchTime ? format(new Date(i.launchTime), 'dd MMM yyyy HH:mm') : '—' }}
              </td>
            </tr>
            <tr v-if="loadingInventory">
              <td colspan="6" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!ec2Rows.length">
              <td colspan="6" class="py-10 text-center text-admin-muted">No running instances</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- RDS -->
    <section class="admin-card">
      <h2 class="mb-4 text-lg font-medium">RDS instances</h2>
      <p v-if="inventoryError(inventory?.rdsInstances)" class="rounded-md bg-admin-danger/10 p-3 text-sm text-admin-danger">
        {{ inventoryError(inventory?.rdsInstances) }}
      </p>
      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Identifier</th>
              <th>Class</th>
              <th>Engine</th>
              <th>Multi-AZ</th>
              <th>Storage</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in rdsRows" :key="d.id ?? ''">
              <td class="font-medium">{{ d.id ?? '—' }}</td>
              <td class="text-sm">{{ d.class ?? '—' }}</td>
              <td class="text-sm">{{ d.engine ?? '—' }}</td>
              <td class="text-sm">{{ d.multiAz ? 'Yes' : 'No' }}</td>
              <td class="tabular-nums text-sm">{{ d.storageGb != null ? `${formatNumber(d.storageGb)} GB` : '—' }}</td>
              <td class="text-sm">{{ d.status ?? '—' }}</td>
            </tr>
            <tr v-if="loadingInventory">
              <td colspan="6" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!rdsRows.length">
              <td colspan="6" class="py-10 text-center text-admin-muted">No RDS instances</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ElastiCache -->
    <section class="admin-card">
      <h2 class="mb-4 text-lg font-medium">ElastiCache clusters</h2>
      <p v-if="inventoryError(inventory?.elastiCacheClusters)" class="rounded-md bg-admin-danger/10 p-3 text-sm text-admin-danger">
        {{ inventoryError(inventory?.elastiCacheClusters) }}
      </p>
      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cluster ID</th>
              <th>Node type</th>
              <th>Engine</th>
              <th>Nodes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in elastiCacheRows" :key="c.id ?? ''">
              <td class="font-medium">{{ c.id ?? '—' }}</td>
              <td class="text-sm">{{ c.nodeType ?? '—' }}</td>
              <td class="text-sm">{{ c.engine ?? '—' }}</td>
              <td class="tabular-nums text-sm">{{ c.numNodes ?? '—' }}</td>
              <td class="text-sm">{{ c.status ?? '—' }}</td>
            </tr>
            <tr v-if="loadingInventory">
              <td colspan="5" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!elastiCacheRows.length">
              <td colspan="5" class="py-10 text-center text-admin-muted">No ElastiCache clusters</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
