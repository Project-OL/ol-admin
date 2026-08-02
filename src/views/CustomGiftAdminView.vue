<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { format, parseISO } from 'date-fns'
import { customGiftAdminApi } from '@/api/customGiftAdmin'
import { giftAdminApi } from '@/api/giftAdmin'
import type {
  CustomGiftConfig,
  CustomGiftRequestAdmin,
  CustomGiftRequestStatus,
} from '@/types/customGift'
import type { GiftAdminListItem } from '@/types/gift'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import { formatCoins, formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'

type StatusTab = 'ALL' | CustomGiftRequestStatus

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'FAILED', label: 'Failed' },
]

const config = ref<CustomGiftConfig | null>(null)
const loadingConfig = ref(false)
const savingConfig = ref(false)

const configForm = reactive({
  coinCost1Month: '',
  coinCost3Months: '',
  enabled: true,
  description: '',
})

const requests = ref<CustomGiftRequestAdmin[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const countsByStatus = ref<Record<string, number>>({ PENDING: 0, COMPLETED: 0, FAILED: 0 })
const loading = ref(false)
const acting = ref(false)

const statusTab = ref<StatusTab>('PENDING')
const userIdFilter = ref('')

const detail = ref<CustomGiftRequestAdmin | null>(null)
const completeOpen = ref(false)
const failOpen = ref(false)
const resolveTarget = ref<CustomGiftRequestAdmin | null>(null)

const completeForm = reactive({
  giftId: '',
  adminNote: '',
})

const failForm = reactive({
  reason: '',
  refund: true,
  adminNote: '',
})

const giftSearch = ref('')
const giftResults = ref<GiftAdminListItem[]>([])
const searchingGifts = ref(false)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

const pendingCount = computed(() => countsByStatus.value.PENDING ?? 0)

function formatDt(iso: string | null) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function formatCoinCost(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return `₵${value}`
  return formatCoins(n)
}

function statusBadgeProps(status: string) {
  const map: Record<string, { status: string; label: string }> = {
    PENDING: { status: 'pending', label: 'Pending' },
    COMPLETED: { status: 'verified', label: 'Completed' },
    FAILED: { status: 'failed', label: 'Failed' },
  }
  return map[status] ?? { status: 'none', label: status }
}

function tabCount(id: StatusTab) {
  if (id === 'ALL') {
    return Object.values(countsByStatus.value).reduce((a, b) => a + (b || 0), 0)
  }
  return countsByStatus.value[id] ?? 0
}

function packageCoinCost(durationMonths: number): string {
  return durationMonths === 1 ? configForm.coinCost1Month : configForm.coinCost3Months
}

function setPackageCoinCost(durationMonths: number, value: string) {
  if (durationMonths === 1) configForm.coinCost1Month = value
  else configForm.coinCost3Months = value
}

function onPackageCoinInput(durationMonths: number, event: Event) {
  setPackageCoinCost(durationMonths, (event.target as HTMLInputElement).value)
}

function applyConfigToForm(data: CustomGiftConfig) {
  config.value = data
  const pkg1 = data.packages?.find((p) => p.durationMonths === 1)
  const pkg3 = data.packages?.find((p) => p.durationMonths === 3)
  configForm.coinCost1Month = pkg1?.coinCost ?? data.coinCost1Month ?? data.coinCost ?? ''
  configForm.coinCost3Months = pkg3?.coinCost ?? data.coinCost3Months ?? ''
  configForm.enabled = data.enabled
  configForm.description = data.description ?? ''
}

function validateCoinCost(value: string, label: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return `${label} must be a positive whole number`
  }
  const n = Number(trimmed)
  if (n < 1 || n > 1_000_000_000) {
    return `${label} must be between 1 and 1,000,000,000`
  }
  return null
}

async function loadConfig() {
  loadingConfig.value = true
  try {
    const { data } = await customGiftAdminApi.getConfig()
    applyConfigToForm(data)
  } catch {
    showToast('Failed to load custom gift config', 'error')
  } finally {
    loadingConfig.value = false
  }
}

