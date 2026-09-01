<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { format, parseISO } from 'date-fns'
import { adminViewsApi } from '@/api/adminViews'
import type { AdminViewCatalogItem } from '@/types/adminViews'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'
import { showToast } from '@/utils/toast'

const VIEW_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/
const ENDPOINT_RE = /^(GET|POST|PUT|PATCH|DELETE) \/admin\/.+/

const views = ref<AdminViewCatalogItem[]>([])
const loading = ref(false)
const acting = ref(false)
const search = ref('')
const expanded = ref<string | null>(null)

const createOpen = ref(false)
const editView = ref<AdminViewCatalogItem | null>(null)
const confirmReplace = ref(false)

const form = reactive({
  name: '',
  endpointsText: '',
})

const formErrors = reactive({
  name: '',
  endpoints: '',
})

const filteredViews = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return views.value
  return views.value.filter(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      v.endpoints.some((e) => e.toLowerCase().includes(q)),
  )
})

const {
  sortKey: viewsSortKey,
  sortDir: viewsSortDir,
  sortedRows: sortedViews,
  toggleSort: toggleViewsSort,
} = useSortableRows(filteredViews, (v, key) => {
  switch (key) {
    case 'name':
      return v.name?.toLowerCase() ?? ''
    case 'endpoints':
      return v.endpoints.length
    case 'assignedAdminCount':
      return v.assignedAdminCount ?? 0
    case 'updatedAt':
      return v.updatedAt ? new Date(v.updatedAt).getTime() : 0
    default:
      return undefined
  }
})

