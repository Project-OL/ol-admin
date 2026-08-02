<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { adminViewsApi } from '@/api/adminViews'
import type { AdminViewCatalogItem } from '@/types/adminViews'
import type { CsaAdmin } from '@/types/customerSupport'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import { VIEW_COMPANIONS, withCompanionViews } from '@/constants/viewRoutes'
import { showToast } from '@/utils/toast'

type CsaTarget = Pick<CsaAdmin, 'id' | 'name' | 'email'>

const props = defineProps<{
  open: boolean
  csa: CsaTarget | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const loading = ref(false)
const acting = ref(false)
const catalog = ref<AdminViewCatalogItem[]>([])
const selected = ref<Set<string>>(new Set())
const search = ref('')

const filteredCatalog = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return catalog.value
  return catalog.value.filter((v) => v.name.toLowerCase().includes(q))
})

const selectedCount = computed(() => selected.value.size)

function toggle(name: string) {
  const next = new Set(selected.value)
  if (next.has(name)) {
    next.delete(name)
    for (const companion of VIEW_COMPANIONS[name] ?? []) {
      next.delete(companion)
    }
  } else {
    next.add(name)
    for (const companion of VIEW_COMPANIONS[name] ?? []) {
      next.add(companion)
    }
  }
  selected.value = next
}

function selectAll() {
  selected.value = new Set(filteredCatalog.value.map((v) => v.name))
}

function clearAll() {
  selected.value = new Set()
}

async function load() {
  if (!props.csa) return
  loading.value = true
  try {
    const [catalogRes, assignedRes] = await Promise.all([
      adminViewsApi.listCatalog(),
      adminViewsApi.getCsaViews(props.csa.id),
    ])
    catalog.value = catalogRes.data.views ?? []
    selected.value = new Set((assignedRes.data.views ?? []).map((v) => v.name))
  } catch {
    showToast('Failed to load views for this CSA', 'error')
    emit('close')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!props.csa) return
  acting.value = true
  try {
    await adminViewsApi.assignCsaViews(props.csa.id, {
      views: withCompanionViews(selected.value),
    })
    const assignedCount = withCompanionViews(selected.value).length
    showToast(
      assignedCount
        ? `Assigned ${assignedCount} view(s) to ${props.csa.name}`
        : `Cleared view assignments for ${props.csa.name} (legacy role access)`,
      'success',
    )
    emit('saved')
    emit('close')
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Failed to assign views'
    showToast(msg, 'error')
  } finally {
    acting.value = false
  }
}

watch(
  () => [props.open, props.csa?.id] as const,
  ([isOpen]) => {
    if (isOpen && props.csa) {
      search.value = ''
      void load()
    }
  },
)
</script>

<template>
  <BaseDialog
    :open="open"
    :title="csa ? `Assign views — ${csa.name}` : 'Assign views'"
    size="lg"
    @close="emit('close')"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-admin-subtext">
          Checked views replace the CSA’s entire set. Empty selection clears assignments and
          restores legacy role-based access. Selecting a workbench (e.g. CustomerSupportView)
          also includes its detail view (SupportTicketDetailView) so ticket routes work.
        </p>
        <p v-if="csa" class="text-xs text-admin-muted">{{ csa.email }}</p>

        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="search"
            type="search"
            class="admin-input min-w-[12rem] flex-1"
            placeholder="Filter views…"
            :disabled="loading"
          />
          <button type="button" class="admin-btn-secondary text-xs" :disabled="loading" @click="selectAll">
            Select filtered
          </button>
          <button type="button" class="admin-btn-secondary text-xs" :disabled="loading" @click="clearAll">
            Clear all
          </button>
        </div>

        <div
          v-if="loading"
          class="py-10 text-center text-sm text-admin-subtext"
        >
          Loading…
        </div>
        <div
          v-else
          class="max-h-72 space-y-1 overflow-y-auto rounded-md border border-admin-border p-2"
        >
          <label
            v-for="view in filteredCatalog"
            :key="view.name"
            class="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-admin-bg"
          >
            <input
              type="checkbox"
              class="mt-1"
              :checked="selected.has(view.name)"
              @change="toggle(view.name)"
            />
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-admin-text">{{ view.name }}</span>
                <span
                  class="rounded bg-admin-bg px-1.5 py-0.5 text-xs tabular-nums text-admin-subtext"
                  :title="'Admins currently assigned'"
                >
                  {{ view.assignedAdminCount }} assigned
                </span>
              </span>
              <span class="mt-0.5 block text-xs text-admin-muted">
                {{ view.endpoints.length }} endpoint{{ view.endpoints.length === 1 ? '' : 's' }}
              </span>
            </span>
          </label>
          <p
            v-if="!filteredCatalog.length"
            class="py-6 text-center text-sm text-admin-muted"
          >
            No views match
          </p>
        </div>

        <p class="text-sm text-admin-subtext">{{ selectedCount }} selected</p>
      </div>
    </template>
    <template #footer>
      <button type="button" class="admin-btn-secondary" @click="emit('close')">Cancel</button>
      <button type="button" class="admin-btn-primary" :disabled="loading || acting" @click="save">
        {{ acting ? 'Saving…' : 'Save assignments' }}
      </button>
    </template>
  </BaseDialog>
</template>
