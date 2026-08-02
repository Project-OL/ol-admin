<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { userAdminApi } from '@/api/userAdmin'
import { mapSearchUser } from '@/api/mappers'
import { usePlatformMessagesStore } from '@/stores/platformMessages'
import type { UserSearchResult } from '@/types/user'
import { showToast } from '@/utils/toast'

const route = useRoute()
const platformStore = usePlatformMessagesStore()

const MAX_MESSAGE_LENGTH = 4000

const activeMode = ref<'single-system' | 'single-notification' | 'broadcast'>('single-system')

const searchQuery = ref('')
const searchLoading = ref(false)
const searchResults = ref<UserSearchResult[]>([])
const selectedUser = ref<UserSearchResult | null>(null)

const message = ref('')
const campaignId = ref('')
const broadcastScope = ref<'all' | 'selected'>('all')
const userIdsInput = ref('')
const sending = ref(false)
const lastResult = ref<{ type: string; detail: string } | null>(null)

const messageLength = computed(() => message.value.length)
const messageValid = computed(
  () => message.value.trim().length > 0 && message.value.length <= MAX_MESSAGE_LENGTH,
)

const parsedUserIds = computed(() =>
  userIdsInput.value
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean),
)

const canSendSingle = computed(() => messageValid.value && selectedUser.value)
const canSendBroadcast = computed(() => {
  if (!messageValid.value) return false
  if (broadcastScope.value === 'selected') return parsedUserIds.value.length > 0
  return true
})

async function searchUsers() {
  const q = searchQuery.value.trim()
  if (!q) return

  searchLoading.value = true
  searchResults.value = []
  try {
    const { data } = await userAdminApi.searchUsers(q)
    searchResults.value = data.users.map(mapSearchUser)
    if (!searchResults.value.length) showToast('No users found', 'error')
  } catch {
    /* handled by interceptor */
  } finally {
    searchLoading.value = false
  }
}

async function preselectUser(userId: string) {
  searchQuery.value = userId
  await searchUsers()
  const match = searchResults.value.find((u) => u.id === userId)
  if (match) {
    selectedUser.value = match
    searchResults.value = []
  }
}

function selectUser(user: UserSearchResult) {
  selectedUser.value = user
  searchResults.value = []
}

function clearUser() {
  selectedUser.value = null
}

async function sendSingle(type: 'system' | 'notification') {
  if (!selectedUser.value || !messageValid.value) return

  sending.value = true
  lastResult.value = null
  try {
    const text = message.value.trim()
    const data =
      type === 'system'
        ? await platformStore.sendSystemMessage(selectedUser.value.id, text)
        : await platformStore.sendNotification(selectedUser.value.id, text)

    if (data) {
      lastResult.value = {
        type: type === 'system' ? 'SYSTEM' : 'NOTIFICATION',
        detail: `Sent to ${selectedUser.value.name} · messageId: ${data.messageId}${
          data.campaignId ? ` · campaign: ${data.campaignId}` : ''
        }`,
      }
      message.value = ''
    }
  } finally {
    sending.value = false
  }
}

async function sendBroadcast() {
  if (!canSendBroadcast.value) return

  sending.value = true
  lastResult.value = null
  try {
    const payload: { message: string; userIds?: string[]; campaignId?: string } = {
      message: message.value.trim(),
    }
    if (campaignId.value.trim()) payload.campaignId = campaignId.value.trim()
    if (broadcastScope.value === 'selected') payload.userIds = parsedUserIds.value

    const data = await platformStore.broadcastNotification(payload)
    if (data) {
      const recipientLabel =
        broadcastScope.value === 'all'
          ? 'all active users'
          : `${parsedUserIds.value.length} user(s)`

      lastResult.value = {
        type: 'BROADCAST',
        detail: `Queued for ${recipientLabel}${
          data.campaignId ? ` · campaign: ${data.campaignId}` : ''
        }`,
      }
      message.value = ''
      if (broadcastScope.value === 'selected') userIdsInput.value = ''
    }
  } finally {
    sending.value = false
  }
}