function formatDt(iso: string) {
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function clearFormErrors() {
  formErrors.name = ''
  formErrors.endpoints = ''
}

function parseEndpoints(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function validateEndpoints(endpoints: string[]): string | null {
  if (!endpoints.length) return 'At least one endpoint is required'
  if (endpoints.length > 200) return 'Maximum 200 endpoints allowed'
  for (const ep of endpoints) {
    if (!ENDPOINT_RE.test(ep)) {
      return `Invalid endpoint format: ${ep}`
    }
  }
  return null
}

function resetCreateForm() {
  form.name = ''
  form.endpointsText = ''
  clearFormErrors()
}

async function loadCatalog() {
  loading.value = true
  try {
    const { data } = await adminViewsApi.listCatalog()
    views.value = data.views ?? []
  } catch {
    showToast('Failed to load view catalog', 'error')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetCreateForm()
  createOpen.value = true
}

function openEdit(view: AdminViewCatalogItem) {
  clearFormErrors()
  editView.value = view
  form.name = view.name
  form.endpointsText = view.endpoints.join('\n')
}

function closeFormDialog() {
  createOpen.value = false
  editView.value = null
  confirmReplace.value = false
}

function toggleExpand(name: string) {
  expanded.value = expanded.value === name ? null : name
}

async function submitCreate() {
  clearFormErrors()
  const name = form.name.trim()
  if (!name || name.length < 2 || name.length > 100 || !VIEW_NAME_RE.test(name)) {
    formErrors.name = 'Name: 2–100 chars, start with a letter (A–Z, 0–9, _, -)'
    showToast('Fix the form errors', 'error')
    return
  }
  const endpoints = parseEndpoints(form.endpointsText)
  const epErr = validateEndpoints(endpoints)
  if (epErr) {
    formErrors.endpoints = epErr
    showToast('Fix the form errors', 'error')
    return
  }

  acting.value = true
  try {
    const { data } = await adminViewsApi.createOrExtend({ name, endpoints })
    showToast(data.created ? `View “${name}” created` : `View “${name}” extended`, 'success')
    closeFormDialog()
    await loadCatalog()
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Failed to save view'
    showToast(msg, 'error')
  } finally {
    acting.value = false
  }
}

function requestReplace() {
  clearFormErrors()
  const endpoints = parseEndpoints(form.endpointsText)
  const epErr = validateEndpoints(endpoints)
  if (epErr) {
    formErrors.endpoints = epErr
    showToast('Fix the form errors', 'error')
    return
  }
  confirmReplace.value = true
}

async function submitReplace() {
  if (!editView.value) return
  const endpoints = parseEndpoints(form.endpointsText)
  acting.value = true
  try {
    await adminViewsApi.replace(editView.value.name, { endpoints })
    showToast(`View “${editView.value.name}” endpoints replaced`, 'success')
    closeFormDialog()
    await loadCatalog()
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Failed to replace endpoints'
    showToast(msg, 'error')
  } finally {
    acting.value = false
    confirmReplace.value = false
  }
}

onMounted(() => loadCatalog())
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold sm:text-2xl">Admin Views</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Catalog of panel views and their API endpoints (SUPER_ADMIN). Assign views to CSAs from
          Support → Agents.
        </p>
      </div>
      <button type="button" class="admin-btn-primary w-full shrink-0 sm:w-auto" @click="openCreate">
        Create / Extend View
      </button>
    </div>

    <div class="admin-card space-y-4">
      <div class="flex flex-col gap-3 border-b border-admin-border pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <input
          v-model="search"
          type="search"
          class="admin-input w-full min-w-0 flex-1 sm:max-w-xs"
          placeholder="Search by name or endpoint…"
        />
        <button type="button" class="admin-btn-secondary w-full sm:w-auto" :disabled="loading" @click="loadCatalog">
          Refresh
        </button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <SortableTh label="View" sort-key="name" :active-key="viewsSortKey" :direction="viewsSortDir" @sort="toggleViewsSort" />
              <SortableTh label="Endpoints" sort-key="endpoints" :active-key="viewsSortKey" :direction="viewsSortDir" @sort="toggleViewsSort" />
              <SortableTh label="Assigned CSAs" sort-key="assignedAdminCount" :active-key="viewsSortKey" :direction="viewsSortDir" @sort="toggleViewsSort" />
              <SortableTh label="Updated" sort-key="updatedAt" :active-key="viewsSortKey" :direction="viewsSortDir" @sort="toggleViewsSort" />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="py-8 text-center text-admin-subtext">Loading…</td>
            </tr>
            <tr v-else-if="!filteredViews.length">
              <td colspan="5" class="py-8 text-center text-admin-subtext">
                No views in catalog. Run backend seed or create a view.
              </td>
            </tr>
            <template v-for="view in sortedViews" :key="view.name">
              <tr>
                <td>
                  <button
                    type="button"
                    class="text-left font-medium text-admin-accent hover:underline"
                    @click="toggleExpand(view.name)"
                  >
                    {{ view.name }}
                  </button>
                </td>
                <td class="tabular-nums">{{ view.endpoints.length }}</td>
                <td>
                  <span
                    class="inline-flex min-w-[1.75rem] items-center justify-center rounded-md bg-admin-bg px-2 py-0.5 text-sm tabular-nums"
                  >
                    {{ view.assignedAdminCount }}
                  </span>
                </td>
                <td class="text-sm text-admin-subtext">{{ formatDt(view.updatedAt) }}</td>
                <td>
                  <button type="button" class="admin-btn-secondary text-xs" @click="openEdit(view)">
                    Edit endpoints
                  </button>
                </td>
              </tr>
              <tr v-if="expanded === view.name">
                <td colspan="5" class="bg-admin-bg/40 py-3">
                  <ul class="max-h-48 space-y-1 overflow-y-auto px-2 font-mono text-xs text-admin-subtext">
                    <li v-for="ep in view.endpoints" :key="ep">{{ ep }}</li>
                    <li v-if="!view.endpoints.length" class="text-admin-muted">No endpoints</li>
                  </ul>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <p class="text-sm text-admin-subtext">{{ filteredViews.length }} view(s)</p>
    </div>

    <!-- Create / Extend -->
    <BaseDialog
      :open="createOpen"
      title="Create or extend a view"
      size="lg"
      @close="closeFormDialog"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-admin-subtext">
            If the name already exists, endpoints are <strong>unioned</strong> (nothing removed).
            Use Edit to replace the full list.
          </p>
          <div>
            <label class="mb-1 block text-sm font-medium">View name</label>
            <input
              v-model="form.name"
              type="text"
              class="admin-input w-full"
              placeholder="e.g. RefundsView"
              autocomplete="off"
            />
            <p v-if="formErrors.name" class="mt-1 text-xs text-admin-danger">{{ formErrors.name }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Endpoints (one per line)</label>
            <textarea
              v-model="form.endpointsText"
              class="admin-input min-h-[160px] w-full font-mono text-xs"
              placeholder="GET /admin/refunds&#10;POST /admin/refunds/:refundId/approve"
            />
            <p v-if="formErrors.endpoints" class="mt-1 text-xs text-admin-danger">
              {{ formErrors.endpoints }}
            </p>
            <p class="mt-1 text-xs text-admin-muted">
              Format: <code>METHOD /admin/…</code> (GET, POST, PUT, PATCH, DELETE)
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="closeFormDialog">Cancel</button>
        <button type="button" class="admin-btn-primary" :disabled="acting" @click="submitCreate">
          {{ acting ? 'Saving…' : 'Save' }}
        </button>
      </template>
    </BaseDialog>

    <!-- Replace endpoints -->
    <BaseDialog
      :open="!!editView && !confirmReplace"
      :title="editView ? `Replace endpoints — ${editView.name}` : 'Replace endpoints'"
      size="lg"
      @close="closeFormDialog"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-admin-subtext">
            This <strong>replaces</strong> the entire endpoint list. To remove a mistaken endpoint,
            omit it here and confirm.
          </p>
          <div>
            <label class="mb-1 block text-sm font-medium">Endpoints (one per line)</label>
            <textarea
              v-model="form.endpointsText"
              class="admin-input min-h-[200px] w-full font-mono text-xs"
            />
            <p v-if="formErrors.endpoints" class="mt-1 text-xs text-admin-danger">
              {{ formErrors.endpoints }}
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="closeFormDialog">Cancel</button>
        <button type="button" class="admin-btn-primary" :disabled="acting" @click="requestReplace">
          Replace…
        </button>
      </template>
    </BaseDialog>

    <ConfirmActionDialog
      :open="confirmReplace"
      title="Replace all endpoints?"
      :message="
        editView
          ? `This will overwrite every endpoint on “${editView.name}”. Continue?`
          : 'Continue?'
      "
      confirm-label="Replace"
      variant="warn"
      @close="confirmReplace = false"
      @confirm="submitReplace"
    />
  </div>
</template>
