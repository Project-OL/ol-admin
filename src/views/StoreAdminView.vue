<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { format } from 'date-fns'
import { uploadAdminCatalogAsset } from '@/api/catalogAssetUpload'
import { storeAdminApi } from '@/api/storeAdmin'
import type {
  CreateStoreItemPayload,
  StoreAdminListItem,
  StoreAnalytics,
  StoreItemCategory,
  UserStoreSummary,
} from '@/types/store'
import { STORE_CATEGORIES } from '@/types/store'
import CatalogAssetField from '@/components/shared/CatalogAssetField.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import { formatCoins, formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'
import {
  STORE_ASSET_ACCEPT,
  isValidHttpUrl,
  validateNonNegativeInt,
  validatePositiveInt,
} from '@/utils/catalogValidation'

const tab = ref<'catalog' | 'users'>('catalog')
const analytics = ref<StoreAnalytics | null>(null)
const loadingAnalytics = ref(false)

const items = ref<StoreAdminListItem[]>([])
const itemsTotal = ref(0)
const itemsPage = ref(1)
const itemsLimit = 20
const loadingItems = ref(false)
const filters = reactive({
  status: 'all' as 'all' | 'active' | 'disabled',
  category: '' as '' | StoreItemCategory,
  search: '',
  minPrice: '',
  maxPrice: '',
})

const createOpen = ref(false)
const editItem = ref<StoreAdminListItem | null>(null)
const deleteItemId = ref<string | null>(null)
const acting = ref(false)
const uploading = ref(false)

const form = reactive({
  name: '',
  description: '',
  category: 'AVATAR_FRAME' as StoreItemCategory,
  coinCost: 1000,
  validityDays: 15,
  displayImageUrl: '',
  effectUrl: '',
  sortOrder: 0,
  isActive: true,
})

const displayAssetMode = ref<'url' | 'file'>('url')
const effectAssetMode = ref<'url' | 'file'>('url')
const displayFile = ref<File | null>(null)
const effectFile = ref<File | null>(null)

const formErrors = reactive({
  name: '',
  category: '',
  coinCost: '',
  validityDays: '',
  displayImageUrl: '',
  effectUrl: '',
  sortOrder: '',
})

const userQuery = ref('')
const userSearchLoading = ref(false)
const userResults = ref<
  Array<{
    userId: string
    name: string
    username?: string
    publicId?: string
    store?: UserStoreSummary
  }>
>([])
const selectedUserStore = ref<{
  userId: string
  name: string
  store: UserStoreSummary
} | null>(null)
const loadingUserStore = ref(false)

function clearFormErrors() {
  formErrors.name = ''
  formErrors.category = ''
  formErrors.coinCost = ''
  formErrors.validityDays = ''
  formErrors.displayImageUrl = ''
  formErrors.effectUrl = ''
  formErrors.sortOrder = ''
}

function resetForm() {
  form.name = ''
  form.description = ''
  form.category = 'AVATAR_FRAME'
  form.coinCost = 1000
  form.validityDays = 15
  form.displayImageUrl = ''
  form.effectUrl = ''
  form.sortOrder = 0
  form.isActive = true
  displayAssetMode.value = 'url'
  effectAssetMode.value = 'url'
  displayFile.value = null
  effectFile.value = null
  clearFormErrors()
}

