<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import type { UserProfile } from '@/types/user'
import type { PushPayload } from '@/types/pushNotifications'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import ResetPasswordDialog from '@/components/shared/ResetPasswordDialog.vue'
import TemporaryPasswordDialog from '@/components/shared/TemporaryPasswordDialog.vue'
import SendPlatformMessageDialog from '@/components/shared/SendPlatformMessageDialog.vue'
import SendPushDialog from '@/components/push/SendPushDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import { pushNotificationsApi } from '@/api/pushNotifications'
import { useUserDetailStore } from '@/stores/userDetail'
import { usePlatformMessagesStore } from '@/stores/platformMessages'
import { useAgencyAdminStore } from '@/stores/agencyAdmin'
import { showToast } from '@/utils/toast'

const props = defineProps<{ user: UserProfile }>()
const store = useUserDetailStore()
const platformStore = usePlatformMessagesStore()
const agencyStore = useAgencyAdminStore()
const router = useRouter()

const postingRestricted = computed(() => {
  if (props.user.postingBanned) return true
  const until = props.user.postingSuspendedUntil
  if (!until) return false
  return new Date(until).getTime() > Date.now()
})

const postingSuspendedActive = computed(() => {
  const until = props.user.postingSuspendedUntil
  if (!until) return false
  return new Date(until).getTime() > Date.now()
})

const showResetPassword = ref(false)
const showRevokeFace = ref(false)
const showSystemMessage = ref(false)
const showNotification = ref(false)
const showPush = ref(false)
const sendingPush = ref(false)
const revokingFace = ref(false)
const autoResetOpen = ref(false)
const autoResetting = ref(false)
const tempPassword = ref('')
const showTempPassword = ref(false)
const showUnbar = ref(false)
const unbarring = ref(false)

async function handleResetPassword(password: string) {
  await store.resetPassword(props.user.id, password)
  showResetPassword.value = false
}

async function handleAutoReset() {
  if (autoResetting.value) return
  autoResetting.value = true
  try {
    const generated = await store.resetPassword(props.user.id)
    autoResetOpen.value = false
    if (generated) {
      tempPassword.value = generated
      showTempPassword.value = true
    }
  } finally {
    autoResetting.value = false
  }
}

function closeTempPassword() {
  showTempPassword.value = false
  tempPassword.value = ''
}

async function revokeFace(payload: { reason?: string }) {
  revokingFace.value = true
  try {
    await store.revokeFaceVerification(props.user.id, { reason: payload.reason })
    showRevokeFace.value = false
  } finally {
    revokingFace.value = false
  }
}

async function handleSystemMessage(message: string) {
  await platformStore.sendSystemMessage(props.user.id, message)
  showSystemMessage.value = false
}

async function handleNotification(message: string) {
  await platformStore.sendNotification(props.user.id, message)
  showNotification.value = false
}

async function handlePush(payload: PushPayload) {
  if (sendingPush.value) return
  sendingPush.value = true
  try {
    await pushNotificationsApi.sendToUser(props.user.id, payload)
    showToast('Push sent', 'success')
    showPush.value = false
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'NO_PUSH_TOKEN') {
        showToast('User has no push token registered.', 'error')
      } else if (code === 'PUSH_SEND_FAILED') {
        showToast('FCM rejected the send.', 'error')
      } else if (code === 'FIREBASE_NOT_CONFIGURED') {
        showToast('Firebase is not configured on the server.', 'error')
      } else {
        showToast('Failed to send push', 'error')
      }
    } else {
      showToast('Failed to send push', 'error')
    }
  } finally {
    sendingPush.value = false
  }
}

async function handleUnbar() {
  if (unbarring.value) return
  unbarring.value = true
  try {
    await agencyStore.unbarUser(props.user.id)
    showUnbar.value = false
  } catch {
    // toast from store
  } finally {
    unbarring.value = false
  }
}
</script>

