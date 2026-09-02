<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { format } from 'date-fns'
import { otpAuditApi } from '@/api/otpAudit'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'
import type {
  OtpCostRates,
  OtpCostsByCountry,
  OtpCountryRate,
  OtpCountryRateMeans,
  OtpDeliveryAuditItem,
  OtpDeliveryAuditSummary,
  OtpMonthlyCosts,
  OtpPurpose,
} from '@/types/otpAudit'
import { formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'

const FLOW_LABELS: Record<string, string> = {
  signup: 'Signup',
  login: 'Login (deprecated)',
  reset_password: 'Reset password',
  set_security_password: 'Security password',
  bind_email: 'Bind email',
  bind_phone: 'Bind phone',
  modify_email: 'Modify email',
  modify_phone: 'Modify phone',
}

const PURPOSE_OPTIONS: { value: OtpPurpose | ''; label: string }[] = [
  { value: '', label: 'All flows' },
  { value: 'signup', label: 'Signup' },
  { value: 'login', label: 'Login (deprecated)' },
  { value: 'reset_password', label: 'Reset password' },
  { value: 'set_security_password', label: 'Security password' },
  { value: 'bind_email', label: 'Bind email' },
  { value: 'bind_phone', label: 'Bind phone' },
  { value: 'modify_email', label: 'Modify email' },
  { value: 'modify_phone', label: 'Modify phone' },
]

const MEANS_OPTIONS = [
  { value: '', label: 'All means' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'none', label: 'None' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
]

const route = useRoute()

function currentUtcMonthValue() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const monthValue = ref(currentUtcMonthValue())

const monthParams = computed(() => {
  const [y, m] = monthValue.value.split('-').map(Number)
  if (!y || !m) return {}
  return { year: y, month: m }
})

const monthlyCosts = ref<OtpMonthlyCosts | null>(null)
const costsByCountry = ref<OtpCostsByCountry | null>(null)
const costRates = ref<OtpCostRates | null>(null)
const summary = ref<OtpDeliveryAuditSummary | null>(null)
const audits = ref<OtpDeliveryAuditItem[]>([])
const auditsTotal = ref(0)
const auditsPage = ref(1)
const auditsLimit = 20

const loadingCosts = ref(false)
const loadingAudits = ref(false)

const filters = reactive({
  purpose: '',
  means: '',
  status: '',
  country: '',
  userId: '',
  from: '',
  to: '',
})

function formatCharge(minor: number, currency: string) {
  if (currency === 'INR') return `₹${(minor / 100).toFixed(2)}`
  return `${minor} ${currency} (minor)`
}

function flowLabel(flow: string) {
  return FLOW_LABELS[flow] ?? flow
}

function flowNote(item: OtpDeliveryAuditItem): string | null {
  if (item.fallbackFrom) return `Fallback from ${item.fallbackFrom}`
  if (item.routeReason === 'fallback_to_sms') return 'Then tried SMS'
  if (item.routeReason === 'sms_request_threshold') return 'SMS after WhatsApp window'
  return null
}

function meansLabel(means: string) {
  if (means === 'whatsapp') return 'WhatsApp'
  if (means === 'none') return '—'
  return means.charAt(0).toUpperCase() + means.slice(1)
}

function statusBadgeProps(status: string) {
  if (status === 'skipped') return { status: 'warn', label: 'Skipped' }
  if (status === 'success' || status === 'failed') return { status, label: undefined }
  return { status: 'none', label: status }
}

function auditFilterParams() {
  return {
    purpose: filters.purpose || undefined,
    means: filters.means || undefined,
    status: filters.status || undefined,
    country: filters.country.trim() || undefined,
    userId: filters.userId.trim() || undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
  }
}

async function loadCosts() {
  loadingCosts.value = true
  try {
    const params = monthParams.value
    const [monthlyRes, countryRes, ratesRes] = await Promise.all([
      otpAuditApi.getMonthlyCosts(params),
      otpAuditApi.getCostsByCountry(params),
      otpAuditApi.getCostRates(),
    ])
    monthlyCosts.value = monthlyRes.data
    costsByCountry.value = countryRes.data
    costRates.value = ratesRes.data
  } catch {
    monthlyCosts.value = null
    costsByCountry.value = null
    showToast('Failed to load OTP cost data', 'error')
  } finally {
    loadingCosts.value = false
  }
}

const rateForm = reactive({
  means: 'whatsapp' as OtpCountryRateMeans,
  country: '',
  rateMinor: '',
})
const savingRate = ref(false)
const rateCardFilter = ref('')

async function saveCountryRate() {
  const country = rateForm.country.trim().toUpperCase()
  const rateMinor = Number(rateForm.rateMinor)
  if (!/^[A-Z]{2}$/.test(country)) {
    showToast('Country must be a 2-letter ISO code (e.g. IN, US)', 'error')
    return
  }
  if (!Number.isFinite(rateMinor) || rateMinor < 0) {
    showToast('Rate must be a non-negative number (minor units)', 'error')
    return
  }
  savingRate.value = true
  try {
    await otpAuditApi.setCountryRate({ means: rateForm.means, country, rateMinor })
    showToast(`Saved ${meansLabel(rateForm.means)} rate for ${country}`, 'success')
    rateForm.country = ''
    rateForm.rateMinor = ''
    await loadCosts()
  } catch {
    showToast('Failed to save country rate', 'error')
  } finally {
    savingRate.value = false
  }
}

const pendingRemoveRate = ref<OtpCountryRate | null>(null)

async function confirmRemoveCountryRate() {
  const rate = pendingRemoveRate.value
  if (!rate) return
  try {
    await otpAuditApi.deleteCountryRate(rate.means, rate.country)
    showToast(`Removed ${meansLabel(rate.means)} override for ${rate.country}`, 'success')
    await loadCosts()
  } catch {
    showToast('Failed to remove country rate', 'error')
  } finally {
    pendingRemoveRate.value = null
  }
}

function editCountryRate(rate: OtpCountryRate) {
  rateForm.means = rate.means
  rateForm.country = rate.country
  rateForm.rateMinor = String(rate.rateMinor)
}

async function loadAudits(page = 1) {
  loadingAudits.value = true
  auditsPage.value = page
  try {
    const params = {
      ...auditFilterParams(),
      page,
      limit: auditsLimit,
    }
    const [listRes, summaryRes] = await Promise.all([
      otpAuditApi.listAudits(params),
      otpAuditApi.summarizeAudits(auditFilterParams()),
    ])
    audits.value = listRes.data.items ?? []
    auditsTotal.value = listRes.data.total ?? 0
    summary.value = summaryRes.data
  } catch {
    audits.value = []
    auditsTotal.value = 0
    summary.value = null
    showToast('Failed to load OTP audit logs', 'error')
  } finally {
    loadingAudits.value = false
  }
}

function applyAuditFilters() {
  loadAudits(1)
}

function resetAuditFilters() {
  filters.purpose = ''
  filters.means = ''
  filters.status = ''
  filters.country = ''
  filters.userId = typeof route.query.userId === 'string' ? route.query.userId : ''
  filters.from = ''
  filters.to = ''
  loadAudits(1)
}

function prevAuditsPage() {
  if (auditsPage.value > 1) loadAudits(auditsPage.value - 1)
}

function nextAuditsPage() {
  if (auditsPage.value * auditsLimit < auditsTotal.value) {
    loadAudits(auditsPage.value + 1)
  }
}

const currency = computed(
  () => monthlyCosts.value?.currency ?? summary.value?.currency ?? costRates.value?.currency ?? 'INR',
)

const monthLabel = computed(() => {
  const { year, month } = monthParams.value
  if (!year || !month) return 'This month (UTC)'
  const d = new Date(Date.UTC(year, month - 1, 1))
  return format(d, 'MMMM yyyy') + ' (UTC)'
})

const ratesFootnote = computed(() => {
  if (!costRates.value) return ''
  const { rates, currency: cur, note } = costRates.value
  const parts = (['email', 'whatsapp', 'sms'] as const).map(
    (m) => `${meansLabel(m)} = ${formatCharge(rates[m] ?? 0, cur)}`,
  )
  return note ? `${parts.join(' · ')}. ${note}` : parts.join(' · ')
})

const countryRateOverrides = computed(() => {
  const filter = rateCardFilter.value.trim().toUpperCase()
  const all = costRates.value?.countryRates ?? []
  if (!filter) return all
  return all.filter((r) => r.country.includes(filter) || r.means.toUpperCase().includes(filter))
})
const {
  sortKey: rateCardSortKey,
  sortDir: rateCardSortDir,
  sortedRows: sortedRateCard,
  toggleSort: toggleRateCardSort,
} = useSortableRows(countryRateOverrides, (row, key) => {
  switch (key) {
    case 'means':
      return row.means
    case 'country':
      return row.country
    case 'rateMinor':
      return row.rateMinor
    case 'updatedAt':
      return row.updatedAt ? new Date(row.updatedAt).getTime() : 0
    default:
      return undefined
  }
})

const countryRows = computed(() => costsByCountry.value?.countries ?? [])
const {
  sortKey: countryRowsSortKey,
  sortDir: countryRowsSortDir,
  sortedRows: sortedCountryRows,
  toggleSort: toggleCountryRowsSort,
} = useSortableRows(countryRows, (row, key) => {
  switch (key) {
    case 'country':
      return row.country?.toLowerCase() ?? ''
    case 'email':
      return row.email.chargeMinor ?? 0
    case 'whatsapp':
      return row.whatsapp.chargeMinor ?? 0
    case 'sms':
      return row.sms.chargeMinor ?? 0
    case 'totalChargeMinor':
      return row.totalChargeMinor ?? 0
    case 'totalCount':
      return row.totalCount ?? 0
    default:
      return undefined
  }
})

const {
  sortKey: auditsSortKey,
  sortDir: auditsSortDir,
  sortedRows: sortedAudits,
  toggleSort: toggleAuditsSort,
} = useSortableRows(audits, (item, key) => {
  switch (key) {
    case 'createdAt':
      return item.createdAt ? new Date(item.createdAt).getTime() : 0
    case 'flow':
      return flowLabel(item.flow || item.purpose).toLowerCase()
    case 'means':
      return item.means ?? ''
    case 'country':
      return (item.country || '').toLowerCase()
    case 'status':
      return item.status ?? ''
    case 'targetMasked':
      return (item.targetMasked || '').toLowerCase()
    case 'chargeMinor':
      return item.chargeMinor ?? 0
    case 'providerMessageId':
      return (item.providerMessageId || '').toLowerCase()
    default:
      return undefined
  }
})

watch(monthValue, () => {
  loadCosts()
})

onMounted(async () => {
  if (typeof route.query.userId === 'string') {
    filters.userId = route.query.userId
  }
  await Promise.all([loadCosts(), loadAudits(1)])
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">OTP Audit Logs</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Delivery costs and audit trail for email, WhatsApp, and SMS OTPs
        </p>
      </div>
      <label class="flex flex-col gap-1 text-xs text-admin-subtext">
        Month (UTC)
        <input v-model="monthValue" type="month" class="admin-input w-auto" />
      </label>
    </div>

    <!-- Monthly costs -->
    <section class="space-y-3">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-lg font-medium">Monthly costs — {{ monthLabel }}</h2>
        <p v-if="ratesFootnote" class="text-xs text-admin-muted">{{ ratesFootnote }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">Email</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{
              loadingCosts
                ? '…'
                : formatCharge(monthlyCosts?.byMeans.email.chargeMinor ?? 0, currency)
            }}
          </p>
          <p class="text-xs text-admin-muted">
            {{ formatNumber(monthlyCosts?.byMeans.email.count ?? 0) }} sends
          </p>
        </div>
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">WhatsApp</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{
              loadingCosts
                ? '…'
                : formatCharge(monthlyCosts?.byMeans.whatsapp.chargeMinor ?? 0, currency)
            }}
          </p>
          <p class="text-xs text-admin-muted">
            {{ formatNumber(monthlyCosts?.byMeans.whatsapp.count ?? 0) }} sends
          </p>
        </div>
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">SMS</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{
              loadingCosts
                ? '…'
                : formatCharge(monthlyCosts?.byMeans.sms.chargeMinor ?? 0, currency)
            }}
          </p>
          <p class="text-xs text-admin-muted">
            {{ formatNumber(monthlyCosts?.byMeans.sms.count ?? 0) }} sends
          </p>
        </div>
        <div class="admin-card !p-3">
          <p class="text-xs text-admin-subtext">Total cost</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-admin-accent">
            {{
              loadingCosts ? '…' : formatCharge(monthlyCosts?.totalChargeMinor ?? 0, currency)
            }}
          </p>
          <p class="text-xs text-admin-muted">
            {{ formatNumber(monthlyCosts?.totalCount ?? 0) }} successful sends
          </p>
        </div>
      </div>
    </section>

    <!-- Cost by country -->
    <section class="admin-card">
      <h2 class="mb-4 text-lg font-medium">Cost by country — {{ monthLabel }}</h2>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <SortableTh label="Country" sort-key="country" :active-key="countryRowsSortKey" :direction="countryRowsSortDir" @sort="toggleCountryRowsSort" />
              <SortableTh label="Email" sort-key="email" :active-key="countryRowsSortKey" :direction="countryRowsSortDir" @sort="toggleCountryRowsSort" />
              <SortableTh label="WhatsApp" sort-key="whatsapp" :active-key="countryRowsSortKey" :direction="countryRowsSortDir" @sort="toggleCountryRowsSort" />
              <SortableTh label="SMS" sort-key="sms" :active-key="countryRowsSortKey" :direction="countryRowsSortDir" @sort="toggleCountryRowsSort" />
              <SortableTh label="Total" sort-key="totalChargeMinor" :active-key="countryRowsSortKey" :direction="countryRowsSortDir" @sort="toggleCountryRowsSort" />
              <SortableTh label="Sends" sort-key="totalCount" :active-key="countryRowsSortKey" :direction="countryRowsSortDir" @sort="toggleCountryRowsSort" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedCountryRows" :key="row.country">
              <td class="font-medium">{{ row.country }}</td>
              <td class="tabular-nums text-sm">
                {{ formatCharge(row.email.chargeMinor, currency) }}
                <span class="text-xs text-admin-muted">({{ row.email.count }})</span>
              </td>
              <td class="tabular-nums text-sm">
                {{ formatCharge(row.whatsapp.chargeMinor, currency) }}
                <span class="text-xs text-admin-muted">({{ row.whatsapp.count }})</span>
                <p class="text-[10px] text-admin-muted">
                  now: {{ formatCharge(row.currentRates.whatsapp, currency) }}/msg
                </p>
              </td>
              <td class="tabular-nums text-sm">
                {{ formatCharge(row.sms.chargeMinor, currency) }}
                <span class="text-xs text-admin-muted">({{ row.sms.count }})</span>
                <p class="text-[10px] text-admin-muted">
                  now: {{ formatCharge(row.currentRates.sms, currency) }}/msg
                </p>
              </td>
              <td class="tabular-nums text-sm font-medium">
                {{ formatCharge(row.totalChargeMinor, currency) }}
              </td>
              <td class="tabular-nums">{{ formatNumber(row.totalCount) }}</td>
            </tr>
            <tr v-if="loadingCosts">
              <td colspan="6" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!(costsByCountry?.countries?.length)">
              <td colspan="6" class="py-10 text-center text-admin-muted">
                No successful OTP deliveries for this month
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Country rate card -->
    <section class="admin-card">
      <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 class="text-lg font-medium">WhatsApp / SMS rate card</h2>
          <p class="mt-1 text-xs text-admin-subtext">
            Per-country override. A country with no row here uses the flat default shown above
            (WhatsApp {{ formatCharge(costRates?.rates.whatsapp ?? 0, currency) }}, SMS
            {{ formatCharge(costRates?.rates.sms ?? 0, currency) }}). Applies to new sends only —
            past audit charges never change.
          </p>
        </div>
        <input
          v-model="rateCardFilter"
          type="text"
          class="admin-input w-40"
          placeholder="Filter country/means"
        />
      </div>

      <div class="mb-4 flex flex-wrap items-end gap-2">
        <label class="flex flex-col gap-1 text-xs text-admin-subtext">
          Means
          <select v-model="rateForm.means" class="admin-input w-auto">
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-admin-subtext">
          Country (ISO-2)
          <input
            v-model="rateForm.country"
            type="text"
            class="admin-input w-24 uppercase"
            placeholder="IN"
            maxlength="2"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-admin-subtext">
          Rate (minor units)
          <input
            v-model="rateForm.rateMinor"
            type="number"
            min="0"
            step="1"
            class="admin-input w-32"
            placeholder="e.g. 12"
          />
        </label>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="savingRate"
          @click="saveCountryRate"
        >
          {{ savingRate ? 'Saving…' : 'Save rate' }}
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <SortableTh label="Means" sort-key="means" :active-key="rateCardSortKey" :direction="rateCardSortDir" @sort="toggleRateCardSort" />
              <SortableTh label="Country" sort-key="country" :active-key="rateCardSortKey" :direction="rateCardSortDir" @sort="toggleRateCardSort" />
              <SortableTh label="Rate" sort-key="rateMinor" :active-key="rateCardSortKey" :direction="rateCardSortDir" @sort="toggleRateCardSort" />
              <SortableTh label="Updated" sort-key="updatedAt" :active-key="rateCardSortKey" :direction="rateCardSortDir" @sort="toggleRateCardSort" />
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rate in sortedRateCard" :key="`${rate.means}:${rate.country}`">
              <td class="text-sm">{{ meansLabel(rate.means) }}</td>
              <td class="font-medium">{{ rate.country }}</td>
              <td class="tabular-nums text-sm">{{ formatCharge(rate.rateMinor, rate.currency) }}</td>
              <td class="whitespace-nowrap text-xs text-admin-muted">
                {{ format(new Date(rate.updatedAt), 'dd MMM yyyy HH:mm') }}
              </td>
              <td class="whitespace-nowrap text-right">
                <button
                  type="button"
                  class="admin-btn-secondary text-xs"
                  @click="editCountryRate(rate)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="admin-btn-secondary text-xs text-admin-danger"
                  @click="pendingRemoveRate = rate"
                >
                  Remove
                </button>
              </td>
            </tr>
            <tr v-if="loadingCosts">
              <td colspan="5" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!sortedRateCard.length">
              <td colspan="5" class="py-10 text-center text-admin-muted">
                No country overrides configured — every country uses the flat default
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Audit log -->
    <section class="admin-card">
      <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-lg font-medium">Delivery audit log</h2>
        <div v-if="summary" class="flex flex-wrap gap-2 text-xs">
          <span class="rounded-md bg-admin-bg px-2.5 py-1 text-admin-subtext">
            {{ formatNumber(summary.totalCount) }} sends
          </span>
          <span class="rounded-md bg-admin-accent/15 px-2.5 py-1 font-medium text-admin-accent">
            {{ formatCharge(summary.totalChargeMinor, summary.currency || currency) }}
          </span>
          <span
            v-for="m in summary.byMeans"
            :key="m.means"
            class="rounded-md bg-admin-bg px-2.5 py-1 text-admin-subtext"
          >
            {{ meansLabel(m.means) }}: {{ formatNumber(m.count) }} /
            {{ formatCharge(m.chargeMinor, summary.currency || currency) }}
          </span>
        </div>
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        <select v-model="filters.purpose" class="admin-input w-auto">
          <option v-for="opt in PURPOSE_OPTIONS" :key="opt.value || 'all'" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="filters.means" class="admin-input w-auto">
          <option v-for="opt in MEANS_OPTIONS" :key="opt.value || 'all'" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="filters.status" class="admin-input w-auto">
          <option v-for="opt in STATUS_OPTIONS" :key="opt.value || 'all'" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <input
          v-model="filters.country"
          type="text"
          class="admin-input w-24"
          placeholder="Country"
          maxlength="8"
        />
        <input
          v-model="filters.userId"
          type="text"
          class="admin-input min-w-0 w-full flex-1 sm:min-w-[200px]"
          placeholder="User UUID"
        />
        <input v-model="filters.from" type="date" class="admin-input w-auto" title="From" />
        <input v-model="filters.to" type="date" class="admin-input w-auto" title="To" />
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="loadingAudits"
          @click="applyAuditFilters"
        >
          {{ loadingAudits ? 'Loading…' : 'Search' }}
        </button>
        <button type="button" class="admin-btn-secondary" :disabled="loadingAudits" @click="resetAuditFilters">
          Reset
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <SortableTh label="Time" sort-key="createdAt" :active-key="auditsSortKey" :direction="auditsSortDir" @sort="toggleAuditsSort" />
              <SortableTh label="Flow" sort-key="flow" :active-key="auditsSortKey" :direction="auditsSortDir" @sort="toggleAuditsSort" />
              <SortableTh label="Means" sort-key="means" :active-key="auditsSortKey" :direction="auditsSortDir" @sort="toggleAuditsSort" />
              <SortableTh label="Country" sort-key="country" :active-key="auditsSortKey" :direction="auditsSortDir" @sort="toggleAuditsSort" />
              <SortableTh label="Status" sort-key="status" :active-key="auditsSortKey" :direction="auditsSortDir" @sort="toggleAuditsSort" />
              <SortableTh label="Target" sort-key="targetMasked" :active-key="auditsSortKey" :direction="auditsSortDir" @sort="toggleAuditsSort" />
              <SortableTh label="Charge" sort-key="chargeMinor" :active-key="auditsSortKey" :direction="auditsSortDir" @sort="toggleAuditsSort" />
              <SortableTh label="Message ID" sort-key="providerMessageId" :active-key="auditsSortKey" :direction="auditsSortDir" @sort="toggleAuditsSort" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in sortedAudits" :key="item.id">
              <td class="whitespace-nowrap text-xs">
                {{ format(new Date(item.createdAt), 'dd MMM yyyy HH:mm') }}
              </td>
              <td>
                <p class="text-sm font-medium">{{ flowLabel(item.flow || item.purpose) }}</p>
                <p v-if="flowNote(item)" class="text-xs text-admin-muted">
                  {{ flowNote(item) }}
                </p>
              </td>
              <td class="text-sm">{{ meansLabel(item.means) }}</td>
              <td>{{ item.country ?? '—' }}</td>
              <td>
                <StatusBadge
                  :status="statusBadgeProps(item.status).status"
                  :label="statusBadgeProps(item.status).label"
                />
              </td>
              <td>
                <p class="font-mono text-sm">{{ item.targetMasked || '—' }}</p>
                <p v-if="item.error" class="max-w-[220px] truncate text-xs text-admin-danger" :title="item.error">
                  {{ item.error }}
                </p>
              </td>
              <td class="tabular-nums text-sm">
                {{ formatCharge(item.chargeMinor, item.chargeCurrency || currency) }}
              </td>
              <td class="max-w-[140px] truncate font-mono text-xs text-admin-muted" :title="item.providerMessageId ?? ''">
                {{ item.providerMessageId || '—' }}
              </td>
            </tr>
            <tr v-if="loadingAudits && !audits.length">
              <td colspan="8" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!audits.length">
              <td colspan="8" class="py-10 text-center text-admin-muted">No audit logs found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination mt-4">
        <span>{{ formatNumber(auditsTotal) }} total</span>
        <div class="flex items-center gap-2">
          <span class="text-xs">Page {{ auditsPage }}</span>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="auditsPage <= 1 || loadingAudits"
            @click="prevAuditsPage"
          >
            Previous
          </button>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="auditsPage * auditsLimit >= auditsTotal || loadingAudits"
            @click="nextAuditsPage"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <ConfirmActionDialog
      :open="!!pendingRemoveRate"
      title="Remove country rate override"
      :message="
        pendingRemoveRate
          ? `Removes the ${meansLabel(pendingRemoveRate.means)} override for ${pendingRemoveRate.country}. New sends to that country will fall back to the flat default rate.`
          : ''
      "
      confirm-label="Remove"
      variant="danger"
      @close="pendingRemoveRate = null"
      @confirm="confirmRemoveCountryRate"
    />
  </div>
</template>
