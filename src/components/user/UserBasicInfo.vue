<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import axios from 'axios'
import { format } from 'date-fns'
import type { UpdateUserPayload, UserProfile } from '@/types/user'
import { getInitials } from '@/utils/format'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import AgencyGovtIdPanel from '@/components/agency/AgencyGovtIdPanel.vue'
import { useUserDetailStore } from '@/stores/userDetail'
import { showToast } from '@/utils/toast'

const props = defineProps<{ user: UserProfile }>()
const store = useUserDetailStore()

const editing = ref(false)
const saving = ref(false)
const showRevokeFace = ref(false)
const revokingFace = ref(false)
const uploadingGovtId = ref(false)
const showReopen = ref(false)
const reopening = ref(false)

const form = reactive({
  username: '',
  firstName: '',
  lastName: '',
  mobile: '',
  email: '',
  kycPhone: '',
  kycEmail: '',
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

/** Live header-style join while editing; prefer API `name` when not dirty. */
const displayLegalName = computed(() => {
  if (editing.value) {
    const composed = [form.firstName, form.lastName]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(' ')
    if (composed) return composed
  }
  return props.user.name || props.user.username || 'Unknown'
})

const genderLocked = computed(() => props.user.genderEditable === false)
const hasKyc = computed(() => props.user.kycContact != null)
const isRejectedApplication = computed(() => props.user.agencyApplication?.status === 'REJECTED')

function tagsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((t, i) => t === sortedB[i])
}

function startEdit() {
  form.username = props.user.username ?? ''
  form.firstName = props.user.firstName ?? ''
  form.lastName = props.user.lastName ?? ''
  form.mobile = props.user.mobile ?? ''
  form.email = props.user.email ?? ''
  form.kycPhone = props.user.kycContact?.phone ?? ''
  form.kycEmail = props.user.kycContact?.email ?? ''
  form.gender = (props.user.gender ?? '').toLowerCase()
  form.country = props.user.country ?? ''
  form.tags = [...props.user.tags]
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

/** Map API / network failures to a user-facing toast. */
function userUpdateErrorMessage(err: unknown): string {
  if (err instanceof Error && !axios.isAxiosError(err)) return err.message
  if (!axios.isAxiosError(err)) return 'Failed to update user'
  const body = err.response?.data as
    | { code?: string; message?: string; error?: string }
    | undefined
  switch (body?.code) {
    case 'FACE_VERIFIED_GENDER_LOCKED':
      return 'Revoke face verification first to change gender'
    case 'EMAIL_TAKEN':
      return 'Email is already in use'
    case 'PHONE_TAKEN':
      return 'Phone is already in use'
    case 'KYC_NOT_FOUND':
      return 'This user has no KYC application to update'
    case 'APPLICATION_NOT_FOUND':
      return 'No agency application found'
    case 'APPLICATION_NOT_REJECTED':
      return 'Only a rejected application can be reopened'
    case 'INVALID_PHONE':
      return body.message || 'Invalid phone format (E.164, e.g. +919876543210)'
    case 'USER_NOT_FOUND':
      return 'User not found'
    case 'INVALID_REQUEST':
      return body.message || 'Invalid update request'
    case 'IDENTIFIER_VERSION_CONFLICT':
      return 'Contact info was updated elsewhere — please retry'
    case 'ADMIN_VIEW_FORBIDDEN':
      return 'You do not have permission to update this user'
    case 'ADMIN_TOKEN_INVALID':
    case 'ADMIN_TOKEN_EXPIRED':
      return 'Admin session expired — please sign in again'
  }
  if (body?.message) return body.message
  if (typeof body?.error === 'string' && body.error) return body.error
  if (err.code === 'ERR_NETWORK') return 'Network error — could not reach the server'
  return 'Failed to update user'
}

/**
 * Build a partial PATCH body with only changed fields.
 * Empty email/phone/country are allowed only when already empty (not cleared).
 * Never sends null/undefined keys (backend treats omitted fields as unchanged).
 */
function buildDirtyPayload(): UpdateUserPayload | null {
  const payload: UpdateUserPayload = {}
  const currentUsername = props.user.username ?? ''
  const username = form.username.trim()
  if (username !== currentUsername.trim()) {
    if (username.length < 2) {
      showToast('Username must be at least 2 characters', 'error')
      return null
    }
    payload.username = username
  }

  const firstName = form.firstName.trim()
  const currentFirst = (props.user.firstName ?? '').trim()
  if (firstName !== currentFirst) {
    if (!firstName) {
      showToast('First name cannot be cleared', 'error')
      return null
    }
    if (firstName.length > 50) {
      showToast('First name must be at most 50 characters', 'error')
      return null
    }
    payload.firstName = firstName
  }

  // Empty string clears lastName on the API; omit when unchanged.
  const lastName = form.lastName.trim()
  const currentLast = (props.user.lastName ?? '').trim()
  if (lastName !== currentLast) {
    if (lastName.length > 50) {
      showToast('Last name must be at most 50 characters', 'error')
      return null
    }
    payload.lastName = lastName
  }

  const phone = form.mobile.trim()
  const currentPhone = (props.user.mobile ?? '').trim()
  if (phone !== currentPhone) {
    if (!phone) {
      showToast('Phone cannot be cleared', 'error')
      return null
    }
    payload.phone = phone
  }

  const email = form.email.trim()
  const currentEmail = (props.user.email ?? '').trim()
  if (email !== currentEmail) {
    if (!email) {
      showToast('Email cannot be cleared', 'error')
      return null
    }
    payload.email = email
  }

  const country = form.country.trim()
  const currentCountry = (props.user.country ?? '').trim()
  if (country !== currentCountry) {
    if (!country) {
      showToast('Country cannot be cleared', 'error')
      return null
    }
    payload.country = country
  }

  if (!tagsEqual(form.tags, props.user.tags)) payload.tags = [...form.tags]

  const gender = form.gender.trim().toLowerCase()
  const currentGender = (props.user.gender ?? '').toLowerCase()
  if (gender !== currentGender) {
    if (genderLocked.value) {
      // Don't block other dirty fields — skip gender and warn.
      showToast('Revoke face verification first to change gender', 'error')
    } else if (!gender) {
      showToast('Select a gender', 'error')
      return null
    } else {
      payload.gender = gender
    }
  }

  return Object.keys(payload).length ? payload : null
}

function isProfileUnchanged() {
  return (
    form.firstName.trim() === (props.user.firstName ?? '').trim() &&
    form.lastName.trim() === (props.user.lastName ?? '').trim() &&
    form.username.trim() === (props.user.username ?? '').trim() &&
    form.mobile.trim() === (props.user.mobile ?? '').trim() &&
    form.email.trim() === (props.user.email ?? '').trim() &&
    form.country.trim() === (props.user.country ?? '').trim() &&
    form.gender.trim().toLowerCase() === (props.user.gender ?? '').toLowerCase() &&
    tagsEqual(form.tags, props.user.tags)
  )
}

function isKycUnchanged() {
  if (!hasKyc.value) return true
  return (
    form.kycPhone.trim() === (props.user.kycContact?.phone ?? '').trim() &&
    form.kycEmail.trim() === (props.user.kycContact?.email ?? '').trim()
  )
}

function buildKycDirtyPayload(): { phone?: string; email?: string } | null {
  const payload: { phone?: string; email?: string } = {}
  const phone = form.kycPhone.trim()
  const currentPhone = (props.user.kycContact?.phone ?? '').trim()
  if (phone !== currentPhone) {
    if (!phone) {
      showToast('KYC phone cannot be cleared', 'error')
      return null
    }
    payload.phone = phone
  }
  const email = form.kycEmail.trim()
  const currentEmail = (props.user.kycContact?.email ?? '').trim()
  if (email !== currentEmail) {
    if (!email) {
      showToast('KYC email cannot be cleared', 'error')
      return null
    }
    payload.email = email
  }
  return Object.keys(payload).length ? payload : null
}

async function saveEdit() {
  if (isProfileUnchanged() && isKycUnchanged()) {
    showToast('No changes to save', 'info')
    return
  }

  const payload = isProfileUnchanged() ? null : buildDirtyPayload()
  if (!isProfileUnchanged() && !payload) return

  const kycPayload = isKycUnchanged() ? null : buildKycDirtyPayload()
  if (!isKycUnchanged() && !kycPayload) return

  saving.value = true
  try {
    if (payload) await store.updateUser(props.user.id, payload)
    if (kycPayload) await store.updateKycContact(props.user.id, kycPayload)
    editing.value = false
  } catch (err) {
    showToast(userUpdateErrorMessage(err), 'error')
  } finally {
    saving.value = false
  }
}

function formatDate(date: string) {
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}

async function confirmRevokeFace(payload: { reason?: string }) {
  if (revokingFace.value) return
  revokingFace.value = true
  try {
    await store.revokeFaceVerification(props.user.id, { reason: payload.reason })
    showRevokeFace.value = false
  } catch (err) {
    showToast(userUpdateErrorMessage(err), 'error')
  } finally {
    revokingFace.value = false
  }
}

async function onReplaceGovtId(file: File) {
  if (uploadingGovtId.value) return
  uploadingGovtId.value = true
  try {
    await store.uploadGovtId(props.user.id, file)
  } catch (err) {
    showToast(userUpdateErrorMessage(err), 'error')
  } finally {
    uploadingGovtId.value = false
  }
}

async function confirmReopen() {
  if (reopening.value) return
  reopening.value = true
  try {
    await store.reopenAgencyApplication(props.user.id)
    showReopen.value = false
  } catch (err) {
    showToast(userUpdateErrorMessage(err), 'error')
  } finally {
    reopening.value = false
  }
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
        :alt="displayLegalName"
        class="h-20 w-20 rounded-full object-cover ring-2 ring-admin-border"
      />
      <div
        v-else
        class="flex h-20 w-20 items-center justify-center rounded-full bg-admin-accent/20 text-xl font-bold text-admin-accent"
      >
        {{ getInitials(displayLegalName) }}
      </div>
      <p class="mt-2 text-center text-sm font-medium">{{ displayLegalName }}</p>
      <p v-if="user.username" class="text-center text-xs text-admin-subtext">@{{ user.username }}</p>
      <div class="mt-2 flex flex-wrap items-center justify-center gap-1.5">
        <div v-if="user.vip" class="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
          VIP
        </div>
        <div
          v-if="(user.richTier?.tier ?? 0) > 0"
          class="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-300"
        >
          {{ user.richTier?.displayName?.trim() || `Tier ${user.richTier?.tier}` }}
        </div>
      </div>
    </div>

    <div class="space-y-3 text-sm">
      <template v-if="editing">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">First name</label>
            <input v-model="form.firstName" class="admin-input" maxlength="50" autocomplete="off" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Last name</label>
            <input
              v-model="form.lastName"
              class="admin-input"
              maxlength="50"
              placeholder="Optional — clear to remove"
              autocomplete="off"
            />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Username</label>
          <input v-model="form.username" class="admin-input" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Mobile (login)</label>
          <input v-model="form.mobile" class="admin-input" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Email (login)</label>
          <input v-model="form.email" type="email" class="admin-input" />
        </div>
        <template v-if="hasKyc">
          <p class="text-xs font-medium uppercase tracking-wide text-admin-subtext">KYC contact</p>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">KYC phone</label>
            <input v-model="form.kycPhone" class="admin-input" placeholder="+919876543210" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">KYC email</label>
            <input v-model="form.kycEmail" type="email" class="admin-input" />
          </div>
        </template>
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
            <button
              type="button"
              class="ml-1 underline hover:text-admin-accent"
              :disabled="revokingFace"
              @click="showRevokeFace = true"
            >
              Revoke now
            </button>
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
          <span class="admin-kv-label">First name</span>
          <span class="admin-kv-value">{{ user.firstName || '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Last name</span>
          <span class="admin-kv-value">{{ user.lastName || '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Username</span>
          <span class="admin-kv-value">{{ user.username || '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Rich tier</span>
          <span class="admin-kv-value">
            <template v-if="(user.richTier?.tier ?? 0) > 0">
              {{ user.richTier?.displayName?.trim() || `Tier ${user.richTier?.tier}` }}
              <span class="ml-1 font-mono text-xs text-admin-muted">({{ user.richTier?.tier }})</span>
            </template>
            <template v-else>None</template>
          </span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Mobile</span>
          <span class="admin-kv-value">{{ user.mobile ?? '—' }}</span>
        </div>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Email</span>
          <span class="admin-kv-value break-all">{{ user.email ?? '—' }}</span>
        </div>
        <template v-if="hasKyc">
          <div class="admin-kv-row">
            <span class="admin-kv-label">KYC phone</span>
            <span class="admin-kv-value">{{ user.kycContact?.phone ?? '—' }}</span>
          </div>
          <div class="admin-kv-row">
            <span class="admin-kv-label">KYC email</span>
            <span class="admin-kv-value break-all">{{ user.kycContact?.email ?? '—' }}</span>
          </div>
        </template>
        <div class="admin-kv-row">
          <span class="admin-kv-label">Gender</span>
          <span class="admin-kv-value">
            {{ user.gender ?? '—' }}
            <span
              v-if="user.faceVerified"
              class="ml-1 text-xs text-admin-muted"
            >(face locked)</span>
            <button
              v-if="genderLocked"
              type="button"
              class="ml-2 text-xs text-admin-warn underline hover:text-admin-accent"
              :disabled="revokingFace"
              @click="showRevokeFace = true"
            >
              Revoke to edit gender
            </button>
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
          <span class="admin-kv-value">
            <template v-if="user.inAgency">
              {{ user.agencyName ?? 'Yes' }}
              <span
                v-if="user.agencyPublicId"
                class="ml-1 font-mono text-xs text-admin-muted"
              >#{{ user.agencyPublicId }}</span>
            </template>
            <template v-else>No</template>
          </span>
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

      <div v-if="hasKyc" class="mt-4 space-y-2 border-t border-admin-border pt-4">
        <p class="text-xs font-medium uppercase tracking-wide text-admin-subtext">Government ID</p>
        <AgencyGovtIdPanel
          :govt-id-url="user.kycContact?.govtIdUrl"
          :govt-id-submitted-at="user.kycContact?.govtIdSubmittedAt"
          :uploading="uploadingGovtId"
          @replace="onReplaceGovtId"
        />
      </div>
      <div
        v-if="isRejectedApplication"
        class="mt-4 space-y-2 rounded-md border border-admin-warn/40 bg-admin-warn/5 p-3"
      >
        <p class="text-sm font-medium text-admin-warn">Agency application rejected</p>
        <p class="text-xs text-admin-subtext">
          Clear the rejection so this user can submit a new agency application. KYC contact and
          government ID are kept.
        </p>
        <button type="button" class="admin-btn-warn text-xs" @click="showReopen = true">
          Allow reapply
        </button>
      </div>
    </div>

    <ConfirmActionDialog
      :open="showRevokeFace"
      title="Revoke Face Verification"
      message="This unlocks gender edits. The user will need to re-verify their face."
      confirm-label="Revoke"
      variant="danger"
      require-reason
      @close="showRevokeFace = false"
      @confirm="confirmRevokeFace"
    />
    <ConfirmActionDialog
      :open="showReopen"
      title="Allow reapply"
      message="Remove the rejected application so this user can apply for an agency again. Their KYC contact and government ID are kept."
      confirm-label="Allow reapply"
      variant="warn"
      @close="showReopen = false"
      @confirm="confirmReopen"
    />
  </div>
</template>