function validateForm(isEdit: boolean): boolean {
  clearFormErrors()
  let valid = true

  if (!form.name.trim()) {
    formErrors.name = 'Name is required'
    valid = false
  }

  if (!form.category) {
    formErrors.category = 'Category is required'
    valid = false
  }

  const coinErr = validatePositiveInt(form.coinCost, 'Coin cost')
  if (coinErr) {
    formErrors.coinCost = coinErr
    valid = false
  }

  const validityErr = validatePositiveInt(form.validityDays, 'Validity days', { max: 365 })
  if (validityErr) {
    formErrors.validityDays = validityErr
    valid = false
  }

  const orderErr = validateNonNegativeInt(form.sortOrder, 'Sort order')
  if (orderErr) {
    formErrors.sortOrder = orderErr
    valid = false
  }

  if (displayAssetMode.value === 'url') {
    if (!form.displayImageUrl.trim()) {
      formErrors.displayImageUrl = 'Display image URL is required'
      valid = false
    } else if (!isValidHttpUrl(form.displayImageUrl)) {
      formErrors.displayImageUrl = 'Enter a valid http(s) URL'
      valid = false
    }
  } else if (!displayFile.value && !(isEdit && editItem.value?.displayImageUrl)) {
    formErrors.displayImageUrl = 'Choose a display image file'
    valid = false
  }

  if (effectAssetMode.value === 'url' && form.effectUrl.trim() && !isValidHttpUrl(form.effectUrl)) {
    formErrors.effectUrl = 'Enter a valid http(s) URL'
    valid = false
  }

  return valid
}

async function resolveStoreAssetUrl(
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
    return uploadAdminCatalogAsset({ domain: 'store', role, file })
  }
  return existingUrl ?? null
}

async function loadAnalytics() {
  loadingAnalytics.value = true
  try {
    const { data } = await storeAdminApi.getAnalytics()
    analytics.value = data
  } catch {
    /* interceptor */
  } finally {
    loadingAnalytics.value = false
  }
}

async function loadItems(page = 1) {
  loadingItems.value = true
  itemsPage.value = page
  try {
    const { data } = await storeAdminApi.listItems({
      page,
      limit: itemsLimit,
      status: filters.status,
      category: filters.category || undefined,
      search: filters.search.trim() || undefined,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
    })
    items.value = data.items
    itemsTotal.value = data.total
  } finally {
    loadingItems.value = false
  }
}

function openCreate() {
  resetForm()
  createOpen.value = true
}

function openEdit(item: StoreAdminListItem) {
  editItem.value = item
  form.name = item.name
  form.description = item.description ?? ''
  form.category = item.category
  form.coinCost = item.coinCost
  form.validityDays = item.validityDays
  form.displayImageUrl = item.displayImageUrl
  form.effectUrl = item.effectUrl ?? ''
  form.sortOrder = item.sortOrder
  form.isActive = item.status === 'active'
  displayAssetMode.value = 'url'
  effectAssetMode.value = 'url'
  displayFile.value = null
  effectFile.value = null
  clearFormErrors()
}

async function submitCreate() {
  if (!validateForm(false)) {
    showToast('Fix validation errors before saving', 'error')
    return
  }
  acting.value = true
  uploading.value = true
  try {
    const displayImageUrl = await resolveStoreAssetUrl(
      displayAssetMode.value,
      form.displayImageUrl,
      displayFile.value,
      'display',
    )
    if (!displayImageUrl) {
      formErrors.displayImageUrl = 'Display image is required'
      return
    }

    let effectUrl: string | null = null
    if (effectAssetMode.value === 'url') {
      effectUrl = form.effectUrl.trim() || null
    } else if (effectFile.value) {
      effectUrl = await uploadAdminCatalogAsset({ domain: 'store', role: 'effect', file: effectFile.value })
    }

    const payload: CreateStoreItemPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      coinCost: Number(form.coinCost),
      validityDays: Number(form.validityDays),
      displayImageUrl,
      effectUrl,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
    }
    await storeAdminApi.createItem(payload)
    showToast('Store item created', 'success')
    createOpen.value = false
    await Promise.all([loadItems(1), loadAnalytics()])
  } finally {
    acting.value = false
    uploading.value = false
  }
}

