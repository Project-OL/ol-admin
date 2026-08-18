<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import axios from 'axios'
import { accountDeletionApi } from '@/api/accountDeletion'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import InlineEditField from '@/components/shared/InlineEditField.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import type {
  AccountDeletionConfig,
  AccountDeletionRequest,
  AccountDeletionSearchType,
  AccountDeletionStatus,
} from '@/types/accountDeletion'
import { formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'

const STATUS_TABS: { value: AccountDeletionStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'all', label: 'All' },
]

const QTYPE_OPTIONS: { value: AccountDeletionSearchType; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'displayId', label: 'Display ID' },
  { value: 'publicId', label: 'Public ID' },
  { value: 'userId', label: 'User UUID' },
]

const route = useRoute()
const router = useRouter()

const items = ref<AccountDeletionRequest[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const loading = ref(false)
const loadingConfig = ref(false)
const savingConfig = ref(false)
const acting = ref(false)

const statusTab = ref<AccountDeletionStatus>('open')
const filters = reactive({
  q: '',
  qType: 'auto' as AccountDeletionSearchType,
})

const configSaved = ref<AccountDeletionConfig | null>(null)
const configForm = reactive({
  gracePeriodDays: 30,
  deletionPeriodDays: 45,
})
const configError = ref('')

const selected = ref<AccountDeletionRequest | null>(null)
const cancelOpen = ref(false)

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function relativeTo(iso: string | null | undefined) {
  if (!iso) return ''
  try {
    const d = parseISO(iso)
    const prefix = d.getTime() >= Date.now() ? 'in ' : ''
    const suffix = d.getTime() < Date.now() ? ' ago' : ''
    return `${prefix}${formatDistanceToNowStrict(d)}${suffix}`
  } catch {
    return ''
  }
}

function axiosMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  const body = err.response?.data as { message?: string; code?: string } | undefined
  if (body?.code === 'INVALID_DELETION_PERIOD') {
    return 'Permanent-delete days must be greater than or equal to the grace period.'
  }
  if (body?.code === 'ACCOUNT_DELETION_NOT_FOUND') return 'Request not found'
  if (body?.code === 'ACCOUNT_ALREADY_DELETED') return 'Account already deleted'
  if (body?.code === 'DELETION_ALREADY_CANCELLED') return 'Deletion already cancelled'
  return body?.message || fallback
}

function applyConfig(cfg: AccountDeletionConfig) {
  configSaved.value = cfg
  configForm.gracePeriodDays = cfg.gracePeriodDays
  configForm.deletionPeriodDays = cfg.deletionPeriodDays
}

async function loadConfig() {
  loadingConfig.value = true
  configError.value = ''
  try {
    const { data } = await accountDeletionApi.getConfig()
    applyConfig(data)
  } catch (err) {
    configError.value = axiosMessage(err, 'Failed to load deletion windows')
  } finally {
    loadingConfig.value = false
  }
}

function validateConfig(): string | null {
  const grace = Number(configForm.gracePeriodDays)
  const del = Number(configForm.deletionPeriodDays)
  if (!Number.isInteger(grace) || grace < 1 || grace > 365) {
    return 'Grace period must be a whole number of days between 1 and 365.'
  }
  if (!Number.isInteger(del) || del < 1 || del > 365) {
    return 'Deletion period must be a whole number of days between 1 and 365.'
  }
  if (del < grace) {
    return 'Permanent-delete days must be greater than or equal to the grace period.'
  }
  return null
}

async function saveConfig() {
  if (savingConfig.value) return
  const validationError = validateConfig()
  if (validationError) {
    configError.value = validationError
    return
  }
  savingConfig.value = true
  configError.value = ''
  try {
    const { data } = await accountDeletionApi.updateConfig({
      gracePeriodDays: Number(configForm.gracePeriodDays),
      deletionPeriodDays: Number(configForm.deletionPeriodDays),
    })
    applyConfig(data)
    showToast('Deletion windows saved. Applies to new requests only.', 'success')
  } catch (err) {
    configError.value = axiosMessage(err, 'Failed to save deletion windows')
  } finally {
    savingConfig.value = false
  }
}

function listParams(p = page.value) {
  return {
    page: p,
    limit,
    status: statusTab.value,
    q: filters.q.trim() || undefined,
    qType: filters.q.trim() ? filters.qType : undefined,
  }
}