async function saveConfig() {
  const err1 = validateCoinCost(configForm.coinCost1Month, '1-month coin cost')
  if (err1) {
    showToast(err1, 'error')
    return
  }
  const err3 = validateCoinCost(configForm.coinCost3Months, '3-month coin cost')
  if (err3) {
    showToast(err3, 'error')
    return
  }

  savingConfig.value = true
  try {
    const { data } = await customGiftAdminApi.updateConfig({
      coinCost1Month: configForm.coinCost1Month.trim(),
      coinCost3Months: configForm.coinCost3Months.trim(),
      enabled: configForm.enabled,
      description: configForm.description.trim() || null,
    })
    applyConfigToForm(data)
    showToast('Config saved', 'success')
  } finally {
    savingConfig.value = false
  }
}

async function loadRequests(nextPage = 1) {
  loading.value = true
  page.value = nextPage
  try {
    const { data } = await customGiftAdminApi.listRequests({
      status: statusTab.value === 'ALL' ? undefined : statusTab.value,
      userId: userIdFilter.value.trim() || undefined,
      page: nextPage,
      limit,
    })
    requests.value = data.requests ?? []
    total.value = data.total ?? 0
    countsByStatus.value = data.countsByStatus ?? {
      PENDING: 0,
      COMPLETED: 0,
      FAILED: 0,
    }
  } catch {
    requests.value = []
    total.value = 0
    showToast('Failed to load requests', 'error')
  } finally {
    loading.value = false
  }
}

function setStatusTab(id: StatusTab) {
  statusTab.value = id
  loadRequests(1)
}

function applyFilters() {
  loadRequests(1)
}

async function openDetail(row: CustomGiftRequestAdmin) {
  try {
    const { data } = await customGiftAdminApi.getRequest(row.id)
    detail.value = data.request
  } catch {
    detail.value = row
  }
}

function openComplete(row: CustomGiftRequestAdmin) {
  resolveTarget.value = row
  completeForm.giftId = ''
  completeForm.adminNote = ''
  giftSearch.value = ''
  giftResults.value = []
  completeOpen.value = true
}

function openFail(row: CustomGiftRequestAdmin) {
  resolveTarget.value = row
  failForm.reason = ''
  failForm.refund = true
  failForm.adminNote = ''
  failOpen.value = true
}

function completeFromDetail() {
  if (!detail.value) return
  const row = detail.value
  detail.value = null
  openComplete(row)
}

function failFromDetail() {
  if (!detail.value) return
  const row = detail.value
  detail.value = null
  openFail(row)
}

async function searchGifts() {
  const q = giftSearch.value.trim()
  if (!q) {
    giftResults.value = []
    return
  }
  searchingGifts.value = true
  try {
    const { data } = await giftAdminApi.listGifts({ search: q, status: 'all', page: 1, limit: 10 })
    giftResults.value = data.items ?? []
  } catch {
    giftResults.value = []
  } finally {
    searchingGifts.value = false
  }
}

function pickGift(gift: GiftAdminListItem) {
  completeForm.giftId = gift.id
  giftSearch.value = `${gift.name} (${gift.code})`
  giftResults.value = []
}

async function submitComplete() {
  if (!resolveTarget.value) return
  acting.value = true
  try {
    const payload: { giftId?: string; adminNote?: string } = {}
    if (completeForm.giftId.trim()) payload.giftId = completeForm.giftId.trim()
    if (completeForm.adminNote.trim()) payload.adminNote = completeForm.adminNote.trim()
    await customGiftAdminApi.complete(resolveTarget.value.id, payload)
    showToast('Request marked completed', 'success')
    completeOpen.value = false
    resolveTarget.value = null
    if (detail.value) detail.value = null
    await loadRequests(page.value)
  } finally {
    acting.value = false
  }
}

async function submitFail() {
  if (!resolveTarget.value) return
  if (!failForm.reason.trim()) {
    showToast('Failure reason is required', 'error')
    return
  }
  acting.value = true
  try {
    await customGiftAdminApi.fail(resolveTarget.value.id, {
      reason: failForm.reason.trim(),
      refund: failForm.refund,
      adminNote: failForm.adminNote.trim() || undefined,
    })
    showToast(
      failForm.refund ? 'Request failed and coins refunded' : 'Request marked failed',
      'success',
    )
    failOpen.value = false
    resolveTarget.value = null
    if (detail.value) detail.value = null
    await loadRequests(page.value)
  } finally {
    acting.value = false
  }
}

watch(giftSearch, (q) => {
  if (!q.trim()) giftResults.value = []
})