async function submitEdit() {
  if (!editItem.value) return
  if (!validateForm(true)) {
    showToast('Fix validation errors before saving', 'error')
    return
  }
  acting.value = true
  uploading.value = true
  try {
    const displayImageUrl = await resolveStoreAssetUrl(
      displayAssetMode.value,
      form.displayImageUrl,
      displayFile.value,
      'display',
      editItem.value.displayImageUrl,
    )
    if (!displayImageUrl) {
      formErrors.displayImageUrl = 'Display image is required'
      return
    }

    let effectUrl: string | null | undefined
    if (effectAssetMode.value === 'url') {
      effectUrl = form.effectUrl.trim() || null
    } else if (effectFile.value) {
      effectUrl = await uploadAdminCatalogAsset({ domain: 'store', role: 'effect', file: effectFile.value })
    } else {
      effectUrl = editItem.value.effectUrl
    }

    await storeAdminApi.patchItem(editItem.value.id, {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      coinCost: Number(form.coinCost),
      validityDays: Number(form.validityDays),
      displayImageUrl,
      effectUrl,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
    })
    showToast('Store item updated', 'success')
    editItem.value = null
    await loadItems(itemsPage.value)
  } finally {
    acting.value = false
    uploading.value = false
  }
}

async function toggleItem(item: StoreAdminListItem) {
  await storeAdminApi.patchItem(item.id, { isActive: item.status !== 'active' })
  showToast(item.status === 'active' ? 'Item disabled' : 'Item enabled', 'success')
  await loadItems(itemsPage.value)
}

async function confirmDelete() {
  if (!deleteItemId.value) return
  await storeAdminApi.deleteItem(deleteItemId.value)
  showToast('Store item deleted', 'success')
  deleteItemId.value = null
  await Promise.all([loadItems(itemsPage.value), loadAnalytics()])
}

async function searchUsers() {
  const q = userQuery.value.trim()
  if (!q) return
  userSearchLoading.value = true
  userResults.value = []
  selectedUserStore.value = null
  try {
    const { data } = await storeAdminApi.searchUsersWithStore(q)
    userResults.value = (data.users ?? []).map((u) => ({
      userId: u.userId,
      name: u.name || u.username,
      username: u.username,
      publicId: u.displayPublicId || u.publicId,
      store: (u as { store?: UserStoreSummary }).store,
    }))
    if (!userResults.value.length) showToast('No users found', 'error')
  } finally {
    userSearchLoading.value = false
  }
}

async function openUserStore(user: (typeof userResults.value)[0]) {
  loadingUserStore.value = true
  try {
    if (user.store) {
      selectedUserStore.value = { userId: user.userId, name: user.name, store: user.store }
    } else {
      const { data } = await storeAdminApi.getUserStoreItems(user.userId)
      selectedUserStore.value = { userId: user.userId, name: user.name, store: data }
    }
  } finally {
    loadingUserStore.value = false
  }
}

function categoryLabel(cat: string) {
  return cat.replace(/_/g, ' ')
}