<template>
  <div class="admin-card">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-admin-subtext">Quick Actions</h2>

    <div class="space-y-3">
      <button type="button" class="admin-btn-warn w-full text-sm" @click="showSystemMessage = true">
        Send System Message
      </button>
      <button type="button" class="admin-btn-primary w-full text-sm" @click="showNotification = true">
        Send Notification
      </button>
      <button type="button" class="admin-btn-primary w-full text-sm" @click="showPush = true">
        Send Push
      </button>
      <button
        type="button"
        class="admin-btn-secondary w-full text-xs"
        @click="router.push({ path: '/admin/messages', query: { userId: user.id } })"
      >
        Open Messages Console →
      </button>
      <button
        type="button"
        class="admin-btn-secondary w-full text-xs"
        @click="
          router.push({
            path: '/admin/push-notifications',
            query: { tab: 'users', q: user.publicId || user.id },
          })
        "
      >
        Open Push Console →
      </button>

      <button type="button" class="admin-btn-secondary w-full text-sm" @click="showResetPassword = true">
        Reset Password (custom)
      </button>
      <button type="button" class="admin-btn-secondary w-full text-sm" @click="autoResetOpen = true">
        Reset Password (auto-generate)
      </button>
      <button type="button" class="admin-btn-warn w-full text-sm" @click="showUnbar = true">
        Unbar agency apply
      </button>

      <div class="rounded-md border border-admin-border p-3">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm text-admin-subtext">Face Verification</span>
          <StatusBadge :status="user.faceVerificationStatus" />
        </div>
        <div
          v-if="user.faceVerificationDetail?.referenceImageUrl"
          class="mb-3 overflow-hidden rounded-md border border-admin-border bg-admin-bg"
        >
          <p class="border-b border-admin-border px-2 py-1 text-[10px] uppercase tracking-wide text-admin-muted">
            Reference image
          </p>
          <a
            :href="user.faceVerificationDetail.referenceImageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="block"
          >
            <img
              :src="user.faceVerificationDetail.referenceImageUrl"
              alt="Face verification reference"
              class="mx-auto max-h-48 w-full object-contain"
            />
          </a>
        </div>
        <p
          v-if="user.faceVerificationDetail?.duplicateUsername || user.faceVerificationDetail?.matchedUsername"
          class="mb-2 text-xs text-admin-warn"
        >
          Duplicate detected:
          {{ user.faceVerificationDetail.duplicateUsername ?? user.faceVerificationDetail.matchedUsername }}
        </p>
        <button
          type="button"
          class="admin-btn-warn w-full text-sm"
          :disabled="revokingFace || user.faceVerificationStatus !== 'verified'"
          @click="showRevokeFace = true"
        >
          {{ revokingFace ? 'Revoking...' : 'Revoke Face Verification' }}
        </button>
      </div>

      <div
        v-if="postingRestricted"
        class="rounded-md border border-admin-warn/30 bg-admin-warn/5 p-3 text-xs"
      >
        <p v-if="user.postingBanned" class="text-admin-warn">Posting banned</p>
        <p v-else-if="postingSuspendedActive && user.postingSuspendedUntil" class="text-admin-subtext">
          Suspended until {{ new Date(user.postingSuspendedUntil).toLocaleString() }}
        </p>
        <button
          type="button"
          class="admin-btn-primary mt-2 w-full text-xs"
          @click="store.activatePosting(user.id)"
        >
          Activate posting
        </button>
      </div>
    </div>

    <SendPlatformMessageDialog
      :open="showSystemMessage"
      type="system"
      :user-label="user.name"
      @close="showSystemMessage = false"
      @confirm="handleSystemMessage"
    />

    <SendPlatformMessageDialog
      :open="showNotification"
      type="notification"
      :user-label="user.name"
      @close="showNotification = false"
      @confirm="handleNotification"
    />

    <SendPushDialog
      :open="showPush"
      :subtitle="`To: ${user.name}`"
      confirm-label="Send now"
      @close="showPush = false"
      @confirm="handlePush"
    />

    <ResetPasswordDialog
      :open="showResetPassword"
      @close="showResetPassword = false"
      @confirm="handleResetPassword"
    />

    <ConfirmActionDialog
      :open="autoResetOpen"
      title="Auto-generate Password"
      message="A temporary password will be generated and shown once. All user sessions will be revoked."
      confirm-label="Generate Password"
      variant="warn"
      @close="autoResetOpen = false"
      @confirm="handleAutoReset"
    />

    <TemporaryPasswordDialog
      :open="showTempPassword"
      :password="tempPassword"
      @close="closeTempPassword"
    />

    <ConfirmActionDialog
      :open="showRevokeFace"
      title="Revoke Face Verification"
      message="This removes the face profile from Rekognition and revokes verification."
      confirm-label="Revoke"
      variant="danger"
      :require-reason="true"
      @close="showRevokeFace = false"
      @confirm="revokeFace"
    />

    <ConfirmActionDialog
      :open="showUnbar"
      title="Unbar agency application"
      message="Clears agency_barred_at so this user can re-apply / be approved as an agency. Does not recreate a deleted agency. Owner wallets are unfrozen."
      confirm-label="Unbar"
      variant="warn"
      @close="showUnbar = false"
      @confirm="handleUnbar"
    />
  </div>
</template>