async function loadRequests(p = 1) {
  loading.value = true
  page.value = p
  try {
    const { data } = await accountDeletionApi.list(listParams(p))
    items.value = data.items ?? []
    total.value = data.total ?? 0
  } catch {
    items.value = []
    total.value = 0
    showToast('Failed to load deletion requests', 'error')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  router.replace({
    query: {
      ...route.query,
      status: statusTab.value,
      q: filters.q.trim() || undefined,
      qType: filters.q.trim() ? filters.qType : undefined,
    },
  })
  loadRequests(1)
}

function resetFilters() {
  filters.q = ''
  filters.qType = 'auto'
  applyFilters()
}

function setStatusTab(status: AccountDeletionStatus) {
  statusTab.value = status
  selected.value = null
  router.replace({ query: { ...route.query, status } })
  loadRequests(1)
}

async function openDetail(row: AccountDeletionRequest) {
  selected.value = row
  try {
    const { data } = await accountDeletionApi.getById(row.id)
    selected.value = data
  } catch {
    /* keep list row */
  }
}

function closeDetail() {
  selected.value = null
}

function openCancel() {
  if (!selected.value || selected.value.status !== 'open') return
  cancelOpen.value = true
}

async function confirmCancel() {
  if (!selected.value || acting.value) return
  acting.value = true
  try {
    const { data } = await accountDeletionApi.cancel(selected.value.id)
    showToast(data.message || 'Account deletion cancelled', 'success')
    cancelOpen.value = false
    if (data.request) selected.value = data.request
    await loadRequests(page.value)
    if (statusTab.value === 'open') selected.value = null
  } catch (err) {
    showToast(axiosMessage(err, 'Failed to cancel deletion'), 'error')
  } finally {
    acting.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && selected.value && !cancelOpen.value) closeDetail()
}

watch(
  () => selected.value,
  (row) => {
    document.body.style.overflow = row ? 'hidden' : ''
  },
)

onMounted(async () => {
  document.addEventListener('keydown', onKeydown)

  if (
    route.query.status === 'cancelled' ||
    route.query.status === 'deleted' ||
    route.query.status === 'all' ||
    route.query.status === 'open'
  ) {
    statusTab.value = route.query.status
  }
  if (typeof route.query.q === 'string') filters.q = route.query.q
  if (
    route.query.qType === 'userId' ||
    route.query.qType === 'publicId' ||
    route.query.qType === 'displayId' ||
    route.query.qType === 'auto'
  ) {
    filters.qType = route.query.qType
  }

  await Promise.all([loadConfig(), loadRequests(1)])
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

const remainingLabel = computed(() => {
  if (!selected.value) return ''
  return relativeTo(selected.value.deletionAt)
})

const cancelMessage = computed(() => {
  const name = selected.value?.user.name || selected.value?.user.username || 'this user'
  return `Restore ${name} to active? This overrides the user grace window. The 30-minute reminder will not send.`
})
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Account Deletion</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Set how long scheduled deletions wait, then review open requests. Users get an email and/or
        WhatsApp (SMS fallback) 30 minutes before the stored deletion time.
      </p>
    </div>

    <section class="admin-card max-w-3xl space-y-3">
      <div>
        <h2 class="text-sm font-semibold text-admin-text">Deletion windows</h2>
        <p class="mt-0.5 text-xs text-admin-subtext">
          Grace period is how long the user can cancel. Permanent delete is when the account is
          removed. Saving these values applies to <strong>new</strong> schedule requests only —
          existing rows keep their original dates.
        </p>
      </div>

      <form class="grid grid-cols-1 gap-3 sm:grid-cols-2" @submit.prevent="saveConfig">
        <div>
          <label class="mb-0.5 block text-[11px] text-admin-subtext">Grace period (days)</label>
          <InlineEditField
            v-model="configForm.gracePeriodDays"
            type="number"
            :min="1"
            :max="365"
            step="1"
            :disabled="savingConfig || loadingConfig"
          />
          <p class="mt-1 text-[11px] text-admin-muted">User can cancel until this many days after request.</p>
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-admin-subtext">Permanent delete (days)</label>
          <InlineEditField
            v-model="configForm.deletionPeriodDays"
            type="number"
            :min="1"
            :max="365"
            step="1"
            :disabled="savingConfig || loadingConfig"
          />
          <p class="mt-1 text-[11px] text-admin-muted">Must be greater than or equal to the grace period.</p>
        </div>

        <dl class="sm:col-span-2 grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-2">
          <div>
            <dt class="text-xs text-admin-subtext">Preview</dt>
            <dd class="font-medium text-admin-text">
              Cancel for {{ configForm.gracePeriodDays }} day{{
                Number(configForm.gracePeriodDays) === 1 ? '' : 's'
              }},
              delete after {{ configForm.deletionPeriodDays }} day{{
                Number(configForm.deletionPeriodDays) === 1 ? '' : 's'
              }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-admin-subtext">Last updated</dt>
            <dd class="font-medium text-admin-text">
              {{ formatDt(configSaved?.updatedAt ?? null) }}
            </dd>
          </div>
        </dl>

        <p v-if="configError" class="sm:col-span-2 text-xs text-admin-danger">{{ configError }}</p>

        <div class="sm:col-span-2">
          <button
            type="button"
            class="admin-btn-primary"
            :disabled="savingConfig || loadingConfig"
            @click="saveConfig"
          >
            {{ savingConfig ? 'Saving…' : 'Save windows' }}
          </button>
        </div>
      </form>
    </section>

    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="text-sm font-semibold">Requests</h2>
        <p class="mt-0.5 text-xs text-admin-subtext">Open = requested and not yet cancelled or permanently deleted.</p>
      </div>
      <button
        type="button"
        class="admin-btn-secondary text-sm"
        :disabled="loading"
        @click="loadRequests(page)"
      >
        Refresh
      </button>
    </div>

    <div class="flex gap-1 rounded-lg border border-admin-border bg-admin-surface p-1 w-fit">
      <button
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        type="button"
        :class="[
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          statusTab === tab.value
            ? 'bg-admin-accent/15 text-admin-accent'
            : 'text-admin-subtext hover:text-admin-text',
        ]"
        @click="setStatusTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <section class="admin-card">
      <div class="mb-4 flex flex-wrap gap-2">
        <input
          v-model="filters.q"
          type="text"
          class="admin-input min-w-0 w-full flex-1 sm:min-w-[200px]"
          placeholder="Search user UUID, public ID, email, phone, username…"
          @keydown.enter="applyFilters"
        />
        <select v-model="filters.qType" class="admin-input w-auto">
          <option v-for="opt in QTYPE_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <button type="button" class="admin-btn-primary" :disabled="loading" @click="applyFilters">
          {{ loading ? 'Loading…' : 'Search' }}
        </button>
        <button type="button" class="admin-btn-secondary" :disabled="loading" @click="resetFilters">
          Reset
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Contact</th>
              <th>Scheduled</th>
              <th>Deletes</th>
              <th>Reminder</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in items"
              :key="row.id"
              class="cursor-pointer transition-colors hover:bg-admin-bg/80"
              :class="selected?.id === row.id ? 'bg-admin-accent/10' : ''"
              @click="openDetail(row)"
            >
              <td>
                <p class="text-sm font-medium">{{ row.user.name || row.user.username }}</p>
                <p class="font-mono text-xs text-admin-subtext">
                  {{ row.user.displayPublicId }}
                  <span v-if="row.user.username"> · @{{ row.user.username }}</span>
                </p>
              </td>
              <td class="text-xs">
                <p>{{ row.user.email ?? 'No email' }}</p>
                <p class="text-admin-subtext">{{ row.user.phone ?? 'No phone' }}</p>
              </td>
              <td class="whitespace-nowrap text-xs">{{ formatDt(row.scheduledAt) }}</td>
              <td class="whitespace-nowrap text-xs">
                <p>{{ formatDt(row.deletionAt) }}</p>
                <p class="text-admin-muted">{{ relativeTo(row.deletionAt) }}</p>
              </td>
              <td class="text-xs">
                {{ row.reminderSentAt ? formatDt(row.reminderSentAt) : 'Pending' }}
              </td>
              <td>
                <StatusBadge :status="row.status" />
              </td>
            </tr>
            <tr v-if="loading && !items.length">
              <td colspan="6" class="py-10 text-center text-admin-muted">Loading…</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="6" class="py-10 text-center text-admin-muted">
                No {{ statusTab === 'all' ? '' : statusTab + ' ' }}requests found
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination mt-4">
        <span>{{ formatNumber(total) }} total</span>
        <div class="flex items-center gap-2">
          <span class="text-xs">Page {{ page }}</span>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="page <= 1 || loading"
            @click="loadRequests(page - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="page * limit >= total || loading"
            @click="loadRequests(page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="selected" class="fixed inset-0 z-50 flex justify-end">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeDetail" />
          <aside
            class="relative flex h-full w-full max-w-lg flex-col border-l border-admin-border bg-admin-surface shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div class="flex items-start justify-between gap-3 border-b border-admin-border px-5 py-4">
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <StatusBadge :status="selected.status" />
                  <span
                    v-if="selected.canReactivate"
                    class="rounded-md bg-admin-bg px-2 py-0.5 text-xs text-admin-subtext"
                  >
                    Grace open
                  </span>
                  <span v-else-if="selected.status === 'open'" class="rounded-md bg-admin-warn/15 px-2 py-0.5 text-xs text-admin-warn">
                    Grace expired
                  </span>
                </div>
                <h2 class="truncate text-sm font-semibold">
                  {{ selected.user.name || selected.user.username }}
                </h2>
                <p class="mt-1 font-mono text-xs text-admin-subtext">
                  {{ selected.user.displayPublicId }}
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-md p-1 text-admin-subtext hover:bg-admin-border hover:text-admin-text"
                aria-label="Close"
                @click="closeDetail"
              >
                ✕
              </button>
            </div>

            <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <section>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  User
                </h3>
                <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-sm">
                  <p class="font-medium">{{ selected.user.name || selected.user.username }}</p>
                  <p v-if="selected.user.username" class="text-xs text-admin-subtext">
                    @{{ selected.user.username }}
                  </p>
                  <p class="mt-1 text-xs text-admin-subtext">Account status: {{ selected.user.status }}</p>
                  <p class="mt-1 text-xs">{{ selected.user.email ?? 'No email on file' }}</p>
                  <p class="text-xs">{{ selected.user.phone ?? 'No phone on file' }}</p>
                  <RouterLink
                    :to="`/admin/users/${selected.user.userId}`"
                    class="mt-2 inline-block text-xs font-medium text-admin-accent hover:underline"
                  >
                    Open user profile →
                  </RouterLink>
                </div>
              </section>

              <section>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Schedule
                </h3>
                <dl class="space-y-1.5 rounded-md border border-admin-border p-3 text-sm">
                  <div class="flex justify-between gap-2">
                    <dt class="text-admin-muted">Requested</dt>
                    <dd class="text-right">{{ formatDt(selected.scheduledAt) }}</dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt class="text-admin-muted">Cancel until</dt>
                    <dd class="text-right">{{ formatDt(selected.deactivationUntil) }}</dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt class="text-admin-muted">Deletes at</dt>
                    <dd class="text-right">
                      {{ formatDt(selected.deletionAt) }}
                      <span v-if="remainingLabel" class="block text-xs text-admin-muted">
                        {{ remainingLabel }}
                      </span>
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt class="text-admin-muted">30-min reminder</dt>
                    <dd class="text-right">
                      {{ selected.reminderSentAt ? formatDt(selected.reminderSentAt) : 'Not sent yet' }}
                    </dd>
                  </div>
                  <div v-if="selected.cancelledAt" class="flex justify-between gap-2">
                    <dt class="text-admin-muted">Cancelled</dt>
                    <dd>{{ formatDt(selected.cancelledAt) }}</dd>
                  </div>
                  <div v-if="selected.deletedAt" class="flex justify-between gap-2">
                    <dt class="text-admin-muted">Deleted</dt>
                    <dd>{{ formatDt(selected.deletedAt) }}</dd>
                  </div>
                </dl>
              </section>

              <section v-if="selected.reason || selected.ipAddress">
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
                  Request meta
                </h3>
                <div class="space-y-1 text-sm">
                  <p v-if="selected.reason">
                    <span class="text-admin-muted">Reason: </span>{{ selected.reason }}
                  </p>
                  <p v-if="selected.ipAddress" class="font-mono text-xs text-admin-subtext">
                    IP {{ selected.ipAddress }}
                  </p>
                </div>
              </section>
            </div>

            <div class="flex flex-wrap gap-2 border-t border-admin-border px-5 py-4">
              <button
                v-if="selected.status === 'open'"
                type="button"
                class="admin-btn-danger w-full text-sm"
                @click="openCancel"
              >
                Cancel deletion and restore account
              </button>
              <p v-else class="w-full text-center text-xs text-admin-muted">
                This request is no longer open.
              </p>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <ConfirmActionDialog
      :open="cancelOpen"
      title="Cancel account deletion"
      :message="cancelMessage"
      confirm-label="Cancel deletion"
      variant="danger"
      @close="cancelOpen = false"
      @confirm="confirmCancel"
    />
  </div>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-active aside,
.drawer-leave-active aside {
  transition: transform 0.25s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from aside,
.drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
