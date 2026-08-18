<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { format } from 'date-fns'
import axios from 'axios'
import { liveRestrictionsApi, isLiveEnforcedRestrictionType } from '@/api/liveRestrictions'
import { userAdminApi } from '@/api/userAdmin'
import type { ApiUserRestriction, UserRestrictionType, UserSearchItem } from '@/types/api'
import { showToast } from '@/utils/toast'

const MAX_MESSAGING_TARGETS = 100

const props = defineProps<{
  userId: string
  reportId?: string
  initialType?: UserRestrictionType
}>()

const TYPE_OPTIONS: { value: UserRestrictionType; label: string }[] = [
  { value: 'LIVE_CHAT_MUTE', label: 'Mute live chat (cannot send)' },
  { value: 'LIVE_AUDIO_MUTE', label: 'Mute live audio (cannot use mic)' },
  { value: 'MESSAGING_DISABLE', label: 'Disable messaging' },
  { value: 'LIVE_STREAM_START_BAN', label: 'Ban starting live streams' },
]

type TargetChip = { userId: string; label: string }

const active = ref<ApiUserRestriction[]>([])
const loading = ref(false)
const applying = ref(false)
const clearingId = ref<string | null>(null)

const restrictionType = ref<UserRestrictionType>(props.initialType ?? 'MESSAGING_DISABLE')
const reason = ref('')
const useUntilDate = ref(false)
const restrictedUntil = ref('')
const durationDays = ref(7)

const messagingScope = ref<'all' | 'specific'>('all')
const extendExisting = ref(false)
const targetQuery = ref('')
const targetHits = ref<UserSearchItem[]>([])
const targetSearching = ref(false)
const selectedTargets = ref<TargetChip[]>([])
const targetLabels = ref<Record<string, string>>({})

const isMessaging = computed(() => restrictionType.value === 'MESSAGING_DISABLE')

const activeMessaging = computed(() =>
  active.value.find((r) => r.type === 'MESSAGING_DISABLE'),
)

const messagingIsTargeted = computed(() => {
  const ids = activeMessaging.value?.targetUserIds
  return Array.isArray(ids) && ids.length > 0
})

const cannotNarrowGlobal = computed(
  () =>
    isMessaging.value &&
    extendExisting.value &&
    messagingScope.value === 'specific' &&
    !!activeMessaging.value &&
    !messagingIsTargeted.value,
)

const canApply = computed(() => {
  if (cannotNarrowGlobal.value) return false
  if (useUntilDate.value) {
    if (!restrictedUntil.value) return false
    if (new Date(restrictedUntil.value).getTime() <= Date.now()) return false
  } else if (durationDays.value < 1) {
    return false
  }
  if (isMessaging.value && messagingScope.value === 'specific') {
    if (selectedTargets.value.length > 0) return true
    return extendExisting.value && messagingIsTargeted.value
  }
  return true
})

