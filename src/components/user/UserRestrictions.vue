<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { format } from 'date-fns'
import axios from 'axios'
import { userAdminApi } from '@/api/userAdmin'
import type { ApiUserRestriction, UserRestrictionType } from '@/types/api'
import { showToast } from '@/utils/toast'

const props = defineProps<{ userId: string }>()

const TYPE_OPTIONS: { value: UserRestrictionType; label: string }[] = [
  { value: 'LIVE_CHAT_MUTE', label: 'Mute live chat' },
  { value: 'LIVE_AUDIO_MUTE', label: 'Mute live audio' },
  { value: 'MESSAGING_DISABLE', label: 'Disable messaging' },
  { value: 'LIVE_STREAM_START_BAN', label: 'Ban starting live' },
]

const active = ref<ApiUserRestriction[]>([])
const loading = ref(false)
const applying = ref(false)
const clearingId = ref<string | null>(null)

const restrictionType = ref<UserRestrictionType>('MESSAGING_DISABLE')
const reason = ref('')
const useUntilDate = ref(false)
const restrictedUntil = ref('')
const durationDays = ref(7)

const canApply = computed(() => {
  if (useUntilDate.value) {
    if (!restrictedUntil.value) return false
    return new Date(restrictedUntil.value).getTime() > Date.now()
  }
  return durationDays.value >= 1
})

function typeLabel(type: string) {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

function resolveUntilIso(): string {
  if (useUntilDate.value && restrictedUntil.value) {
    return new Date(restrictedUntil.value).toISOString()
  }
  const d = new Date()
  d.setDate(d.getDate() + durationDays.value)
  return d.toISOString()
}

async function load() {
  if (!props.userId) return
  loading.value = true
  try {
    const { data } = await userAdminApi.listRestrictions(props.userId)
    active.value = data.active ?? []
  } catch {
    active.value = []
  } finally {
    loading.value = false
  }
}

async function apply() {
  if (!canApply.value || applying.value) return
  applying.value = true
  try {
    await userAdminApi.applyRestriction(props.userId, {
      type: restrictionType.value,
      restrictedUntil: resolveUntilIso(),
      reason: reason.value.trim() || undefined,
    })
    showToast(`${typeLabel(restrictionType.value)} applied`, 'success')
    reason.value = ''
    await load()
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'INVALID_REQUEST') {
        showToast('Invalid restriction request', 'error')
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
    await userAdminApi.deleteRestriction(props.userId, row.id)
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
    void load()
  },
)
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
      Timed, independent mutes/bans. Applying the same type replaces the active one.
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
