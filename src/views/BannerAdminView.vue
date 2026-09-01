<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { format, parseISO } from 'date-fns'
import { bannerAdminApi, uploadBannerImage } from '@/api/bannerAdmin'
import type {
  BannerAdmin,
  BannerListStatusFilter,
  CreateBannerPayload,
  PatchBannerPayload,
} from '@/types/banner'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'
import { formatNumber } from '@/utils/format'
import { isValidHttpUrl } from '@/utils/catalogValidation'
import { showToast } from '@/utils/toast'

const BANNER_IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,.gif,image/png,image/jpeg,image/webp,image/svg+xml,image/gif'
const BANNER_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'])

const POSITION_SUGGESTIONS = ['home_top', 'mid_banner', 'lucky_page', 'recharge_page']

const STATUS_TABS: { id: BannerListStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'stopped', label: 'Stopped' },
  { id: 'completed', label: 'Completed' },
]

const banners = ref<BannerAdmin[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const loading = ref(false)
const acting = ref(false)
const uploading = ref(false)

const statusFilter = ref<BannerListStatusFilter>('all')
const positionFilter = ref('')

const createOpen = ref(false)
const editBanner = ref<BannerAdmin | null>(null)
const deleteId = ref<string | null>(null)

const imageMode = ref<'url' | 'file'>('file')
const imageFile = ref<File | null>(null)

const form = reactive({
  title: '',
  imageUrl: '',
  position: 'home_top',
  startAt: '',
  endMode: 'validityDays' as 'validityDays' | 'endAt',
  validityDays: 30,
  endAt: '',
  enabled: true,
})

const formErrors = reactive({
  title: '',
  imageUrl: '',
  position: '',
  startAt: '',
  validityDays: '',
  endAt: '',
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

function extFromFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot < 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

function toDatetimeLocalValue(iso: string): string {
  try {
    const d = parseISO(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString()
}

function formatDt(iso: string) {
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function statusBadgeProps(status: string) {
  const map: Record<string, { status: string; label: string }> = {
    ACTIVE: { status: 'active', label: 'Active' },
    SCHEDULED: { status: 'pending', label: 'Scheduled' },
    COMPLETED: { status: 'verified', label: 'Completed' },
    STOPPED: { status: 'inactive', label: 'Stopped' },
  }
  return map[status] ?? { status: 'none', label: status }
}

function clearFormErrors() {
  formErrors.title = ''
  formErrors.imageUrl = ''
  formErrors.position = ''
  formErrors.startAt = ''
  formErrors.validityDays = ''
  formErrors.endAt = ''
}

function resetForm() {
  form.title = ''
  form.imageUrl = ''
  form.position = 'home_top'
  form.startAt = toDatetimeLocalValue(new Date().toISOString())
  form.endMode = 'validityDays'
  form.validityDays = 30
  form.endAt = ''
  form.enabled = true
  imageMode.value = 'file'
  imageFile.value = null
  clearFormErrors()
}

function openCreate() {
  resetForm()
  createOpen.value = true
}

function openEdit(banner: BannerAdmin) {
  clearFormErrors()
  editBanner.value = banner
  form.title = banner.title
  form.imageUrl = banner.imageUrl
  form.position = banner.position
  form.startAt = toDatetimeLocalValue(banner.startAt)
  form.endMode = 'endAt'
  form.endAt = toDatetimeLocalValue(banner.endAt)
  form.validityDays = 30
  form.enabled = banner.enabled
  imageMode.value = 'url'
  imageFile.value = null
}

function onImageFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0] ?? null
  if (!selected) {
    imageFile.value = null
    return
  }
  const ext = extFromFilename(selected.name)
  if (!ext || !BANNER_EXTENSIONS.has(ext)) {
    input.value = ''
    imageFile.value = null
    showToast(`Unsupported file type. Allowed: ${[...BANNER_EXTENSIONS].join(', ')}`, 'error')
    return
  }
  imageFile.value = selected
}

function validateForm(isEdit: boolean): boolean {
  clearFormErrors()
  let valid = true

  if (!form.title.trim()) {
    formErrors.title = 'Title is required'
    valid = false
  }
  if (!form.position.trim()) {
    formErrors.position = 'Position is required'
    valid = false
  }
  if (!form.startAt) {
    formErrors.startAt = 'Start date is required'
    valid = false
  }

  if (imageMode.value === 'url') {
    if (!form.imageUrl.trim()) {
      formErrors.imageUrl = 'Image URL is required'
      valid = false
    } else if (!isValidHttpUrl(form.imageUrl)) {
      formErrors.imageUrl = 'Enter a valid http(s) URL'
      valid = false
    }
  } else if (!imageFile.value && !(isEdit && editBanner.value?.imageUrl)) {
    formErrors.imageUrl = 'Choose an image file'
    valid = false
  }

  if (form.endMode === 'validityDays') {
    const days = Number(form.validityDays)
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      formErrors.validityDays = 'Validity days must be 1–3650'
      valid = false
    }
  } else if (!form.endAt) {
    formErrors.endAt = 'End date is required'
    valid = false
  } else if (form.startAt && new Date(form.endAt).getTime() <= new Date(form.startAt).getTime()) {
    formErrors.endAt = 'End must be after start'
    valid = false
  }

  return valid
}

async function resolveImageUrl(isEdit: boolean): Promise<string> {
  if (imageMode.value === 'file' && imageFile.value) {
    uploading.value = true
    try {
      return await uploadBannerImage(imageFile.value)
    } finally {
      uploading.value = false
    }
  }
  if (form.imageUrl.trim()) return form.imageUrl.trim()
  if (isEdit && editBanner.value?.imageUrl) return editBanner.value.imageUrl
  throw new Error('Image is required')
}

async function loadBanners(nextPage = 1) {
  loading.value = true
  page.value = nextPage
  try {
    const { data } = await bannerAdminApi.list({
      status: statusFilter.value,
      position: positionFilter.value.trim() || undefined,
      page: nextPage,
      limit,
    })
    banners.value = data.banners ?? []
    total.value = data.total ?? 0
  } catch {
    banners.value = []
    total.value = 0
    showToast('Failed to load banners', 'error')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  loadBanners(1)
}

function setStatusTab(id: BannerListStatusFilter) {
  statusFilter.value = id
  loadBanners(1)
}

async function submitCreate() {
  if (!validateForm(false)) {
    showToast('Fix the form errors', 'error')
    return
  }
  acting.value = true
  try {
    const imageUrl = await resolveImageUrl(false)
    const payload: CreateBannerPayload = {
      title: form.title.trim(),
      imageUrl,
      position: form.position.trim(),
      startAt: fromDatetimeLocalValue(form.startAt),
      enabled: form.enabled,
    }
    if (form.endMode === 'validityDays') {
      payload.validityDays = Number(form.validityDays)
    } else {
      payload.endAt = fromDatetimeLocalValue(form.endAt)
    }
    await bannerAdminApi.create(payload)
    showToast('Banner created', 'success')
    createOpen.value = false
    await loadBanners(1)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create banner'
    showToast(msg, 'error')
  } finally {
    acting.value = false
  }
}

async function submitEdit() {
  if (!editBanner.value) return
  if (!validateForm(true)) {
    showToast('Fix the form errors', 'error')
    return
  }
  acting.value = true
  try {
    const imageUrl = await resolveImageUrl(true)
    const payload: PatchBannerPayload = {
      title: form.title.trim(),
      imageUrl,
      position: form.position.trim(),
      startAt: fromDatetimeLocalValue(form.startAt),
      enabled: form.enabled,
    }
    if (form.endMode === 'validityDays') {
      payload.validityDays = Number(form.validityDays)
    } else {
      payload.endAt = fromDatetimeLocalValue(form.endAt)
    }
    await bannerAdminApi.patch(editBanner.value.id, payload)
    showToast('Banner updated', 'success')
    editBanner.value = null
    await loadBanners(page.value)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update banner'
    showToast(msg, 'error')
  } finally {
    acting.value = false
  }
}

async function toggleEnabled(banner: BannerAdmin) {
  acting.value = true
  try {
    await bannerAdminApi.patch(banner.id, { enabled: !banner.enabled })
    showToast(banner.enabled ? 'Banner stopped' : 'Banner re-enabled', 'success')
    await loadBanners(page.value)
  } finally {
    acting.value = false
  }
}

async function confirmDelete() {
  if (!deleteId.value) return
  acting.value = true
  try {
    await bannerAdminApi.delete(deleteId.value)
    showToast('Banner deleted', 'success')
    deleteId.value = null
    await loadBanners(page.value)
  } finally {
    acting.value = false
  }
}

const {
  sortKey: bannersSortKey,
  sortDir: bannersSortDir,
  sortedRows: sortedBanners,
  toggleSort: toggleBannersSort,
} = useSortableRows(banners, (banner, key) => {
  switch (key) {
    case 'title':
      return banner.title?.toLowerCase() ?? ''
    case 'position':
      return banner.position?.toLowerCase() ?? ''
    case 'startAt':
      return banner.startAt ? new Date(banner.startAt).getTime() : 0
    case 'status':
      return banner.status ?? ''
    default:
      return undefined
  }
})

const formDialogOpen = computed(() => createOpen.value || !!editBanner.value)
const formDialogTitle = computed(() => (editBanner.value ? 'Edit Banner' : 'Create Banner'))

const imagePreviewUrl = computed(() => {
  if (imageMode.value === 'url' && form.imageUrl.trim()) return form.imageUrl.trim()
  if (imageMode.value === 'file' && imageFile.value && imageFile.value.type.startsWith('image/')) {
    return URL.createObjectURL(imageFile.value)
  }
  if (imageMode.value === 'file' && !imageFile.value && editBanner.value?.imageUrl) {
    return editBanner.value.imageUrl
  }
  return null
})

function closeFormDialog() {
  createOpen.value = false
  editBanner.value = null
}

onMounted(() => loadBanners())
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold sm:text-2xl">Banner Management</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Slider banners for app placements (SUPER_ADMIN)
        </p>
      </div>
      <button type="button" class="admin-btn-primary w-full shrink-0 sm:w-auto" @click="openCreate">
        Create Banner
      </button>
    </div>

    <div class="admin-card">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-admin-border pb-4">
        <div class="flex flex-wrap gap-1 rounded-lg bg-admin-bg p-1">
          <button
            v-for="t in STATUS_TABS"
            :key="t.id"
            type="button"
            :class="[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === t.id
                ? 'bg-admin-accent text-white'
                : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="setStatusTab(t.id)"
          >
            {{ t.label }}
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <input
            v-model="positionFilter"
            type="text"
            list="banner-positions"
            class="admin-input w-full sm:w-44"
            placeholder="Position filter…"
            @keydown.enter="applyFilters"
          />
          <datalist id="banner-positions">
            <option v-for="p in POSITION_SUGGESTIONS" :key="p" :value="p" />
          </datalist>
          <button type="button" class="admin-btn-secondary" :disabled="loading" @click="applyFilters">
            Filter
          </button>
        </div>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <SortableTh label="Banner" sort-key="title" :active-key="bannersSortKey" :direction="bannersSortDir" @sort="toggleBannersSort" />
              <SortableTh label="Position" sort-key="position" :active-key="bannersSortKey" :direction="bannersSortDir" @sort="toggleBannersSort" />
              <SortableTh label="Window" sort-key="startAt" :active-key="bannersSortKey" :direction="bannersSortDir" @sort="toggleBannersSort" />
              <SortableTh label="Status" sort-key="status" :active-key="bannersSortKey" :direction="bannersSortDir" @sort="toggleBannersSort" />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="py-8 text-center text-admin-subtext">Loading…</td>
            </tr>
            <tr v-else-if="!banners.length">
              <td colspan="5" class="py-8 text-center text-admin-subtext">No banners found</td>
            </tr>
            <tr v-for="banner in sortedBanners" :key="banner.id">
              <td>
                <div class="flex items-center gap-3">
                  <img
                    :src="banner.imageUrl"
                    :alt="banner.title"
                    class="h-12 w-20 rounded object-cover"
                  />
                  <div>
                    <p class="font-medium">{{ banner.title }}</p>
                    <p class="max-w-[200px] truncate text-xs text-admin-muted">{{ banner.id }}</p>
                  </div>
                </div>
              </td>
              <td>
                <code class="rounded bg-admin-bg px-1.5 py-0.5 text-xs">{{ banner.position }}</code>
              </td>
              <td class="text-sm">
                <p>{{ formatDt(banner.startAt) }}</p>
                <p class="text-admin-subtext">→ {{ formatDt(banner.endAt) }}</p>
              </td>
              <td>
                <StatusBadge
                  v-bind="statusBadgeProps(banner.status)"
                />
              </td>
              <td>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="admin-btn-secondary text-xs" @click="openEdit(banner)">
                    Edit
                  </button>
                  <button
                    type="button"
                    class="admin-btn-secondary text-xs"
                    :disabled="acting || banner.status === 'COMPLETED'"
                    @click="toggleEnabled(banner)"
                  >
                    {{ banner.enabled ? 'Stop' : 'Enable' }}
                  </button>
                  <button
                    type="button"
                    class="admin-btn-danger text-xs"
                    @click="deleteId = banner.id"
                  >
                    Delete
                  </button>
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
            @click="loadBanners(page - 1)"
          >
            Prev
          </button>
          <button
            type="button"
            class="admin-btn-secondary text-xs"
            :disabled="page >= totalPages || loading"
            @click="loadBanners(page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <BaseDialog :open="formDialogOpen" :title="formDialogTitle" size="lg" @close="closeFormDialog">
      <template #body>
        <div class="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Title <span class="text-admin-danger">*</span></label>
            <input v-model="form.title" type="text" class="admin-input" maxlength="200" />
            <p v-if="formErrors.title" class="mt-1 text-xs text-admin-danger">{{ formErrors.title }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs text-admin-subtext">
              Position <span class="text-admin-danger">*</span>
            </label>
            <input
              v-model="form.position"
              type="text"
              list="banner-form-positions"
              class="admin-input"
              placeholder="e.g. home_top"
              maxlength="100"
            />
            <datalist id="banner-form-positions">
              <option v-for="p in POSITION_SUGGESTIONS" :key="p" :value="p" />
            </datalist>
            <p v-if="formErrors.position" class="mt-1 text-xs text-admin-danger">{{ formErrors.position }}</p>
          </div>

          <div class="space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <label class="text-xs text-admin-subtext">
                Image <span class="text-admin-danger">*</span>
              </label>
              <div class="flex rounded-md border border-admin-border p-0.5 text-xs">
                <button
                  type="button"
                  :class="[
                    'rounded px-2 py-1',
                    imageMode === 'file' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
                  ]"
                  @click="imageMode = 'file'"
                >
                  Upload
                </button>
                <button
                  type="button"
                  :class="[
                    'rounded px-2 py-1',
                    imageMode === 'url' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
                  ]"
                  @click="imageMode = 'url'"
                >
                  URL
                </button>
              </div>
            </div>
            <input
              v-if="imageMode === 'url'"
              v-model="form.imageUrl"
              type="url"
              class="admin-input"
              placeholder="https://…"
            />
            <input
              v-else
              type="file"
              class="admin-input"
              :accept="BANNER_IMAGE_ACCEPT"
              @change="onImageFileChange"
            />
            <p v-if="formErrors.imageUrl" class="text-xs text-admin-danger">{{ formErrors.imageUrl }}</p>
            <img
              v-if="imagePreviewUrl"
              :src="imagePreviewUrl"
              alt="Preview"
              class="mt-2 h-24 rounded object-cover"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs text-admin-subtext">
              Start at <span class="text-admin-danger">*</span>
            </label>
            <input v-model="form.startAt" type="datetime-local" class="admin-input" />
            <p v-if="formErrors.startAt" class="mt-1 text-xs text-admin-danger">{{ formErrors.startAt }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs text-admin-subtext">End window</label>
            <div class="mb-2 flex gap-1 rounded-lg bg-admin-bg p-1">
              <button
                type="button"
                :class="[
                  'flex-1 rounded-md px-3 py-1.5 text-sm',
                  form.endMode === 'validityDays'
                    ? 'bg-admin-accent text-white'
                    : 'text-admin-subtext',
                ]"
                @click="form.endMode = 'validityDays'"
              >
                Validity days
              </button>
              <button
                type="button"
                :class="[
                  'flex-1 rounded-md px-3 py-1.5 text-sm',
                  form.endMode === 'endAt' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
                ]"
                @click="form.endMode = 'endAt'"
              >
                Explicit end
              </button>
            </div>
            <input
              v-if="form.endMode === 'validityDays'"
              v-model.number="form.validityDays"
              type="number"
              min="1"
              max="3650"
              class="admin-input"
            />
            <input v-else v-model="form.endAt" type="datetime-local" class="admin-input" />
            <p v-if="formErrors.validityDays" class="mt-1 text-xs text-admin-danger">
              {{ formErrors.validityDays }}
            </p>
            <p v-if="formErrors.endAt" class="mt-1 text-xs text-admin-danger">{{ formErrors.endAt }}</p>
          </div>

          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.enabled" type="checkbox" class="rounded border-admin-border" />
            Enabled
          </label>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="closeFormDialog">Cancel</button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting || uploading"
          @click="editBanner ? submitEdit() : submitCreate()"
        >
          {{ uploading ? 'Uploading…' : acting ? 'Saving…' : editBanner ? 'Save' : 'Create' }}
        </button>
      </template>
    </BaseDialog>

    <ConfirmActionDialog
      :open="!!deleteId"
      title="Delete banner"
      message="This permanently deletes the banner. This cannot be undone."
      confirm-label="Delete"
      variant="danger"
      @close="deleteId = null"
      @confirm="confirmDelete"
    />
  </div>
</template>