onMounted(async () => {
  await Promise.all([loadConfig(), loadRequests()])
})
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Custom Gift Requests</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Configure pricing and fulfil paid custom gift requests (SUPER_ADMIN)
      </p>
    </div>

    <!-- Config -->
    <div class="admin-card">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-medium">Feature config</h2>
        <StatusBadge
          v-if="config"
          :status="config.enabled ? 'active' : 'inactive'"
          :label="config.enabled ? 'Enabled' : 'Disabled'"
        />
      </div>

      <div v-if="loadingConfig" class="text-sm text-admin-subtext">Loading config…</div>
      <div v-else class="space-y-4">
        <label class="flex items-center gap-2 text-sm">
          <input v-model="configForm.enabled" type="checkbox" class="rounded border-admin-border" />
          Feature enabled (when off, app hides entry and requests return 403)
        </label>

        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Description</label>
          <textarea
            v-model="configForm.description"
            rows="2"
            class="admin-input resize-none"
            maxlength="2000"
            placeholder="Shown to users on the request screen"
          />
        </div>

        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-admin-subtext">
            Duration packages
          </p>
          <p class="mb-3 text-xs text-admin-muted">
            Duration and validity days are fixed. Edit coin prices for each package type.
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="pkg in config?.packages ?? []"
              :key="pkg.durationMonths"
              class="rounded-md border border-admin-border p-3"
            >
              <div class="mb-2 flex items-baseline justify-between gap-2">
                <p class="text-sm font-medium">{{ pkg.label }}</p>
                <p class="text-xs text-admin-muted">{{ pkg.validityDays }} days validity</p>
              </div>
              <label class="mb-1 block text-xs text-admin-subtext">Coin cost</label>
              <input
                :value="packageCoinCost(pkg.durationMonths)"
                type="text"
                inputmode="numeric"
                class="admin-input tabular-nums"
                placeholder="100000"
                @input="onPackageCoinInput(pkg.durationMonths, $event)"
              />
            </div>
            <!-- Fallback when packages[] missing from older API -->
            <template v-if="!config?.packages?.length">
              <div class="rounded-md border border-admin-border p-3">
                <p class="mb-2 text-sm font-medium">1 month</p>
                <label class="mb-1 block text-xs text-admin-subtext">Coin cost</label>
                <input
                  v-model="configForm.coinCost1Month"
                  type="text"
                  inputmode="numeric"
                  class="admin-input tabular-nums"
                  placeholder="100000"
                />
              </div>
              <div class="rounded-md border border-admin-border p-3">
                <p class="mb-2 text-sm font-medium">3 months</p>
                <label class="mb-1 block text-xs text-admin-subtext">Coin cost</label>
                <input
                  v-model="configForm.coinCost3Months"
                  type="text"
                  inputmode="numeric"
                  class="admin-input tabular-nums"
                  placeholder="200000"
                />
              </div>
            </template>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            class="admin-btn-primary"
            :disabled="savingConfig"
            @click="saveConfig"
          >
            {{ savingConfig ? 'Saving…' : 'Save config' }}
          </button>
          <p v-if="config?.updatedAt" class="text-xs text-admin-muted">
            Last updated {{ formatDt(config.updatedAt) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Inbox -->
    <div class="admin-card">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-admin-border pb-4">
        <div class="flex flex-wrap gap-1 rounded-lg bg-admin-bg p-1">
          <button
            v-for="t in STATUS_TABS"
            :key="t.id"
            type="button"
            :class="[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              statusTab === t.id
                ? 'bg-admin-accent text-white'
                : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="setStatusTab(t.id)"
          >
            {{ t.label }}
            <span class="ml-1 tabular-nums opacity-80">({{ formatNumber(tabCount(t.id)) }})</span>
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <input
            v-model="userIdFilter"
            type="text"
            class="admin-input w-56"
            placeholder="Filter by user UUID…"
            @keydown.enter="applyFilters"
          />
          <button type="button" class="admin-btn-secondary" :disabled="loading" @click="applyFilters">
            Filter
          </button>
        </div>
      </div>

      <p v-if="pendingCount > 0" class="mb-3 text-sm text-admin-warn">
        {{ formatNumber(pendingCount) }} pending — contact users on WhatsApp, create the gift under
        Gifts, then complete here.
      </p>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>WhatsApp</th>
              <th>Note</th>
              <th>Cost</th>
              <th>Package</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="py-8 text-center text-admin-subtext">Loading…</td>
            </tr>
            <tr v-else-if="!requests.length">
              <td colspan="8" class="py-8 text-center text-admin-subtext">No requests found</td>
            </tr>
            <tr v-for="row in requests" :key="row.id">
              <td>
                <div class="flex items-center gap-2">
                  <img
                    v-if="row.user.avatarUrl"
                    :src="row.user.avatarUrl"
                    :alt="row.user.name"
                    class="h-8 w-8 rounded-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-admin-bg text-xs font-medium"
                  >
                    {{ row.user.name.slice(0, 1).toUpperCase() }}
                  </div>
                  <div>
                    <p class="font-medium">{{ row.user.name }}</p>
                    <p class="text-xs text-admin-muted">
                      @{{ row.user.username }} · {{ row.user.publicId }}
                    </p>
                  </div>
                </div>
              </td>
              <td>
                <a
                  :href="`https://wa.me/${row.whatsappNumber.replace(/\D/g, '')}`"
                  target="_blank"
                  rel="noopener"
                  class="text-admin-accent hover:underline"
                >
                  {{ row.whatsappNumber }}
                </a>
              </td>
              <td class="max-w-[220px]">
                <p class="truncate text-sm" :title="row.note ?? ''">{{ row.note || '—' }}</p>
              </td>
              <td class="tabular-nums">{{ formatCoinCost(row.coinCost) }}</td>
              <td class="text-sm text-admin-subtext">
                {{ row.validityDays != null ? `${row.validityDays} days` : '—' }}
              </td>
              <td>
                <div class="space-y-1">
                  <StatusBadge v-bind="statusBadgeProps(row.status)" />
                  <p v-if="row.status === 'FAILED' && row.refunded" class="text-xs text-admin-success">
                    Refunded
                  </p>
                </div>
              </td>
              <td class="text-sm text-admin-subtext">{{ formatDt(row.createdAt) }}</td>
              <td>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="admin-btn-secondary text-xs" @click="openDetail(row)">
                    View
                  </button>
                  <template v-if="row.status === 'PENDING'">
                    <button
                      type="button"
                      class="admin-btn-primary text-xs"
                      @click="openComplete(row)"
                    >
                      Complete
                    </button>
                    <button type="button" class="admin-btn-danger text-xs" @click="openFail(row)">
                      Fail
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination mt-4">
        <span>{{ formatNumber(total) }} total · page {{ page }} / {{ totalPages }}</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="page <= 1 || loading"
            @click="loadRequests(page - 1)"
          >
            Prev
          </button>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="page >= totalPages || loading"
            @click="loadRequests(page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Detail -->
    <BaseDialog
      :open="!!detail"
      title="Request detail"
      size="lg"
      @close="detail = null"
    >
      <template #body>
        <div v-if="detail" class="max-h-[70vh] space-y-4 overflow-y-auto text-sm">
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge v-bind="statusBadgeProps(detail.status)" />
            <span v-if="detail.refunded" class="text-xs text-admin-success">Coins refunded</span>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <p class="text-xs text-admin-subtext">User</p>
              <p class="font-medium">{{ detail.user.name }}</p>
              <p class="text-admin-muted">
                @{{ detail.user.username }} · publicId {{ detail.user.publicId }}
              </p>
              <p class="text-xs text-admin-muted">{{ detail.user.id }}</p>
            </div>
            <div>
              <p class="text-xs text-admin-subtext">WhatsApp</p>
              <a
                :href="`https://wa.me/${detail.whatsappNumber.replace(/\D/g, '')}`"
                target="_blank"
                rel="noopener"
                class="font-medium text-admin-accent hover:underline"
              >
                {{ detail.whatsappNumber }}
              </a>
            </div>
            <div>
              <p class="text-xs text-admin-subtext">Coin cost</p>
              <p class="font-medium tabular-nums">{{ formatCoinCost(detail.coinCost) }}</p>
            </div>
            <div v-if="detail.validityDays != null">
              <p class="text-xs text-admin-subtext">Package</p>
              <p>{{ detail.validityDays }} days validity</p>
            </div>
            <div>
              <p class="text-xs text-admin-subtext">Created</p>
              <p>{{ formatDt(detail.createdAt) }}</p>
            </div>
            <div v-if="detail.resolvedAt">
              <p class="text-xs text-admin-subtext">Resolved</p>
              <p>{{ formatDt(detail.resolvedAt) }}</p>
            </div>
            <div v-if="detail.user.country">
              <p class="text-xs text-admin-subtext">Country</p>
              <p>{{ detail.user.country }}</p>
            </div>
          </div>

          <div>
            <p class="text-xs text-admin-subtext">User note</p>
            <p class="mt-1 whitespace-pre-wrap rounded-md bg-admin-bg p-3">
              {{ detail.note || '—' }}
            </p>
          </div>

          <div v-if="detail.failureReason">
            <p class="text-xs text-admin-subtext">Failure reason</p>
            <p class="mt-1 whitespace-pre-wrap rounded-md bg-admin-danger/10 p-3 text-admin-danger">
              {{ detail.failureReason }}
            </p>
          </div>

          <div v-if="detail.adminNote">
            <p class="text-xs text-admin-subtext">Admin note</p>
            <p class="mt-1 whitespace-pre-wrap rounded-md bg-admin-bg p-3">{{ detail.adminNote }}</p>
          </div>

          <div v-if="detail.gift" class="flex items-center gap-3 rounded-md border border-admin-border p-3">
            <img
              :src="detail.gift.displayImageUrl"
              :alt="detail.gift.name"
              class="h-12 w-12 rounded object-cover"
            />
            <div>
              <p class="font-medium">{{ detail.gift.name }}</p>
              <p class="text-xs text-admin-muted">{{ detail.gift.code }}</p>
            </div>
          </div>

          <div v-if="detail.status === 'PENDING'" class="flex flex-wrap gap-2 pt-2">
            <button type="button" class="admin-btn-primary" @click="completeFromDetail">
              Complete
            </button>
            <button type="button" class="admin-btn-danger" @click="failFromDetail">Fail</button>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="detail = null">Close</button>
      </template>
    </BaseDialog>

    <!-- Complete -->
    <BaseDialog
      :open="completeOpen"
      title="Complete request"
      size="md"
      @close="completeOpen = false"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-admin-subtext">
            Create the custom gift under <strong>Gifts</strong> first, then link it here (optional).
          </p>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Search gift catalog</label>
            <div class="flex gap-2">
              <input
                v-model="giftSearch"
                type="text"
                class="admin-input flex-1"
                placeholder="Name or code…"
                @keydown.enter.prevent="searchGifts"
              />
              <button
                type="button"
                class="admin-btn-secondary"
                :disabled="searchingGifts"
                @click="searchGifts"
              >
                Search
              </button>
            </div>
            <ul
              v-if="giftResults.length"
              class="mt-2 max-h-40 overflow-y-auto rounded-md border border-admin-border"
            >
              <li
                v-for="g in giftResults"
                :key="g.id"
                class="flex cursor-pointer items-center gap-2 border-b border-admin-border px-3 py-2 last:border-0 hover:bg-admin-bg"
                @click="pickGift(g)"
              >
                <img :src="g.displayImageUrl" :alt="g.name" class="h-8 w-8 rounded object-cover" />
                <div>
                  <p class="text-sm font-medium">{{ g.name }}</p>
                  <p class="text-xs text-admin-muted">{{ g.code }}</p>
                </div>
              </li>
            </ul>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Gift ID (optional)</label>
            <input v-model="completeForm.giftId" type="text" class="admin-input font-mono text-sm" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Admin note (optional)</label>
            <textarea
              v-model="completeForm.adminNote"
              rows="2"
              class="admin-input resize-none"
              maxlength="2000"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="completeOpen = false">Cancel</button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting"
          @click="submitComplete"
        >
          {{ acting ? 'Saving…' : 'Mark completed' }}
        </button>
      </template>
    </BaseDialog>

    <!-- Fail -->
    <BaseDialog :open="failOpen" title="Fail request" size="md" @close="failOpen = false">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">
              Reason <span class="text-admin-danger">*</span>
            </label>
            <textarea
              v-model="failForm.reason"
              rows="3"
              class="admin-input resize-none"
              maxlength="2000"
              placeholder="Shown to the user…"
            />
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="failForm.refund" type="checkbox" class="rounded border-admin-border" />
            Refund coin cost to the user
          </label>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Admin note (optional)</label>
            <textarea
              v-model="failForm.adminNote"
              rows="2"
              class="admin-input resize-none"
              maxlength="2000"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="failOpen = false">Cancel</button>
        <button type="button" class="admin-btn-danger" :disabled="acting" @click="submitFail">
          {{ acting ? 'Saving…' : 'Mark failed' }}
        </button>
      </template>
    </BaseDialog>
  </div>
</template>
