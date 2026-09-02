<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { format } from 'date-fns'
import { uploadAdminCatalogAsset } from '@/api/catalogAssetUpload'
import { giftAdminApi, normalizeGiftCategories } from '@/api/giftAdmin'
import type {
  CreateGiftPayload,
  GalleryCategoryAdmin,
  GiftAdminListItem,
  GiftAnalytics,
  GiftCategoryAdmin,
} from '@/types/gift'
import CatalogAssetField from '@/components/shared/CatalogAssetField.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'
import { formatCoins, formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'
import {
  GIFT_ASSET_ACCEPT,
  GIFT_CODE_PATTERN,
  CATEGORY_SLUG_PATTERN,
  isValidHttpUrl,
  validateNonNegativeInt,
  validatePositiveInt,
} from '@/utils/catalogValidation'

const tab = ref<'catalog' | 'categories' | 'gallery'>('catalog')
const analytics = ref<GiftAnalytics | null>(null)
const loadingAnalytics = ref(false)

const gifts = ref<GiftAdminListItem[]>([])
const giftsTotal = ref(0)
const giftsPage = ref(1)
const giftsLimit = 20
const loadingGifts = ref(false)
const giftFilters = reactive({
  status: 'all' as 'all' | 'active' | 'disabled',
  categoryId: '',
  search: '',
  minPrice: '',
  maxPrice: '',
})

const categories = ref<GiftCategoryAdmin[]>([])
const loadingCategories = ref(false)

const gallery = ref<GalleryCategoryAdmin[]>([])
const galleryYear = ref<number | null>(null)
const galleryMonth = ref<number | null>(null)
const loadingGallery = ref(false)

const createGiftOpen = ref(false)
const editGift = ref<GiftAdminListItem | null>(null)
const deleteGiftId = ref<string | null>(null)
const createCategoryOpen = ref(false)
const createGalleryOpen = ref(false)
const manageGalleryOpen = ref<GalleryCategoryAdmin | null>(null)
const deleteGalleryId = ref<string | null>(null)
const acting = ref(false)
const uploading = ref(false)

const giftForm = reactive({
  name: '',
  code: '',
  coinCost: 100,
  displayImageUrl: '',
  effectUrl: '',
  categoryId: '',
  displayOrder: 0,
  vipOnly: false,
  isActive: true,
})

const displayAssetMode = ref<'url' | 'file'>('url')
const effectAssetMode = ref<'url' | 'file'>('url')
const displayFile = ref<File | null>(null)
const effectFile = ref<File | null>(null)

const giftFormErrors = reactive({
  name: '',
  code: '',
  coinCost: '',
  displayImageUrl: '',
  effectUrl: '',
  displayOrder: '',
})

const categoryForm = reactive({ name: '', slug: '' })
const categoryFormErrors = reactive({ name: '', slug: '' })
const galleryForm = reactive({ name: '', displayOrder: 0 })
const galleryFormErrors = reactive({ name: '', displayOrder: '' })

const catalogGiftsForPicker = ref<GiftAdminListItem[]>([])
const loadingCatalogGifts = ref(false)
const gallerySelectedGiftIds = ref<string[]>([])
const galleryGiftPickerId = ref('')
const galleryFormError = ref('')

const mostSent = computed(() => analytics.value?.mostSentGifts?.slice(0, 5) ?? [])

const gallerySlotCount = computed(() =>
  gallery.value.reduce((n, s) => n + (s.gifts?.length ?? s.giftCount ?? 0), 0),
)

const allGallerySlots = computed(() =>
  gallery.value.flatMap((section) =>
    (section.gifts ?? []).map((g) => ({
      ...g,
      sectionId: section.id,
      sectionName: section.name,
      sectionStatus: section.status,
    })),
  ),
)

const deleteGallerySection = computed(
  () => gallery.value.find((s) => s.id === deleteGalleryId.value) ?? null,
)

const deleteGalleryMessage = computed(() => {
  const section = deleteGallerySection.value
  if (!section) return 'This removes the gallery section and its gift slots.'
  const n = section.gifts?.length ?? section.giftCount ?? 0
  return `This permanently removes “${section.name}” and ${n} gallery slot(s) from this UTC month’s template. Host progress for those slots is deleted. Catalog gifts are not deleted. Hide keeps the slots in the template.`
})

const galleryGiftMap = computed(() => {
  const map = new Map<string, GiftAdminListItem>()
  for (const g of catalogGiftsForPicker.value) map.set(g.id, g)
  for (const section of gallery.value) {
    for (const g of section.gifts ?? []) {
      if (!map.has(g.giftId)) {
        map.set(g.giftId, {
          id: g.giftId,
          name: g.name,
          code: g.code,
          displayImageUrl: g.displayImageUrl,
          effectUrl: null,
          category: null,
          coinCost: g.coinCost,
          displayOrder: g.sortOrder,
          vipOnly: false,
          timesSent: 0,
          status: 'active',
          createdAt: '',
        })
      }
    }
  }
  return map
})

const galleryAvailableGiftOptions = computed(() =>
  catalogGiftsForPicker.value.filter((g) => !gallerySelectedGiftIds.value.includes(g.id)),
)

const gallerySelectedGifts = computed(() =>
  gallerySelectedGiftIds.value
    .map((id) => galleryGiftMap.value.get(id))
    .filter((g): g is GiftAdminListItem => !!g),
)

function clearGiftFormErrors() {
  giftFormErrors.name = ''
  giftFormErrors.code = ''
  giftFormErrors.coinCost = ''
  giftFormErrors.displayImageUrl = ''
  giftFormErrors.effectUrl = ''
  giftFormErrors.displayOrder = ''
}

function resetGiftForm() {
  giftForm.name = ''
  giftForm.code = ''
  giftForm.coinCost = 100
  giftForm.displayImageUrl = ''
  giftForm.effectUrl = ''
  giftForm.categoryId = ''
  giftForm.displayOrder = 0
  giftForm.vipOnly = false
  giftForm.isActive = true
  displayAssetMode.value = 'url'
  effectAssetMode.value = 'url'
  displayFile.value = null
  effectFile.value = null
  clearGiftFormErrors()
}

function validateGiftForm(isEdit: boolean): boolean {
  clearGiftFormErrors()
  let valid = true

  if (!giftForm.name.trim()) {
    giftFormErrors.name = 'Name is required'
    valid = false
  }

  if (!giftForm.code.trim()) {
    giftFormErrors.code = 'Code is required'
    valid = false
  } else if (!GIFT_CODE_PATTERN.test(giftForm.code.trim())) {
    giftFormErrors.code = 'Lowercase slug: letters, numbers, hyphens, underscores'
    valid = false
  }

  const coinErr = validatePositiveInt(giftForm.coinCost, 'Coin cost')
  if (coinErr) {
    giftFormErrors.coinCost = coinErr
    valid = false
  }

  const orderErr = validateNonNegativeInt(giftForm.displayOrder, 'Display order')
  if (orderErr) {
    giftFormErrors.displayOrder = orderErr
    valid = false
  }

  if (displayAssetMode.value === 'url') {
    if (!giftForm.displayImageUrl.trim()) {
      giftFormErrors.displayImageUrl = 'Display image URL is required'
      valid = false
    } else if (!isValidHttpUrl(giftForm.displayImageUrl)) {
      giftFormErrors.displayImageUrl = 'Enter a valid http(s) URL'
      valid = false
    }
  } else if (!displayFile.value && !(isEdit && editGift.value?.displayImageUrl)) {
    giftFormErrors.displayImageUrl = 'Choose a display image or video file'
    valid = false
  }

  if (effectAssetMode.value === 'url' && giftForm.effectUrl.trim()) {
    if (!isValidHttpUrl(giftForm.effectUrl)) {
      giftFormErrors.effectUrl = 'Enter a valid http(s) URL'
      valid = false
    }
  } else if (effectAssetMode.value === 'file' && effectFile.value === null && giftForm.effectUrl.trim()) {
    // switched to file mode with leftover URL text — ok if optional empty file on edit
  }

  return valid
}

async function resolveGiftAssetUrl(
  mode: 'url' | 'file',
  url: string,
  file: File | null,
  role: 'display' | 'effect',
  existingUrl?: string | null,
): Promise<string | null> {
  if (mode === 'url') {
    const trimmed = url.trim()
    return trimmed || null
  }
  if (file) {
    return uploadAdminCatalogAsset({ domain: 'gift', role, file })
  }
  return existingUrl ?? null
}

async function loadCatalogGiftsForPicker() {
  if (catalogGiftsForPicker.value.length) return
  loadingCatalogGifts.value = true
  try {
    const { data } = await giftAdminApi.listGifts({ status: 'active', limit: 100, page: 1 })
    catalogGiftsForPicker.value = data.items
  } finally {
    loadingCatalogGifts.value = false
  }
}

async function loadAnalytics() {
  loadingAnalytics.value = true
  try {
    const { data } = await giftAdminApi.getAnalytics()
    analytics.value = data
  } catch {
    /* interceptor */
  } finally {
    loadingAnalytics.value = false
  }
}

async function loadGifts(page = 1) {
  loadingGifts.value = true
  giftsPage.value = page
  try {
    const { data } = await giftAdminApi.listGifts({
      page,
      limit: giftsLimit,
      status: giftFilters.status,
      categoryId: giftFilters.categoryId || undefined,
      search: giftFilters.search.trim() || undefined,
      minPrice: giftFilters.minPrice ? Number(giftFilters.minPrice) : undefined,
      maxPrice: giftFilters.maxPrice ? Number(giftFilters.maxPrice) : undefined,
    })
    gifts.value = data.items
    giftsTotal.value = data.total
  } finally {
    loadingGifts.value = false
  }
}

async function loadCategories() {
  loadingCategories.value = true
  try {
    const { data } = await giftAdminApi.listCategories()
    categories.value = normalizeGiftCategories(data)
  } finally {
    loadingCategories.value = false
  }
}

async function loadGallery() {
  loadingGallery.value = true
  try {
    const { data } = await giftAdminApi.listGalleryCategories()
    gallery.value = data.categories ?? []
    galleryYear.value = data.year ?? null
    galleryMonth.value = data.month ?? null
  } finally {
    loadingGallery.value = false
  }
}

function galleryPeriodLabel() {
  if (galleryYear.value == null || galleryMonth.value == null) return 'current UTC month'
  const d = new Date(Date.UTC(galleryYear.value, galleryMonth.value - 1, 1))
  return `${format(d, 'MMMM yyyy')} UTC`
}

function openCreateGift() {
  resetGiftForm()
  createGiftOpen.value = true
}

function openEditGift(gift: GiftAdminListItem) {
  editGift.value = gift
  giftForm.name = gift.name
  giftForm.code = gift.code
  giftForm.coinCost = gift.coinCost
  giftForm.displayImageUrl = gift.displayImageUrl
  giftForm.effectUrl = gift.effectUrl ?? ''
  giftForm.categoryId = gift.category?.id ?? ''
  giftForm.displayOrder = gift.displayOrder
  giftForm.vipOnly = gift.vipOnly
  giftForm.isActive = gift.status === 'active'
  displayAssetMode.value = 'url'
  effectAssetMode.value = 'url'
  displayFile.value = null
  effectFile.value = null
  clearGiftFormErrors()
}

async function submitCreateGift() {
  if (!validateGiftForm(false)) {
    showToast('Fix validation errors before saving', 'error')
    return
  }
  acting.value = true
  uploading.value = true
  try {
    const displayImageUrl = await resolveGiftAssetUrl(
      displayAssetMode.value,
      giftForm.displayImageUrl,
      displayFile.value,
      'display',
    )
    if (!displayImageUrl) {
      giftFormErrors.displayImageUrl = 'Display image is required'
      return
    }

    let effectUrl: string | null = null
    if (effectAssetMode.value === 'url') {
      effectUrl = giftForm.effectUrl.trim() || null
    } else if (effectFile.value) {
      effectUrl = await uploadAdminCatalogAsset({ domain: 'gift', role: 'effect', file: effectFile.value })
    }

    const payload: CreateGiftPayload = {
      name: giftForm.name.trim(),
      code: giftForm.code.trim(),
      coinCost: Number(giftForm.coinCost),
      displayImageUrl,
      effectUrl,
      categoryId: giftForm.categoryId || null,
      displayOrder: Number(giftForm.displayOrder),
      vipOnly: giftForm.vipOnly,
      isActive: giftForm.isActive,
    }
    await giftAdminApi.createGift(payload)
    showToast('Gift created', 'success')
    createGiftOpen.value = false
    catalogGiftsForPicker.value = []
    await Promise.all([loadGifts(1), loadAnalytics()])
  } finally {
    acting.value = false
    uploading.value = false
  }
}

async function submitEditGift() {
  if (!editGift.value) return
  if (!validateGiftForm(true)) {
    showToast('Fix validation errors before saving', 'error')
    return
  }
  acting.value = true
  uploading.value = true
  try {
    const displayImageUrl = await resolveGiftAssetUrl(
      displayAssetMode.value,
      giftForm.displayImageUrl,
      displayFile.value,
      'display',
      editGift.value.displayImageUrl,
    )
    if (!displayImageUrl) {
      giftFormErrors.displayImageUrl = 'Display image is required'
      return
    }

    let effectUrl: string | null | undefined
    if (effectAssetMode.value === 'url') {
      effectUrl = giftForm.effectUrl.trim() || null
    } else if (effectFile.value) {
      effectUrl = await uploadAdminCatalogAsset({ domain: 'gift', role: 'effect', file: effectFile.value })
    } else {
      effectUrl = editGift.value.effectUrl
    }

    await giftAdminApi.patchGift(editGift.value.id, {
      name: giftForm.name.trim(),
      code: giftForm.code.trim(),
      coinCost: Number(giftForm.coinCost),
      displayImageUrl,
      effectUrl,
      categoryId: giftForm.categoryId || null,
      displayOrder: Number(giftForm.displayOrder),
      vipOnly: giftForm.vipOnly,
      isActive: giftForm.isActive,
    })
    showToast('Gift updated', 'success')
    editGift.value = null
    catalogGiftsForPicker.value = []
    await loadGifts(giftsPage.value)
  } finally {
    acting.value = false
    uploading.value = false
  }
}

async function toggleGift(gift: GiftAdminListItem) {
  await giftAdminApi.patchGift(gift.id, { isActive: gift.status !== 'active' })
  showToast(gift.status === 'active' ? 'Gift disabled' : 'Gift enabled', 'success')
  await loadGifts(giftsPage.value)
}

async function confirmDeleteGift() {
  if (!deleteGiftId.value) return
  await giftAdminApi.deleteGift(deleteGiftId.value)
  showToast('Gift deleted', 'success')
  deleteGiftId.value = null
  await Promise.all([loadGifts(giftsPage.value), loadAnalytics()])
}

async function submitCreateCategory() {
  categoryFormErrors.name = ''
  categoryFormErrors.slug = ''
  if (!categoryForm.name.trim()) {
    categoryFormErrors.name = 'Name is required'
    showToast('Category name is required', 'error')
    return
  }
  const slug = categoryForm.slug.trim() || categoryForm.name.trim().toLowerCase().replace(/\s+/g, '-')
  if (!CATEGORY_SLUG_PATTERN.test(slug)) {
    categoryFormErrors.slug = 'Lowercase slug: letters, numbers, hyphens, underscores'
    showToast('Invalid slug format', 'error')
    return
  }
  acting.value = true
  try {
    await giftAdminApi.createCategory({ name: categoryForm.name.trim(), slug })
    showToast('Category created', 'success')
    createCategoryOpen.value = false
    categoryForm.name = ''
    categoryForm.slug = ''
    await loadCategories()
  } finally {
    acting.value = false
  }
}

async function toggleCategory(cat: GiftCategoryAdmin) {
  await giftAdminApi.patchCategory(cat.id, { isActive: cat.status !== 'active' })
  showToast('Category updated', 'success')
  await loadCategories()
}

async function submitCreateGallery() {
  galleryFormErrors.name = ''
  galleryFormErrors.displayOrder = ''
  if (!galleryForm.name.trim()) {
    galleryFormErrors.name = 'Name is required'
    showToast('Section name is required', 'error')
    return
  }
  const orderErr = validateNonNegativeInt(galleryForm.displayOrder, 'Display order')
  if (orderErr) {
    galleryFormErrors.displayOrder = orderErr
    showToast(orderErr, 'error')
    return
  }
  acting.value = true
  try {
    await giftAdminApi.createGalleryCategory({
      name: galleryForm.name.trim(),
      displayOrder: Number(galleryForm.displayOrder),
    })
    showToast('Gallery section created', 'success')
    createGalleryOpen.value = false
    galleryForm.name = ''
    galleryForm.displayOrder = 0
    await loadGallery()
  } finally {
    acting.value = false
  }
}

async function toggleGallery(section: GalleryCategoryAdmin) {
  await giftAdminApi.patchGalleryCategory(section.id, { isActive: section.status !== 'active' })
  showToast('Gallery section updated', 'success')
  await loadGallery()
}

async function openManageGallery(section: GalleryCategoryAdmin) {
  manageGalleryOpen.value = section
  gallerySelectedGiftIds.value = section.gifts?.map((g) => g.giftId) ?? []
  galleryGiftPickerId.value = ''
  galleryFormError.value = ''
  await loadCatalogGiftsForPicker()
}

function addGalleryGiftFromPicker() {
  galleryFormError.value = ''
  const id = galleryGiftPickerId.value
  if (!id) {
    galleryFormError.value = 'Select a gift to add'
    return
  }
  if (gallerySelectedGiftIds.value.includes(id)) {
    galleryFormError.value = 'Gift is already in this section'
    return
  }
  gallerySelectedGiftIds.value.push(id)
  galleryGiftPickerId.value = ''
}

function removeGalleryGift(giftId: string) {
  gallerySelectedGiftIds.value = gallerySelectedGiftIds.value.filter((id) => id !== giftId)
}

async function submitManageGalleryGifts() {
  if (!manageGalleryOpen.value) return
  galleryFormError.value = ''

  const existingIds = new Set(manageGalleryOpen.value.gifts?.map((g) => g.giftId) ?? [])
  const selectedIds = new Set(gallerySelectedGiftIds.value)
  const toAdd = [...selectedIds].filter((id) => !existingIds.has(id))
  const toRemove = [...existingIds].filter((id) => !selectedIds.has(id))

  if (!toAdd.length && !toRemove.length) {
    manageGalleryOpen.value = null
    return
  }

  acting.value = true
  try {
    if (toRemove.length) {
      await giftAdminApi.removeGiftsFromGallery(manageGalleryOpen.value.id, toRemove)
    }
    if (toAdd.length) {
      await giftAdminApi.addGiftsToGallery(manageGalleryOpen.value.id, toAdd)
    }
    const parts: string[] = []
    if (toAdd.length) parts.push(`added ${toAdd.length}`)
    if (toRemove.length) parts.push(`removed ${toRemove.length}`)
    showToast(`Gallery gifts ${parts.join(', ')}`, 'success')
    manageGalleryOpen.value = null
    await loadGallery()
  } finally {
    acting.value = false
  }
}

async function confirmDeleteGallery() {
  if (!deleteGalleryId.value) return
  await giftAdminApi.deleteGalleryCategory(deleteGalleryId.value)
  showToast('Gallery section deleted', 'success')
  deleteGalleryId.value = null
  await loadGallery()
}

const {
  sortKey: giftsSortKey,
  sortDir: giftsSortDir,
  sortedRows: sortedGifts,
  toggleSort: toggleGiftsSort,
} = useSortableRows(gifts, (gift, key) => {
  switch (key) {
    case 'name':
      return gift.name?.toLowerCase() ?? ''
    case 'code':
      return gift.code?.toLowerCase() ?? ''
    case 'category':
      return (gift.category?.name || '').toLowerCase()
    case 'coinCost':
      return gift.coinCost ?? 0
    case 'timesSent':
      return gift.timesSent ?? 0
    case 'vipOnly':
      return gift.vipOnly ? 1 : 0
    case 'status':
      return gift.status ?? ''
    default:
      return undefined
  }
})

const {
  sortKey: categoriesSortKey,
  sortDir: categoriesSortDir,
  sortedRows: sortedCategories,
  toggleSort: toggleCategoriesSort,
} = useSortableRows(categories, (cat, key) => {
  switch (key) {
    case 'name':
      return cat.name?.toLowerCase() ?? ''
    case 'slug':
      return cat.slug?.toLowerCase() ?? ''
    case 'displayOrder':
      return cat.displayOrder ?? 0
    case 'giftCount':
      return cat.giftCount ?? 0
    case 'status':
      return cat.status ?? ''
    case 'createdAt':
      return cat.createdAt ? new Date(cat.createdAt).getTime() : 0
    default:
      return undefined
  }
})

const {
  sortKey: gallerySlotsSortKey,
  sortDir: gallerySlotsSortDir,
  sortedRows: sortedGallerySlots,
  toggleSort: toggleGallerySlotsSort,
} = useSortableRows(allGallerySlots, (g, key) => {
  switch (key) {
    case 'name':
      return g.name?.toLowerCase() ?? ''
    case 'code':
      return g.code?.toLowerCase() ?? ''
    case 'sectionName':
      return g.sectionName?.toLowerCase() ?? ''
    case 'coinCost':
      return g.coinCost ?? 0
    case 'isActive':
      return g.isActive === false ? 0 : 1
    default:
      return undefined
  }
})

function formatChange(value: number | null) {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}

onMounted(async () => {
  await Promise.all([loadAnalytics(), loadGifts(), loadCategories(), loadGallery()])
})
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Gift Management</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Analytics, catalog, categories, and gift gallery (SUPER_ADMIN)
      </p>
    </div>

    <!-- Analytics -->
    <div class="admin-stats-grid">
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Total Gifts</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ loadingAnalytics ? '…' : formatNumber(analytics?.totalGifts ?? 0) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Active</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-admin-success">
          {{ formatNumber(analytics?.totalActiveGifts ?? 0) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Disabled</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-admin-warn">
          {{ formatNumber(analytics?.totalDisabledGifts ?? 0) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Sent Today</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ formatNumber(analytics?.totalGiftsSentToday ?? 0) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Today Revenue</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">
          {{ formatCoins(analytics?.todayGiftRevenue ?? 0) }}
        </p>
        <p
          class="text-xs"
          :class="{
            'text-admin-success': (analytics?.todayGiftRevenueChangePercent ?? 0) > 0,
            'text-admin-danger': (analytics?.todayGiftRevenueChangePercent ?? 0) < 0,
          }"
        >
          {{ formatChange(analytics?.todayGiftRevenueChangePercent ?? null) }} vs yesterday
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Month Revenue</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">
          {{ formatCoins(analytics?.monthGiftRevenue ?? 0) }}
        </p>
      </div>
    </div>

    <div v-if="mostSent.length" class="admin-card">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-subtext">Most Sent</h2>
      <div class="flex flex-wrap gap-3">
        <div
          v-for="g in mostSent"
          :key="g.giftId"
          class="flex items-center gap-3 rounded-md border border-admin-border bg-admin-bg/40 px-3 py-2"
        >
          <img :src="g.displayImageUrl" :alt="g.name" class="h-10 w-10 rounded object-cover" />
          <div>
            <p class="text-sm font-medium">{{ g.name }}</p>
            <p class="text-xs text-admin-subtext">
              {{ formatNumber(g.timesSent) }} sends · {{ formatCoins(g.revenue) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="admin-card">
      <div class="mb-4 flex flex-col gap-3 border-b border-admin-border pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex w-full gap-1 rounded-lg bg-admin-bg p-1 sm:w-auto">
          <button
            v-for="t in [
              { id: 'catalog', label: 'Catalog' },
              { id: 'categories', label: 'Categories' },
              { id: 'gallery', label: 'Gallery' },
            ]"
            :key="t.id"
            type="button"
            :class="[
              'min-w-0 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
              tab === t.id ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="tab = t.id as typeof tab"
          >
            {{ t.label }}
          </button>
        </div>
        <button
          v-if="tab === 'catalog'"
          type="button"
          class="admin-btn-primary w-full text-sm sm:w-auto"
          @click="openCreateGift"
        >
          Create Gift
        </button>
        <button
          v-else-if="tab === 'categories'"
          type="button"
          class="admin-btn-primary w-full text-sm sm:w-auto"
          @click="createCategoryOpen = true"
        >
          Create Category
        </button>
        <button
          v-else
          type="button"
          class="admin-btn-primary w-full text-sm sm:w-auto"
          @click="createGalleryOpen = true"
        >
          Create Gallery Section
        </button>
      </div>

      <!-- Catalog -->
      <div v-show="tab === 'catalog'">
        <div class="mb-4 flex flex-wrap gap-2">
          <input
            v-model="giftFilters.search"
            type="text"
            class="admin-input min-w-0 w-full flex-1 sm:min-w-[160px]"
            placeholder="Search name or code…"
            @keydown.enter="loadGifts(1)"
          />
          <select v-model="giftFilters.status" class="admin-input w-auto" @change="loadGifts(1)">
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <select v-model="giftFilters.categoryId" class="admin-input w-auto" @change="loadGifts(1)">
            <option value="">All categories</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <input v-model="giftFilters.minPrice" type="number" class="admin-input w-28" placeholder="Min ₵" />
          <input v-model="giftFilters.maxPrice" type="number" class="admin-input w-28" placeholder="Max ₵" />
          <button type="button" class="admin-btn-primary" :disabled="loadingGifts" @click="loadGifts(1)">
            Search
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Gift" sort-key="name" :active-key="giftsSortKey" :direction="giftsSortDir" @sort="toggleGiftsSort" />
                <SortableTh label="Code" sort-key="code" :active-key="giftsSortKey" :direction="giftsSortDir" @sort="toggleGiftsSort" />
                <SortableTh label="Category" sort-key="category" :active-key="giftsSortKey" :direction="giftsSortDir" @sort="toggleGiftsSort" />
                <SortableTh label="Price" sort-key="coinCost" :active-key="giftsSortKey" :direction="giftsSortDir" @sort="toggleGiftsSort" />
                <SortableTh label="Sent" sort-key="timesSent" :active-key="giftsSortKey" :direction="giftsSortDir" @sort="toggleGiftsSort" />
                <SortableTh label="VIP" sort-key="vipOnly" :active-key="giftsSortKey" :direction="giftsSortDir" @sort="toggleGiftsSort" />
                <SortableTh label="Status" sort-key="status" :active-key="giftsSortKey" :direction="giftsSortDir" @sort="toggleGiftsSort" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="gift in sortedGifts" :key="gift.id">
                <td>
                  <div class="flex items-center gap-3">
                    <img :src="gift.displayImageUrl" :alt="gift.name" class="h-10 w-10 rounded object-cover" />
                    <div>
                      <p class="font-medium">{{ gift.name }}</p>
                      <p class="text-xs text-admin-muted">Order {{ gift.displayOrder }}</p>
                    </div>
                  </div>
                </td>
                <td class="font-mono text-xs">{{ gift.code }}</td>
                <td class="text-sm">{{ gift.category?.name ?? '—' }}</td>
                <td class="tabular-nums">{{ formatCoins(gift.coinCost) }}</td>
                <td class="tabular-nums">{{ formatNumber(gift.timesSent) }}</td>
                <td>
                  <span v-if="gift.vipOnly" class="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">VIP</span>
                  <span v-else class="text-admin-muted">—</span>
                </td>
                <td>
                  <StatusBadge :status="gift.status === 'active' ? 'active' : 'inactive'" />
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <button type="button" class="admin-btn-secondary py-1 text-xs" @click="openEditGift(gift)">
                      Edit
                    </button>
                    <button type="button" class="admin-btn-secondary py-1 text-xs" @click="toggleGift(gift)">
                      {{ gift.status === 'active' ? 'Disable' : 'Enable' }}
                    </button>
                    <button type="button" class="admin-btn-danger py-1 text-xs" @click="deleteGiftId = gift.id">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!gifts.length && !loadingGifts">
                <td colspan="8" class="py-10 text-center text-admin-muted">No gifts found</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination mt-4">
          <span>{{ giftsTotal }} total</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="giftsPage <= 1"
              @click="loadGifts(giftsPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="giftsPage * giftsLimit >= giftsTotal"
              @click="loadGifts(giftsPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Categories -->
      <div v-show="tab === 'categories'">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Name" sort-key="name" :active-key="categoriesSortKey" :direction="categoriesSortDir" @sort="toggleCategoriesSort" />
                <SortableTh label="Slug" sort-key="slug" :active-key="categoriesSortKey" :direction="categoriesSortDir" @sort="toggleCategoriesSort" />
                <SortableTh label="Order" sort-key="displayOrder" :active-key="categoriesSortKey" :direction="categoriesSortDir" @sort="toggleCategoriesSort" />
                <SortableTh label="Gifts" sort-key="giftCount" :active-key="categoriesSortKey" :direction="categoriesSortDir" @sort="toggleCategoriesSort" />
                <SortableTh label="Status" sort-key="status" :active-key="categoriesSortKey" :direction="categoriesSortDir" @sort="toggleCategoriesSort" />
                <SortableTh label="Created" sort-key="createdAt" :active-key="categoriesSortKey" :direction="categoriesSortDir" @sort="toggleCategoriesSort" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cat in sortedCategories" :key="cat.id">
                <td class="font-medium">{{ cat.name }}</td>
                <td class="font-mono text-xs">{{ cat.slug }}</td>
                <td class="tabular-nums">{{ cat.displayOrder }}</td>
                <td class="tabular-nums">{{ cat.giftCount }}</td>
                <td>
                  <StatusBadge :status="cat.status === 'active' ? 'active' : 'inactive'" />
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ format(new Date(cat.createdAt), 'dd MMM yyyy') }}
                </td>
                <td>
                  <button type="button" class="admin-btn-secondary py-1 text-xs" @click="toggleCategory(cat)">
                    {{ cat.status === 'active' ? 'Hide' : 'Show' }}
                  </button>
                </td>
              </tr>
              <tr v-if="!categories.length && !loadingCategories">
                <td colspan="7" class="py-10 text-center text-admin-muted">No categories</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Gallery -->
      <div v-show="tab === 'gallery'" class="space-y-4">
        <div class="rounded-md border border-admin-border bg-admin-bg/30 p-3 text-sm">
          <p class="font-medium">
            {{ galleryPeriodLabel() }}
            · {{ gallery.length }} section{{ gallery.length === 1 ? '' : 's' }}
            · {{ gallerySlotCount }} gift slot{{ gallerySlotCount === 1 ? '' : 's' }}
          </p>
          <p class="mt-1 text-xs text-admin-muted">
            This is the live monthly template the app uses. Hide only conceals a section in the app;
            Delete removes its slots (and host progress for those slots). Catalog gifts stay.
          </p>
        </div>

        <div v-if="allGallerySlots.length" class="rounded-md border border-admin-border p-4">
          <p class="mb-3 text-xs font-medium uppercase tracking-wide text-admin-subtext">
            All gifts in this month ({{ allGallerySlots.length }})
          </p>
          <div class="overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <SortableTh label="Gift" sort-key="name" :active-key="gallerySlotsSortKey" :direction="gallerySlotsSortDir" @sort="toggleGallerySlotsSort" />
                  <SortableTh label="Code" sort-key="code" :active-key="gallerySlotsSortKey" :direction="gallerySlotsSortDir" @sort="toggleGallerySlotsSort" />
                  <SortableTh label="Section" sort-key="sectionName" :active-key="gallerySlotsSortKey" :direction="gallerySlotsSortDir" @sort="toggleGallerySlotsSort" />
                  <SortableTh label="Cost" sort-key="coinCost" :active-key="gallerySlotsSortKey" :direction="gallerySlotsSortDir" @sort="toggleGallerySlotsSort" />
                  <SortableTh label="Catalog" sort-key="isActive" :active-key="gallerySlotsSortKey" :direction="gallerySlotsSortDir" @sort="toggleGallerySlotsSort" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="g in sortedGallerySlots" :key="g.itemId">
                  <td>
                    <div class="flex items-center gap-2">
                      <img :src="g.displayImageUrl" :alt="g.name" class="h-8 w-8 rounded object-cover" />
                      <span class="font-medium">{{ g.name }}</span>
                    </div>
                  </td>
                  <td class="font-mono text-xs">{{ g.code }}</td>
                  <td>
                    {{ g.sectionName }}
                    <span v-if="g.sectionStatus === 'hidden'" class="ml-1 text-[10px] uppercase text-admin-warn">
                      hidden
                    </span>
                  </td>
                  <td class="tabular-nums">{{ formatCoins(g.coinCost) }}</td>
                  <td>
                    <StatusBadge :status="g.isActive === false ? 'inactive' : 'active'" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div
          v-for="section in gallery"
          :key="section.id"
          class="rounded-md border border-admin-border p-4"
        >
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-medium">{{ section.name }}</h3>
                <StatusBadge :status="section.status === 'active' ? 'active' : 'inactive'" />
              </div>
              <p class="text-xs text-admin-subtext">
                {{ section.gifts?.length ?? section.giftCount }} gift slot{{
                  (section.gifts?.length ?? section.giftCount) === 1 ? '' : 's'
                }}
                · order {{ section.displayOrder }}
                <span v-if="section.status === 'hidden'" class="text-admin-warn">
                  · hidden from app, slots still count until deleted
                </span>
              </p>
            </div>
            <div class="flex flex-wrap gap-1">
              <button type="button" class="admin-btn-primary py-1 text-xs" @click="openManageGallery(section)">
                Manage Gifts
              </button>
              <button type="button" class="admin-btn-secondary py-1 text-xs" @click="toggleGallery(section)">
                {{ section.status === 'active' ? 'Hide from app' : 'Show in app' }}
              </button>
              <button type="button" class="admin-btn-danger py-1 text-xs" @click="deleteGalleryId = section.id">
                Delete
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="g in section.gifts"
              :key="g.itemId"
              class="flex items-center gap-2 rounded border border-admin-border/60 bg-admin-bg/40 px-2 py-1.5"
            >
              <img :src="g.displayImageUrl" :alt="g.name" class="h-8 w-8 rounded object-cover" />
              <div>
                <p class="text-xs font-medium">{{ g.name }}</p>
                <p class="font-mono text-[10px] text-admin-muted">{{ g.code }} · {{ formatCoins(g.coinCost) }}</p>
              </div>
            </div>
            <p v-if="!section.gifts?.length" class="text-xs text-admin-muted">No gifts in this section</p>
          </div>
        </div>
        <p v-if="!gallery.length && !loadingGallery" class="py-8 text-center text-admin-muted">
          No gallery sections
        </p>
      </div>
    </div>

    <!-- Create / Edit gift dialog -->
    <BaseDialog
      :open="createGiftOpen || !!editGift"
      :title="editGift ? 'Edit Gift' : 'Create Gift'"
      size="lg"
      @close="createGiftOpen = false; editGift = null"
    >
      <template #body>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Name <span class="text-admin-danger">*</span></label>
            <input v-model="giftForm.name" class="admin-input" :class="{ 'border-admin-danger': giftFormErrors.name }" />
            <p v-if="giftFormErrors.name" class="mt-1 text-xs text-admin-danger">{{ giftFormErrors.name }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Code <span class="text-admin-danger">*</span></label>
            <input
              v-model="giftForm.code"
              class="admin-input font-mono"
              :class="{ 'border-admin-danger': giftFormErrors.code }"
              placeholder="rose-gift"
            />
            <p v-if="giftFormErrors.code" class="mt-1 text-xs text-admin-danger">{{ giftFormErrors.code }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Coin cost <span class="text-admin-danger">*</span></label>
            <input
              v-model.number="giftForm.coinCost"
              type="number"
              min="1"
              class="admin-input"
              :class="{ 'border-admin-danger': giftFormErrors.coinCost }"
            />
            <p v-if="giftFormErrors.coinCost" class="mt-1 text-xs text-admin-danger">{{ giftFormErrors.coinCost }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Category</label>
            <select v-model="giftForm.categoryId" class="admin-input">
              <option value="">None</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <CatalogAssetField
              label="Display image"
              :mode="displayAssetMode"
              :url="giftForm.displayImageUrl"
              :file="displayFile"
              domain="gift"
              :accept="GIFT_ASSET_ACCEPT"
              required
              :error="giftFormErrors.displayImageUrl"
              :existing-url="editGift?.displayImageUrl"
              @update:mode="displayAssetMode = $event"
              @update:url="giftForm.displayImageUrl = $event"
              @update:file="displayFile = $event"
            />
          </div>
          <div class="sm:col-span-2">
            <CatalogAssetField
              label="Effect animation"
              :mode="effectAssetMode"
              :url="giftForm.effectUrl"
              :file="effectFile"
              domain="gift"
              :accept="GIFT_ASSET_ACCEPT"
              optional
              :error="giftFormErrors.effectUrl"
              :existing-url="editGift?.effectUrl"
              @update:mode="effectAssetMode = $event"
              @update:url="giftForm.effectUrl = $event"
              @update:file="effectFile = $event"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Display order</label>
            <input
              v-model.number="giftForm.displayOrder"
              type="number"
              min="0"
              class="admin-input"
              :class="{ 'border-admin-danger': giftFormErrors.displayOrder }"
            />
            <p v-if="giftFormErrors.displayOrder" class="mt-1 text-xs text-admin-danger">
              {{ giftFormErrors.displayOrder }}
            </p>
          </div>
          <div class="flex items-end gap-4 pb-2">
            <label class="flex items-center gap-2 text-sm">
              <input v-model="giftForm.vipOnly" type="checkbox" class="accent-admin-accent" />
              VIP only
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="giftForm.isActive" type="checkbox" class="accent-admin-accent" />
              Active
            </label>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="createGiftOpen = false; editGift = null">
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting || uploading"
          @click="editGift ? submitEditGift() : submitCreateGift()"
        >
          {{ uploading ? 'Uploading…' : editGift ? 'Save' : 'Create' }}
        </button>
      </template>
    </BaseDialog>

    <BaseDialog :open="createCategoryOpen" title="Create Category" @close="createCategoryOpen = false">
      <template #body>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Name <span class="text-admin-danger">*</span></label>
            <input
              v-model="categoryForm.name"
              class="admin-input"
              :class="{ 'border-admin-danger': categoryFormErrors.name }"
            />
            <p v-if="categoryFormErrors.name" class="mt-1 text-xs text-admin-danger">{{ categoryFormErrors.name }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Slug (optional)</label>
            <input
              v-model="categoryForm.slug"
              class="admin-input font-mono"
              :class="{ 'border-admin-danger': categoryFormErrors.slug }"
              placeholder="featured"
            />
            <p v-if="categoryFormErrors.slug" class="mt-1 text-xs text-admin-danger">{{ categoryFormErrors.slug }}</p>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="createCategoryOpen = false">Cancel</button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting || !categoryForm.name.trim()"
          @click="submitCreateCategory"
        >
          Create
        </button>
      </template>
    </BaseDialog>

    <BaseDialog :open="createGalleryOpen" title="Create Gallery Section" @close="createGalleryOpen = false">
      <template #body>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Name <span class="text-admin-danger">*</span></label>
            <input
              v-model="galleryForm.name"
              class="admin-input"
              :class="{ 'border-admin-danger': galleryFormErrors.name }"
            />
            <p v-if="galleryFormErrors.name" class="mt-1 text-xs text-admin-danger">{{ galleryFormErrors.name }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Display order</label>
            <input
              v-model.number="galleryForm.displayOrder"
              type="number"
              min="0"
              class="admin-input"
              :class="{ 'border-admin-danger': galleryFormErrors.displayOrder }"
            />
            <p v-if="galleryFormErrors.displayOrder" class="mt-1 text-xs text-admin-danger">
              {{ galleryFormErrors.displayOrder }}
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="createGalleryOpen = false">Cancel</button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting || !galleryForm.name.trim()"
          @click="submitCreateGallery"
        >
          Create
        </button>
      </template>
    </BaseDialog>

    <BaseDialog
      :open="!!manageGalleryOpen"
      title="Manage Gallery Gifts"
      size="lg"
      @close="manageGalleryOpen = null"
    >
      <template #body>
        <p class="mb-3 text-sm text-admin-subtext">
          Section: <strong>{{ manageGalleryOpen?.name }}</strong>
        </p>
        <p class="mb-3 text-xs text-admin-muted">
          Removing a gift unlinks it from this month’s gallery template. Host progress for that
          slot is deleted. The catalog gift itself is not deleted.
        </p>

        <div v-if="loadingCatalogGifts" class="mb-3 text-sm text-admin-muted">Loading gifts…</div>

        <div class="mb-4 flex flex-wrap gap-2">
          <select v-model="galleryGiftPickerId" class="admin-input min-w-0 w-full flex-1 sm:min-w-[200px]">
            <option value="">Select a gift to add…</option>
            <option v-for="g in galleryAvailableGiftOptions" :key="g.id" :value="g.id">
              {{ g.name }} ({{ g.code }}) — {{ formatCoins(g.coinCost) }}
            </option>
          </select>
          <button
            type="button"
            class="admin-btn-secondary"
            :disabled="!galleryGiftPickerId"
            @click="addGalleryGiftFromPicker"
          >
            Add
          </button>
        </div>

        <p v-if="galleryFormError" class="mb-3 text-xs text-admin-danger">{{ galleryFormError }}</p>

        <div class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-admin-subtext">
            Selected gifts ({{ gallerySelectedGifts.length }})
          </p>
          <div v-if="gallerySelectedGifts.length" class="flex flex-wrap gap-2">
            <div
              v-for="g in gallerySelectedGifts"
              :key="g.id"
              class="flex items-center gap-2 rounded border border-admin-border bg-admin-bg/40 px-2 py-1.5"
            >
              <img :src="g.displayImageUrl" :alt="g.name" class="h-8 w-8 rounded object-cover" />
              <div class="min-w-0">
                <p class="truncate text-xs font-medium">{{ g.name }}</p>
                <p class="font-mono text-[10px] text-admin-muted">{{ g.code }}</p>
              </div>
              <button
                type="button"
                class="ml-1 rounded px-1.5 py-0.5 text-xs text-admin-danger hover:bg-admin-danger/10"
                title="Remove from selection"
                @click="removeGalleryGift(g.id)"
              >
                ×
              </button>
            </div>
          </div>
          <p v-else class="text-xs text-admin-muted">No gifts selected</p>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="manageGalleryOpen = null">Cancel</button>
        <button type="button" class="admin-btn-primary" :disabled="acting" @click="submitManageGalleryGifts">
          Save changes
        </button>
      </template>
    </BaseDialog>

    <ConfirmActionDialog
      :open="!!deleteGiftId"
      title="Delete Gift"
      message="This permanently deletes the gift from the catalog."
      confirm-label="Delete"
      variant="danger"
      @close="deleteGiftId = null"
      @confirm="confirmDeleteGift"
    />

    <ConfirmActionDialog
      :open="!!deleteGalleryId"
      title="Delete Gallery Section"
      :message="deleteGalleryMessage"
      confirm-label="Delete"
      variant="danger"
      @close="deleteGalleryId = null"
      @confirm="confirmDeleteGallery"
    />
  </div>
</template>