function typeLabel(type: string) {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function chipLabel(id: string) {
  return targetLabels.value[id] || selectedTargets.value.find((t) => t.userId === id)?.label || shortId(id)
}

function messagingRowSummary(row: ApiUserRestriction) {
  if (row.type !== 'MESSAGING_DISABLE') return null
  const ids = row.targetUserIds
  if (!ids?.length) return 'Cannot message anyone'
  if (ids.length === 1) return 'Cannot message 1 user'
  return `Cannot message ${ids.length} users`
}

function resolveUntilIso(): string {
  if (useUntilDate.value && restrictedUntil.value) {
    return new Date(restrictedUntil.value).toISOString()
  }
  const d = new Date()
  d.setDate(d.getDate() + durationDays.value)
  return d.toISOString()
}

function userChipFromSearch(hit: UserSearchItem): TargetChip {
  const label = [hit.name || hit.username, hit.publicId ? `#${hit.publicId}` : '']
    .filter(Boolean)
    .join(' · ')
  return { userId: hit.userId, label: label || shortId(hit.userId) }
}

async function enrichTargetLabels(ids: string[]) {
  const missing = [...new Set(ids)].filter((id) => id && !targetLabels.value[id])
  if (!missing.length) return
  const results = await Promise.allSettled(missing.map((id) => userAdminApi.getUser(id)))
  const next = { ...targetLabels.value }
  for (let i = 0; i < missing.length; i++) {
    const id = missing[i]
    const result = results[i]
    if (!id || result?.status !== 'fulfilled') continue
    const u = result.value.data
    next[id] =
      [u.name || u.username, u.publicId ? `#${u.publicId}` : ''].filter(Boolean).join(' · ') ||
      shortId(id)
  }
  targetLabels.value = next
}

async function load() {
  if (!props.userId) return
  loading.value = true
  try {
    const [liveResult, restResult] = await Promise.allSettled([
      liveRestrictionsApi.list(props.userId),
      userAdminApi.listRestrictions(props.userId),
    ])

    const liveActive =
      liveResult.status === 'fulfilled'
        ? liveResult.value.filter((r) => r.active !== false && isLiveEnforcedRestrictionType(r.type))
        : []
    const restActive = restResult.status === 'fulfilled' ? (restResult.value.data.active ?? []) : []
    const restMessaging = restActive.filter((r) => r.type === 'MESSAGING_DISABLE')

    if (liveResult.status === 'fulfilled') {
      active.value = [...liveActive, ...restMessaging]
    } else {
      active.value = restActive
      showToast('Could not load live-backend mutes/bans', 'error')
    }

    const ids = active.value.flatMap((r) => r.targetUserIds ?? [])
    void enrichTargetLabels(ids)
  } catch {
    active.value = []
  } finally {
    loading.value = false
  }
}

async function searchTargets() {
  const q = targetQuery.value.trim()
  if (!q) {
    targetHits.value = []
    return
  }
  targetSearching.value = true
  try {
    const { data } = await userAdminApi.searchUsers(q, 'auto', 10)
    targetHits.value = (data.users ?? []).filter(
      (u) => u.userId && u.userId !== props.userId,
    )
  } catch {
    targetHits.value = []
  } finally {
    targetSearching.value = false
  }
}

function addTarget(hit: UserSearchItem) {
  if (!hit.userId || hit.userId === props.userId) {
    showToast('Cannot target this same account', 'error')
    return
  }
  if (selectedTargets.value.some((t) => t.userId === hit.userId)) {
    targetQuery.value = ''
    targetHits.value = []
    return
  }
  if (selectedTargets.value.length >= MAX_MESSAGING_TARGETS) {
    showToast(`At most ${MAX_MESSAGING_TARGETS} users`, 'error')
    return
  }
  const chip = userChipFromSearch(hit)
  selectedTargets.value = [...selectedTargets.value, chip]
  targetLabels.value = { ...targetLabels.value, [chip.userId]: chip.label }
  targetQuery.value = ''
  targetHits.value = []
}

function removeTarget(userId: string) {
  selectedTargets.value = selectedTargets.value.filter((t) => t.userId !== userId)
}

async function apply() {
  if (!canApply.value || applying.value) return
  applying.value = true
  try {
    const payload: Parameters<typeof userAdminApi.applyRestriction>[1] = {
      type: restrictionType.value,
      restrictedUntil: resolveUntilIso(),
      reason: reason.value.trim() || undefined,
      reportId: props.reportId || undefined,
    }
    if (isMessaging.value) {
      if (messagingScope.value === 'specific' && selectedTargets.value.length) {
        payload.targetUserIds = selectedTargets.value.map((t) => t.userId)
      }
      if (extendExisting.value) payload.extend = true
    }
    if (isLiveEnforcedRestrictionType(restrictionType.value)) {
      await liveRestrictionsApi.apply(props.userId, {
        type: restrictionType.value,
        restrictedUntil: payload.restrictedUntil,
        reason: payload.reason,
        reportId: payload.reportId,
      })
    } else {
      await userAdminApi.applyRestriction(props.userId, payload)
    }
    const extra =
      isMessaging.value && messagingScope.value === 'specific'
        ? extendExisting.value
          ? ' (extended)'
          : ` (${selectedTargets.value.length} user${selectedTargets.value.length === 1 ? '' : 's'})`
        : ''
    showToast(`${typeLabel(restrictionType.value)} applied${extra}`, 'success')
    reason.value = ''
    selectedTargets.value = []
    extendExisting.value = false
    await load()
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data as { code?: string; message?: string } | undefined
      if (body?.code === 'CANNOT_NARROW_GLOBAL_MESSAGING_BAN') {
        showToast('Clear the all-users messaging ban first, or extend without specific users', 'error')
        return
      }
      if (body?.code === 'USER_NOT_FOUND') {
        showToast(body.message || 'One or more target users were not found', 'error')
        return
      }
      if (body?.code === 'INVALID_REQUEST') {
        showToast(body.message || 'Invalid restriction request', 'error')
        return
      }
    }
    showToast('Failed to apply restriction', 'error')
  } finally {
    applying.value = false
  }
}