function handleSend() {
  if (activeMode.value === 'single-system') sendSingle('system')
  else if (activeMode.value === 'single-notification') sendSingle('notification')
  else sendBroadcast()
}

watch(
  () => route.query.userId,
  (userId) => {
    if (typeof userId === 'string' && userId) preselectUser(userId)
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof route.query.userId === 'string' && route.query.userId && !selectedUser.value) {
    preselectUser(route.query.userId)
  }
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold sm:text-2xl">Platform Messages</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Send SYSTEM or NOTIFICATION messages to users' dedicated platform inbox threads
      </p>
    </div>

    <div class="mb-6 flex flex-wrap gap-1 rounded-lg border border-admin-border bg-admin-surface p-1">
      <button
        type="button"
        :class="[
          'min-w-0 flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-3 sm:text-sm',
          activeMode === 'single-system'
            ? 'bg-admin-accent text-white'
            : 'text-admin-subtext hover:text-admin-text',
        ]"
        @click="activeMode = 'single-system'"
      >
        <span class="sm:hidden">System</span>
        <span class="hidden sm:inline">System · One user</span>
      </button>
      <button
        type="button"
        :class="[
          'min-w-0 flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-3 sm:text-sm',
          activeMode === 'single-notification'
            ? 'bg-admin-accent text-white'
            : 'text-admin-subtext hover:text-admin-text',
        ]"
        @click="activeMode = 'single-notification'"
      >
        <span class="sm:hidden">Notify</span>
        <span class="hidden sm:inline">Notification · One user</span>
      </button>
      <button
        type="button"
        :class="[
          'min-w-0 flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-3 sm:text-sm',
          activeMode === 'broadcast'
            ? 'bg-admin-accent text-white'
            : 'text-admin-subtext hover:text-admin-text',
        ]"
        @click="activeMode = 'broadcast'"
      >
        <span class="sm:hidden">Broadcast</span>
        <span class="hidden sm:inline">Broadcast · Many / All</span>
      </button>
    </div>

    <div class="admin-card space-y-6">
      <div
        class="rounded-md border px-4 py-3 text-sm"
        :class="
          activeMode === 'single-system'
            ? 'border-admin-warn/30 bg-admin-warn/5 text-admin-warn'
            : 'border-admin-accent/30 bg-admin-accent/5 text-admin-accent'
        "
      >
        <template v-if="activeMode === 'single-system'">
          <strong>SYSTEM</strong> — moderation warnings, policy notices, account actions. Appears in the user's SYSTEM thread.
        </template>
        <template v-else-if="activeMode === 'single-notification'">
          <strong>NOTIFICATION</strong> — announcements, maintenance, campaigns. Appears in the user's NOTIFICATION thread.
        </template>
        <template v-else>
          <strong>NOTIFICATION broadcast</strong> — async delivery to selected users or all active users (max 50,000).
        </template>
      </div>

      <div v-if="activeMode !== 'broadcast'" class="space-y-3">
        <label class="block text-xs font-medium uppercase tracking-wide text-admin-subtext">
          Target user
        </label>

        <div
          v-if="selectedUser"
          class="flex flex-col gap-3 rounded-md border border-admin-border bg-admin-bg/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <p class="font-medium">{{ selectedUser.name }}</p>
            <p class="break-all font-mono text-xs text-admin-subtext">{{ selectedUser.id }}</p>
          </div>
          <button type="button" class="admin-btn-secondary shrink-0 text-xs" @click="clearUser">Change</button>
        </div>

        <template v-else>
          <div class="admin-search-row">
            <input
              v-model="searchQuery"
              type="text"
              class="admin-input min-w-0 flex-1"
              placeholder="Search by email, phone, public ID, name..."
              @keydown.enter="searchUsers"
            />
            <button
              type="button"
              class="admin-btn-primary w-full shrink-0 sm:w-auto"
              :disabled="searchLoading"
              @click="searchUsers"
            >
              {{ searchLoading ? 'Searching…' : 'Search' }}
            </button>
          </div>

          <div v-if="searchResults.length" class="overflow-hidden rounded-md border border-admin-border">
            <button
              v-for="user in searchResults"
              :key="user.id"
              type="button"
              class="flex w-full items-center justify-between gap-3 border-b border-admin-border/50 px-3 py-3 text-left last:border-0 hover:bg-admin-bg/60 sm:px-4"
              @click="selectUser(user)"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">{{ user.name }}</p>
                <p class="truncate text-xs text-admin-subtext">{{ user.email ?? user.phone ?? user.publicId }}</p>
              </div>
              <span class="shrink-0 text-xs text-admin-accent">Select</span>
            </button>
          </div>
        </template>
      </div>

      <div v-else class="space-y-3">
        <label class="block text-xs font-medium uppercase tracking-wide text-admin-subtext">
          Recipients
        </label>
        <div class="flex flex-wrap gap-3">
          <label class="flex cursor-pointer items-center gap-2 rounded-md border border-admin-border px-4 py-2.5 text-sm">
            <input v-model="broadcastScope" type="radio" value="all" class="accent-admin-accent" />
            All active users
          </label>
          <label class="flex cursor-pointer items-center gap-2 rounded-md border border-admin-border px-4 py-2.5 text-sm">
            <input v-model="broadcastScope" type="radio" value="selected" class="accent-admin-accent" />
            Specific users
          </label>
        </div>

        <div v-if="broadcastScope === 'selected'">
          <textarea
            v-model="userIdsInput"
            rows="4"
            class="admin-input resize-none font-mono text-xs"
            placeholder="User UUIDs, one per line or comma-separated (max 500)"
          />
          <p class="mt-1 text-xs text-admin-muted">{{ parsedUserIds.length }} user ID(s) parsed</p>
        </div>

        <div>
          <label class="mb-1 block text-xs text-admin-subtext">
            Campaign ID <span class="text-admin-muted">(optional, recommended for idempotency)</span>
          </label>
          <input
            v-model="campaignId"
            type="text"
            class="admin-input"
            placeholder="maint-2026-07-05"
            maxlength="128"
          />
        </div>
      </div>

      <div class="space-y-2">
        <label class="block text-xs font-medium uppercase tracking-wide text-admin-subtext">
          Message
        </label>
        <textarea
          v-model="message"
          rows="6"
          class="admin-input resize-none"
          :maxlength="MAX_MESSAGE_LENGTH"
          placeholder="Enter message text (max 4000 characters)..."
        />
        <p
          class="text-xs"
          :class="messageLength > MAX_MESSAGE_LENGTH ? 'text-admin-danger' : 'text-admin-muted'"
        >
          {{ messageLength }} / {{ MAX_MESSAGE_LENGTH }}
        </p>
      </div>

      <div class="admin-action-bar">
        <p v-if="lastResult" class="min-w-0 break-words text-xs text-admin-success">
          {{ lastResult.type }}: {{ lastResult.detail }}
        </p>
        <div v-else class="hidden sm:block" />
        <button
          type="button"
          class="admin-btn-primary w-full px-6 sm:w-auto sm:shrink-0 sm:self-end"
          :disabled="sending || (activeMode === 'broadcast' ? !canSendBroadcast : !canSendSingle)"
          @click="handleSend"
        >
          {{
            sending
              ? 'Sending…'
              : activeMode === 'broadcast'
                ? 'Queue Broadcast'
                : 'Send Message'
          }}
        </button>
      </div>
    </div>

    <div class="mt-6 admin-card !bg-admin-bg/40 space-y-2 text-xs text-admin-subtext">
      <p class="font-medium text-admin-text">Where users see messages</p>
      <ul class="list-inside list-disc space-y-1">
        <li>Each user has separate <strong>SYSTEM</strong>, <strong>NOTIFICATION</strong>, and <strong>TRANSACTIONAL</strong> platform threads</li>
        <li>Messages are sent from the platform sender; listed in <code class="text-admin-text">GET /conversations</code></li>
        <li>Broadcast requires the <code class="text-admin-text">platform-message</code> worker</li>
        <li>Use a stable <code class="text-admin-text">campaignId</code> for broadcast idempotency</li>
      </ul>
    </div>
  </div>
</template>