onMounted(async () => {
  await Promise.all([loadAnalytics(), loadItems()])
})
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Store Management</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Cosmetics catalog, analytics, and user inventory (SUPER_ADMIN)
      </p>
    </div>

    <div class="admin-stats-grid">
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Total Items</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ loadingAnalytics ? '…' : formatNumber(analytics?.totalStoreItems ?? 0) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Active</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-admin-success">
          {{ formatNumber(analytics?.activeStoreItems ?? 0) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Disabled</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-admin-warn">
          {{ formatNumber(analytics?.disabledStoreItems ?? 0) }}
        </p>
      </div>
      <div class="admin-card !p-3">
        <p class="text-xs text-admin-subtext">Purchases Today</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ formatNumber(analytics?.totalPurchasesToday ?? 0) }}
        </p>
      </div>
      <div class="admin-card !p-3 col-span-2 md:col-span-3 lg:col-span-4 2xl:col-span-2">
        <p class="mb-2 text-xs text-admin-subtext">Items per type</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="row in analytics?.itemsPerType ?? []"
            :key="row.category"
            class="rounded bg-admin-bg px-2 py-1 text-xs"
          >
            {{ categoryLabel(row.category) }}: {{ row.count }}
          </span>
          <span v-if="!analytics?.itemsPerType?.length" class="text-xs text-admin-muted">—</span>
        </div>
      </div>
    </div>

    <div class="admin-card">
      <div class="mb-4 flex flex-col gap-3 border-b border-admin-border pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex w-full gap-1 rounded-lg bg-admin-bg p-1 sm:w-auto">
          <button
            type="button"
            :class="[
              'min-w-0 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
              tab === 'catalog' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="tab = 'catalog'"
          >
            Catalog
          </button>
          <button
            type="button"
            :class="[
              'min-w-0 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
              tab === 'users' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="tab = 'users'"
          >
            <span class="sm:hidden">Inventory</span>
            <span class="hidden sm:inline">User Inventory</span>
          </button>
        </div>
        <button
          v-if="tab === 'catalog'"
          type="button"
          class="admin-btn-primary w-full text-sm sm:w-auto"
          @click="openCreate"
        >
          Create Item
        </button>
      </div>

      <!-- Catalog -->
      <div v-show="tab === 'catalog'">
        <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <input
            v-model="filters.search"
            type="text"
            class="admin-input min-w-0 w-full lg:min-w-[160px] lg:flex-1"
            placeholder="Search items…"
            @keydown.enter="loadItems(1)"
          />
          <select v-model="filters.status" class="admin-input w-full lg:w-auto" @change="loadItems(1)">
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <select v-model="filters.category" class="admin-input w-full lg:w-auto" @change="loadItems(1)">
            <option value="">All categories</option>
            <option v-for="c in STORE_CATEGORIES" :key="c" :value="c">{{ categoryLabel(c) }}</option>
          </select>
          <div class="grid grid-cols-2 gap-2 sm:col-span-2 lg:flex lg:w-auto lg:gap-2">
            <input v-model="filters.minPrice" type="number" class="admin-input w-full lg:w-28" placeholder="Min ₵" />
            <input v-model="filters.maxPrice" type="number" class="admin-input w-full lg:w-28" placeholder="Max ₵" />
          </div>
          <button
            type="button"
            class="admin-btn-primary w-full sm:col-span-2 lg:w-auto"
            :disabled="loadingItems"
            @click="loadItems(1)"
          >
            Search
          </button>
        </div>

        <!-- Mobile card list -->
        <div class="space-y-3 md:hidden">
          <article
            v-for="item in items"
            :key="item.id"
            class="rounded-xl border border-admin-border bg-admin-bg/40 p-3"
          >
            <div class="flex gap-3">
              <img
                :src="item.displayImageUrl"
                :alt="item.name"
                class="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="truncate font-medium text-admin-text">{{ item.name }}</p>
                    <p class="mt-0.5 text-xs font-medium uppercase tracking-wide text-admin-accent">
                      {{ categoryLabel(item.category) }}
                    </p>
                  </div>
                  <StatusBadge :status="item.status === 'active' ? 'active' : 'inactive'" />
                </div>
                <p v-if="item.description" class="mt-1 line-clamp-2 text-xs text-admin-muted">
                  {{ item.description }}
                </p>
                <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-admin-subtext">
                  <span class="tabular-nums text-admin-text">{{ formatCoins(item.coinCost) }}</span>
                  <span>{{ item.validityDays }}d validity</span>
                  <span>{{ formatNumber(item.purchaseCount) }} buys</span>
                  <span class="whitespace-nowrap">{{ format(new Date(item.createdAt), 'dd MMM yyyy') }}</span>
                </div>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-3 gap-1.5 border-t border-admin-border/60 pt-3">
              <button type="button" class="admin-btn-secondary !px-2 py-1.5 text-xs" @click="openEdit(item)">
                Edit
              </button>
              <button type="button" class="admin-btn-secondary !px-2 py-1.5 text-xs" @click="toggleItem(item)">
                {{ item.status === 'active' ? 'Disable' : 'Enable' }}
              </button>
              <button type="button" class="admin-btn-danger !px-2 py-1.5 text-xs" @click="deleteItemId = item.id">
                Delete
              </button>
            </div>
          </article>
          <p v-if="!items.length && !loadingItems" class="py-10 text-center text-sm text-admin-muted">
            No store items found
          </p>
          <p v-if="loadingItems && !items.length" class="py-10 text-center text-sm text-admin-muted">
            Loading…
          </p>
        </div>

        <!-- Desktop / tablet table -->
        <div class="admin-table-wrap hidden md:block">
          <table class="admin-table min-w-[980px]">
            <thead>
              <tr>
                <th class="min-w-[220px]">Item</th>
                <th class="whitespace-nowrap">Category</th>
                <th class="whitespace-nowrap">Price</th>
                <th class="whitespace-nowrap">Validity</th>
                <th class="whitespace-nowrap">Purchases</th>
                <th>Status</th>
                <th class="whitespace-nowrap">Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id">
                <td>
                  <div class="flex min-w-0 items-center gap-3">
                    <img
                      :src="item.displayImageUrl"
                      :alt="item.name"
                      class="h-10 w-10 shrink-0 rounded object-cover"
                    />
                    <div class="min-w-0">
                      <p class="truncate font-medium">{{ item.name }}</p>
                      <p class="max-w-[220px] truncate text-xs text-admin-muted">
                        {{ item.description || '—' }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap text-xs capitalize">{{ categoryLabel(item.category) }}</td>
                <td class="whitespace-nowrap tabular-nums">{{ formatCoins(item.coinCost) }}</td>
                <td class="whitespace-nowrap text-sm">{{ item.validityDays }}d</td>
                <td class="tabular-nums">{{ formatNumber(item.purchaseCount) }}</td>
                <td>
                  <StatusBadge :status="item.status === 'active' ? 'active' : 'inactive'" />
                </td>
                <td class="whitespace-nowrap text-xs">
                  {{ format(new Date(item.createdAt), 'dd MMM yyyy') }}
                </td>
                <td>
                  <div class="flex flex-nowrap gap-1">
                    <button type="button" class="admin-btn-secondary py-1 text-xs" @click="openEdit(item)">
                      Edit
                    </button>
                    <button type="button" class="admin-btn-secondary py-1 text-xs" @click="toggleItem(item)">
                      {{ item.status === 'active' ? 'Disable' : 'Enable' }}
                    </button>
                    <button type="button" class="admin-btn-danger py-1 text-xs" @click="deleteItemId = item.id">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!items.length && !loadingItems">
                <td colspan="8" class="py-10 text-center text-admin-muted">No store items found</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination mt-4">
          <span>{{ itemsTotal }} total</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="itemsPage <= 1"
              @click="loadItems(itemsPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="itemsPage * itemsLimit >= itemsTotal"
              @click="loadItems(itemsPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- User inventory -->
      <div v-show="tab === 'users'" class="space-y-4">
        <div class="admin-search-row">
          <input
            v-model="userQuery"
            type="text"
            class="admin-input min-w-0 flex-1"
            placeholder="Search user by email, phone, public ID, UUID…"
            @keydown.enter="searchUsers"
          />
          <button
            type="button"
            class="admin-btn-primary w-full shrink-0 sm:w-auto"
            :disabled="userSearchLoading"
            @click="searchUsers"
          >
            {{ userSearchLoading ? 'Searching…' : 'Search' }}
          </button>
        </div>

        <div v-if="userResults.length" class="overflow-hidden rounded-md border border-admin-border">
          <button
            v-for="user in userResults"
            :key="user.userId"
            type="button"
            class="flex w-full items-center justify-between gap-3 border-b border-admin-border/50 px-3 py-3 text-left last:border-0 hover:bg-admin-bg/60 sm:px-4"
            @click="openUserStore(user)"
          >
            <div class="min-w-0">
              <p class="truncate font-medium">{{ user.name }}</p>
              <p class="truncate font-mono text-xs text-admin-subtext">
                {{ user.publicId ?? user.userId }}
              </p>
            </div>
            <span class="shrink-0 text-xs text-admin-accent">
              {{ user.store?.ownedItems?.length ?? '…' }} owned →
            </span>
          </button>
        </div>

        <div v-if="loadingUserStore" class="py-8 text-center text-admin-muted">Loading inventory…</div>

        <div v-else-if="selectedUserStore" class="space-y-4">
          <h3 class="min-w-0 font-medium">
            <span class="block truncate">Inventory — {{ selectedUserStore.name }}</span>
            <span class="mt-0.5 block break-all font-mono text-xs text-admin-subtext">
              {{ selectedUserStore.userId }}
            </span>
          </h3>

          <!-- Mobile inventory cards -->
          <div class="space-y-2 md:hidden">
            <article
              v-for="owned in selectedUserStore.store.ownedItems"
              :key="owned.userStoreItemId"
              class="rounded-xl border border-admin-border bg-admin-bg/40 p-3"
            >
              <div class="flex items-center gap-3">
                <img
                  :src="owned.item.displayImageUrl"
                  :alt="owned.item.name"
                  class="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium">{{ owned.item.name }}</p>
                  <p class="text-xs uppercase tracking-wide text-admin-accent">
                    {{ categoryLabel(owned.item.category) }}
                  </p>
                </div>
                <StatusBadge :status="owned.isActive ? 'active' : 'inactive'" />
              </div>
              <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-admin-subtext">
                <span>Paid {{ formatCoins(owned.coinsPaid) }}</span>
                <span class="whitespace-nowrap">
                  Exp {{ format(new Date(owned.expiresAt), 'dd MMM yyyy') }}
                </span>
                <span>{{ owned.isApplied ? 'Applied' : 'Not applied' }}</span>
              </div>
            </article>
            <p
              v-if="!selectedUserStore.store.ownedItems?.length"
              class="py-8 text-center text-sm text-admin-muted"
            >
              No owned store items
            </p>
          </div>

          <div class="admin-table-wrap hidden md:block">
            <table class="admin-table min-w-[720px]">
              <thead>
                <tr>
                  <th class="min-w-[180px]">Item</th>
                  <th class="whitespace-nowrap">Category</th>
                  <th class="whitespace-nowrap">Paid</th>
                  <th class="whitespace-nowrap">Expires</th>
                  <th>Applied</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="owned in selectedUserStore.store.ownedItems" :key="owned.userStoreItemId">
                  <td>
                    <div class="flex min-w-0 items-center gap-2">
                      <img
                        :src="owned.item.displayImageUrl"
                        :alt="owned.item.name"
                        class="h-8 w-8 shrink-0 rounded object-cover"
                      />
                      <span class="truncate text-sm">{{ owned.item.name }}</span>
                    </div>
                  </td>
                  <td class="whitespace-nowrap text-xs capitalize">{{ categoryLabel(owned.item.category) }}</td>
                  <td class="whitespace-nowrap tabular-nums text-sm">{{ formatCoins(owned.coinsPaid) }}</td>
                  <td class="whitespace-nowrap text-xs">
                    {{ format(new Date(owned.expiresAt), 'dd MMM yyyy HH:mm') }}
                  </td>
                  <td>
                    <StatusBadge :status="owned.isApplied ? 'active' : 'inactive'" :label="owned.isApplied ? 'Yes' : 'No'" />
                  </td>
                  <td>
                    <StatusBadge :status="owned.isActive ? 'active' : 'inactive'" />
                  </td>
                </tr>
                <tr v-if="!selectedUserStore.store.ownedItems?.length">
                  <td colspan="6" class="py-8 text-center text-admin-muted">No owned store items</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="Object.keys(selectedUserStore.store.wearingItems ?? {}).length" class="admin-card !bg-admin-bg/40">
            <h4 class="mb-2 text-xs font-semibold uppercase text-admin-subtext">Wearing</h4>
            <pre class="overflow-x-auto text-xs text-admin-subtext">{{
              JSON.stringify(selectedUserStore.store.wearingItems, null, 2)
            }}</pre>
          </div>
        </div>
      </div>
    </div>

    <BaseDialog
      :open="createOpen || !!editItem"
      :title="editItem ? 'Edit Store Item' : 'Create Store Item'"
      size="lg"
      @close="createOpen = false; editItem = null"
    >
      <template #body>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Name <span class="text-admin-danger">*</span></label>
            <input v-model="form.name" class="admin-input" :class="{ 'border-admin-danger': formErrors.name }" />
            <p v-if="formErrors.name" class="mt-1 text-xs text-admin-danger">{{ formErrors.name }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Category <span class="text-admin-danger">*</span></label>
            <select v-model="form.category" class="admin-input" :class="{ 'border-admin-danger': formErrors.category }">
              <option v-for="c in STORE_CATEGORIES" :key="c" :value="c">{{ categoryLabel(c) }}</option>
            </select>
            <p v-if="formErrors.category" class="mt-1 text-xs text-admin-danger">{{ formErrors.category }}</p>
          </div>
          <div class="sm:col-span-2">
            <label class="mb-1 block text-xs text-admin-subtext">Description</label>
            <input v-model="form.description" class="admin-input" maxlength="2000" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Coin cost <span class="text-admin-danger">*</span></label>
            <input
              v-model.number="form.coinCost"
              type="number"
              min="1"
              class="admin-input"
              :class="{ 'border-admin-danger': formErrors.coinCost }"
            />
            <p v-if="formErrors.coinCost" class="mt-1 text-xs text-admin-danger">{{ formErrors.coinCost }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Validity (days) <span class="text-admin-danger">*</span></label>
            <input
              v-model.number="form.validityDays"
              type="number"
              min="1"
              max="365"
              class="admin-input"
              :class="{ 'border-admin-danger': formErrors.validityDays }"
            />
            <p v-if="formErrors.validityDays" class="mt-1 text-xs text-admin-danger">{{ formErrors.validityDays }}</p>
          </div>
          <div class="sm:col-span-2">
            <CatalogAssetField
              label="Display image"
              :mode="displayAssetMode"
              :url="form.displayImageUrl"
              :file="displayFile"
              domain="store"
              :accept="STORE_ASSET_ACCEPT"
              required
              :error="formErrors.displayImageUrl"
              :existing-url="editItem?.displayImageUrl"
              @update:mode="displayAssetMode = $event"
              @update:url="form.displayImageUrl = $event"
              @update:file="displayFile = $event"
            />
          </div>
          <div class="sm:col-span-2">
            <CatalogAssetField
              label="Effect animation"
              :mode="effectAssetMode"
              :url="form.effectUrl"
              :file="effectFile"
              domain="store"
              :accept="STORE_ASSET_ACCEPT"
              optional
              :error="formErrors.effectUrl"
              :existing-url="editItem?.effectUrl"
              @update:mode="effectAssetMode = $event"
              @update:url="form.effectUrl = $event"
              @update:file="effectFile = $event"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Sort order</label>
            <input
              v-model.number="form.sortOrder"
              type="number"
              min="0"
              class="admin-input"
              :class="{ 'border-admin-danger': formErrors.sortOrder }"
            />
            <p v-if="formErrors.sortOrder" class="mt-1 text-xs text-admin-danger">{{ formErrors.sortOrder }}</p>
          </div>
          <div class="flex items-end pb-2">
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.isActive" type="checkbox" class="accent-admin-accent" />
              Active
            </label>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="createOpen = false; editItem = null">
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting || uploading"
          @click="editItem ? submitEdit() : submitCreate()"
        >
          {{ uploading ? 'Uploading…' : editItem ? 'Save' : 'Create' }}
        </button>
      </template>
    </BaseDialog>

    <ConfirmActionDialog
      :open="!!deleteItemId"
      title="Delete Store Item"
      message="This permanently deletes the store item from the catalog."
      confirm-label="Delete"
      variant="danger"
      :require-confirm-text="true"
      @close="deleteItemId = null"
      @confirm="confirmDelete"
    />
  </div>
</template>