async function clearRestriction(row: ApiUserRestriction) {
  if (clearingId.value) return
  clearingId.value = row.id
  try {
    if (isLiveEnforcedRestrictionType(row.type)) {
      await liveRestrictionsApi.delete(props.userId, row.id)
    } else {
      await userAdminApi.deleteRestriction(props.userId, row.id)
    }
    showToast(`${typeLabel(row.type)} cleared`, 'success')
    await load()
  } catch {
    showToast('Failed to clear restriction', 'error')
  } finally {
    clearingId.value = null
  }
}

onMounted(() => {
  void load()
})
watch(
  () => props.userId,
  () => {
    selectedTargets.value = []
    targetQuery.value = ''
    targetHits.value = []
    extendExisting.value = false
    void load()
  },
)
watch(restrictionType, (type) => {
  if (type !== 'MESSAGING_DISABLE') {
    messagingScope.value = 'all'
    extendExisting.value = false
    selectedTargets.value = []
    targetHits.value = []
    targetQuery.value = ''
  }
})
</script>

<template>
  <div class="admin-card space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">
        Feature restrictions
      </h2>
      <button
        type="button"
        class="admin-btn-secondary py-1 text-xs"
        :disabled="loading"
        @click="load"
      >
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
    </div>

    <p class="text-xs text-admin-muted">
      Timed, independent mutes/bans. Live chat mute, live audio mute, and going-live ban are applied on
      the live backend so they take effect in rooms immediately. Disable DMs stays on the main API.
      Re-applying the same type replaces it unless you extend an existing messaging ban.
      <span v-if="reportId"> Linked report {{ reportId.slice(0, 8) }}…</span>
    </p>

    <div class="space-y-2 rounded-md border border-admin-border p-3">
      <div>
        <label class="mb-1 block text-xs text-admin-subtext">Type</label>
        <select v-model="restrictionType" class="admin-input text-sm">
          <option v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div v-if="isMessaging" class="space-y-2">
        <p class="text-xs text-admin-subtext">Who they cannot message</p>
        <div class="flex flex-wrap gap-2">
          <label
            class="flex cursor-pointer items-center gap-1 rounded-md border border-admin-border px-2 py-1 text-xs"
            :class="messagingScope === 'all' ? 'border-admin-accent bg-admin-accent/10' : ''"
          >
            <input v-model="messagingScope" type="radio" value="all" class="accent-admin-accent" />
            All users
          </label>
          <label
            class="flex cursor-pointer items-center gap-1 rounded-md border border-admin-border px-2 py-1 text-xs"
            :class="messagingScope === 'specific' ? 'border-admin-accent bg-admin-accent/10' : ''"
          >
            <input v-model="messagingScope" type="radio" value="specific" class="accent-admin-accent" />
            Specific users
          </label>
        </div>

        <div v-if="messagingScope === 'specific'" class="space-y-2">
          <div class="relative">
            <input
              v-model="targetQuery"
              type="search"
              class="admin-input text-sm"
              placeholder="Search users to block messaging with…"
              @keydown.enter.prevent="searchTargets"
              @input="searchTargets"
            />
            <div
              v-if="targetHits.length"
              class="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-admin-border bg-admin-surface shadow-lg"
            >
              <button
                v-for="hit in targetHits"
                :key="hit.userId"
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-admin-bg"
                @click="addTarget(hit)"
              >
                <span class="font-medium">{{ hit.name || hit.username }}</span>
                <span class="text-xs text-admin-muted">#{{ hit.publicId }}</span>
              </button>
            </div>
          </div>
          <p v-if="targetSearching" class="text-xs text-admin-muted">Searching…</p>
          <div v-if="selectedTargets.length" class="flex flex-wrap gap-1">
            <span
              v-for="chip in selectedTargets"
              :key="chip.userId"
              class="inline-flex items-center gap-1 rounded-full border border-admin-border bg-admin-bg/60 px-2 py-0.5 text-xs"
            >
              <RouterLink class="text-admin-accent hover:underline" :to="`/admin/users/${chip.userId}`">
                {{ chip.label }}
              </RouterLink>
              <button type="button" class="text-admin-muted hover:text-admin-danger" @click="removeTarget(chip.userId)">
                ×
              </button>
            </span>
          </div>
          <p v-else class="text-xs text-admin-muted">
            Add at least one user, or extend an existing targeted ban to only change the end date.
          </p>
        </div>

        <p v-if="extendExisting && messagingIsTargeted && messagingScope === 'all'" class="text-xs text-admin-muted">
          Keeps the current specific-user list and only extends the end date.
        </p>

        <label
          v-if="activeMessaging"
          class="flex items-start gap-1.5 text-xs text-admin-subtext"
        >
          <input v-model="extendExisting" type="checkbox" class="mt-0.5 accent-admin-accent" />
          <span>
            Add to the existing messaging ban (keep later end date
            {{ messagingIsTargeted ? '; union selected users' : '' }})
          </span>
        </label>
        <p v-if="cannotNarrowGlobal" class="text-xs text-admin-warn">
          This account already has an all-users messaging ban. Clear it first, or uncheck “add to existing”
          to replace it with a specific-user ban.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-admin-subtext">
          <input v-model="useUntilDate" type="checkbox" class="accent-admin-accent" />
          End date
        </label>
        <input
          v-if="useUntilDate"
          v-model="restrictedUntil"
          type="datetime-local"
          class="admin-input w-auto py-1 text-xs"
        />
        <template v-else>
          <label
            v-for="days in [1, 7, 30]"
            :key="days"
            class="flex cursor-pointer items-center gap-1 rounded-md border border-admin-border px-2 py-1 text-xs"
            :class="durationDays === days ? 'border-admin-accent bg-admin-accent/10' : ''"
          >
            <input v-model="durationDays" type="radio" :value="days" class="accent-admin-accent" />
            {{ days }}d
          </label>
        </template>
      </div>

      <div>
        <label class="mb-1 block text-xs text-admin-subtext">Reason (optional)</label>
        <input
          v-model="reason"
          type="text"
          class="admin-input text-sm"
          placeholder="Spam after report"
          maxlength="500"
        />
      </div>

      <button
        type="button"
        class="admin-btn-warn w-full text-xs"
        :disabled="applying || !canApply"
        @click="apply"
      >
        {{ applying ? 'Applying…' : 'Apply restriction' }}
      </button>
    </div>

    <div v-if="loading && !active.length" class="text-xs text-admin-muted">Loading…</div>
    <div v-else-if="!active.length" class="text-xs text-admin-muted">No active restrictions</div>
    <ul v-else class="space-y-2">
      <li
        v-for="row in active"
        :key="row.id"
        class="flex flex-wrap items-start justify-between gap-2 rounded-md bg-admin-bg/60 px-3 py-2"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium">{{ typeLabel(row.type) }}</p>
          <p class="text-xs text-admin-subtext">
            Until {{ format(new Date(row.restrictedUntil), 'dd MMM yyyy, HH:mm') }}
          </p>
          <p v-if="messagingRowSummary(row)" class="mt-0.5 text-xs text-admin-subtext">
            {{ messagingRowSummary(row) }}
          </p>
          <div
            v-if="row.type === 'MESSAGING_DISABLE' && row.targetUserIds?.length"
            class="mt-1 flex flex-wrap gap-1"
          >
            <RouterLink
              v-for="tid in row.targetUserIds"
              :key="tid"
              class="rounded-full border border-admin-border px-2 py-0.5 text-[11px] text-admin-accent hover:underline"
              :to="`/admin/users/${tid}`"
            >
              {{ chipLabel(tid) }}
            </RouterLink>
          </div>
          <p v-if="row.reason" class="mt-0.5 text-xs text-admin-muted">{{ row.reason }}</p>
        </div>
        <button
          type="button"
          class="admin-btn-secondary shrink-0 py-1 text-xs"
          :disabled="clearingId === row.id"
          @click="clearRestriction(row)"
        >
          {{ clearingId === row.id ? 'Clearing…' : 'Clear' }}
        </button>
      </li>
    </ul>
  </div>
</template>
