<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import axios from 'axios'
import { format } from 'date-fns'
import type { UpdateUserPayload, UserProfile } from '@/types/user'
import { getInitials } from '@/utils/format'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import { useUserDetailStore } from '@/stores/userDetail'
import { showToast } from '@/utils/toast'

const props = defineProps<{ user: UserProfile }>()
const store = useUserDetailStore()

const editing = ref(false)
const saving = ref(false)

const form = reactive({
  username: '',
  mobile: '',
  email: '',
  gender: '',
  country: '',
  tags: [] as string[],
})

const tagsInput = computed({
  get: () => form.tags.join(', '),
  set: (val: string) => {
    form.tags = val.split(',').map((t) => t.trim()).filter(Boolean)
  },
})

const genderLocked = computed(() => props.user.genderEditable === false)

function tagsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((t, i) => t === sortedB[i])
}

function startEdit() {
  form.username = props.user.username ?? props.user.name
  form.mobile = props.user.mobile ?? ''
  form.email = props.user.email ?? ''
  form.gender = (props.user.gender ?? '').toLowerCase()
  form.country = props.user.country ?? ''
  form.tags = [...props.user.tags]
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

function buildDirtyPayload(): UpdateUserPayload | null {
  const payload: UpdateUserPayload = {}
  const currentUsername = props.user.username ?? props.user.name
  const username = form.username.trim()
  if (username && username !== currentUsername) payload.username = username

  const phone = form.mobile.trim()
  if (phone !== (props.user.mobile ?? '')) payload.phone = phone || undefined

  const email = form.email.trim()
  if (email !== (props.user.email ?? '')) payload.email = email || undefined

  const country = form.country.trim()
  if (country !== (props.user.country ?? '')) payload.country = country || undefined

  if (!tagsEqual(form.tags, props.user.tags)) payload.tags = [...form.tags]

  const gender = form.gender.trim().toLowerCase()
  const currentGender = (props.user.gender ?? '').toLowerCase()
  if (gender !== currentGender) {
    if (genderLocked.value) {
      showToast('Revoke face verification first to change gender', 'error')
    } else if (gender) {
      payload.gender = gender
    }
  }

  return Object.keys(payload).length ? payload : null
}

async function saveEdit() {
  const payload = buildDirtyPayload()
  if (!payload) {
    // No dirty fields (or only a blocked gender change) — stay in edit mode.
    return
  }

  saving.value = true
  try {
    await store.updateUser(props.user.id, payload)
    editing.value = false
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'FACE_VERIFIED_GENDER_LOCKED') {
        showToast('Revoke face verification first to change gender', 'error')
        return
      }
      if (code === 'EMAIL_TAKEN') {
        showToast('Email is already in use', 'error')
        return
      }
      if (code === 'PHONE_TAKEN') {
        showToast('Phone is already in use', 'error')
        return
      }
    }
    /* store / interceptor may also toast */
  } finally {
    saving.value = false
  }
}

function formatDate(date: string) {
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}
</script>

<template>
  <div class="admin-card h-full">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">Basic Info</h2>
      <button v-if="!editing" type="button" class="admin-btn-secondary py-1 text-xs" @click="startEdit">
        Edit
      </button>
      <div v-else class="flex gap-2">
        <button type="button" class="admin-btn-secondary py-1 text-xs" @click="cancelEdit">Cancel</button>
        <button type="button" class="admin-btn-primary py-1 text-xs" :disabled="saving" @click="saveEdit">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <div class="mb-4 flex flex-col items-center">
      <img
        v-if="user.avatar"
        :src="user.avatar"
        :alt="user.name"
        class="h-20 w-20 rounded-full object-cover ring-2 ring-admin-border"
      />
      <div
        v-else
        class="flex h-20 w-20 items-center justify-center rounded-full bg-admin-accent/20 text-xl font-bold text-admin-accent"
      >
        {{ getInitials(user.name) }}
      </div>
      <div v-if="user.vip" class="mt-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
        VIP
      </div>
    </div>

    <div class="space-y-3 text-sm">
      <template v-if="editing">
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Username</label>
          <input v-model="form.username" class="admin-input" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Mobile</label>
          <input v-model="form.mobile" class="admin-input" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Email</label>
          <input v-model="form.email" type="email" class="admin-input" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Gender</label>
          <select v-model="form.gender" class="admin-input" :disabled="genderLocked">
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <p v-if="genderLocked" class="mt-1 text-xs text-admin-warn">
            Revoke face verification first
          </p>
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Country (ISO code)</label>
          <input v-model="form.country" class="admin-input" placeholder="IN" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Tags (comma separated)</label>
          <input v-model="tagsInput" class="admin-input" />
        </div>
      </template>

      <template v-else>
        <div class="admin-kv-row">
          <span class="admin-kv-label">User ID</span>
          <span class="admin-kv-value break-all font-mono text-xs tabular-nums">{{ user.id }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Public ID</span>
          <span class="admin-kv-value font-mono tabular-nums">{{ user.publicId ?? '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Display ID</span>
          <span class="admin-kv-value font-mono tabular-nums">
            {{ user.displayPublicId ?? '—' }}
            <span
              v-if="user.vip && user.displayPublicId && user.displayPublicId !== user.publicId"
              class="ml-1 text-xs text-amber-400"
            >VIP</span>
          </span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Username</span>
          <span class="admin-kv-value">{{ user.username ?? user.name }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Mobile</span>
          <span class="admin-kv-value">{{ user.mobile ?? '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Email</span>
          <span class="admin-kv-value break-all">{{ user.email ?? '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Gender</span>
          <span class="admin-kv-value">
            {{ user.gender ?? '—' }}
            <span
              v-if="user.faceVerified"
              class="ml-1 text-xs text-admin-muted"
            >(face locked)</span>
          </span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Location</span>
          <span class="admin-kv-value">{{ user.country ?? '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Tags</span>
          <div class="admin-kv-value flex flex-wrap gap-1 sm:justify-end">
            <span
              v-for="tag in user.tags"
              :key="tag"
              class="rounded bg-admin-accent/20 px-1.5 py-0.5 text-xs text-admin-accent"
            >
              {{ tag }}
            </span>
            <span v-if="!user.tags.length" class="text-admin-muted">—</span>
          </div>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Registration</span>
          <span class="admin-kv-value text-xs">{{ formatDate(user.registrationDate) }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Last Login</span>
          <span class="admin-kv-value text-xs">{{ formatDate(user.lastLogin) }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">In Agency</span>
          <span class="admin-kv-value">{{ user.inAgency ? (user.agencyName ?? 'Yes') : 'No' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">IP Address</span>
          <span class="admin-kv-value font-mono text-xs">{{ user.ipAddress ?? '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Device</span>
          <span class="admin-kv-value text-xs">{{ user.deviceName ?? '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Device ID</span>
          <span class="admin-kv-value break-all font-mono text-xs">{{ user.deviceId ?? '—' }}</span>
        </div>
        <div class="admin-kv-row border-0">
          <span class="admin-kv-label">Status</span>
          <div class="admin-kv-value sm:flex sm:justify-end"><StatusBadge :status="user.status" /></div>
        </div>
      </template>
    </div>
  </div>
</template>
