<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { format } from 'date-fns'
import type { DeviceInfo, DeviceOtherActiveLogin } from '@/types/user'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import { useUserDetailStore } from '@/stores/userDetail'

const props = defineProps<{
  userId: string
  devices: DeviceInfo[]
}>()

const store = useUserDetailStore()
const banReason = ref('Policy violation')
const banning = ref(false)
const loggingOut = ref(false)
const confirmLogoutAll = ref(false)
const expandedDeviceId = ref<string | null>(null)

const activeDevices = computed(() => props.devices.filter((d) => d.hasActiveSession))
const sortedDevices = computed(() =>
  [...props.devices].sort((a, b) => Number(b.hasActiveSession) - Number(a.hasActiveSession)),
)

const otherLoginGroups = computed(() =>
  props.devices
    .filter((d) => (d.otherActiveLogins ?? []).length > 0)
    .map((d) => ({
      deviceId: d.id,
      deviceName: d.name ?? 'Unknown device',
      logins: d.otherActiveLogins ?? [],
    })),
)

const otherLoginCount = computed(() =>
  otherLoginGroups.value.reduce((sum, group) => sum + group.logins.length, 0),
)

async function banAll() {
  banning.value = true
  try {
    await store.banDevices(props.userId, { reason: banReason.value })
  } finally {
    banning.value = false
  }
}

async function banOne(deviceId: string) {
  banning.value = true
  try {
    await store.banDevices(props.userId, { deviceId, reason: banReason.value })
  } finally {
    banning.value = false
  }
}

async function logoutAll() {
  loggingOut.value = true
  try {
    await store.logoutAllDevices(props.userId)
    confirmLogoutAll.value = false
  } finally {
    loggingOut.value = false
  }
}

function deviceStatus(device: DeviceInfo): { status: string; label: string } {
  if (device.isBanned) return { status: 'banned', label: 'Banned' }
  if (device.hasActiveSession) return { status: 'logged-in', label: 'Logged in' }
  return { status: 'registered', label: 'Registered' }
}

function otherLoginLabel(login: DeviceOtherActiveLogin) {
  return login.name?.trim() || login.username || login.displayPublicId || login.publicId || login.userId
}

function toggleOtherLogins(deviceId: string) {
  expandedDeviceId.value = expandedDeviceId.value === deviceId ? null : deviceId
}
</script>

<template>
  <div class="admin-card">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">Devices</h2>
        <p class="mt-1 text-xs text-admin-subtext">
          Active logins
          <span class="font-medium text-admin-text">{{ activeDevices.length }} / 3</span>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input v-model="banReason" type="text" class="admin-input w-40 py-1 text-xs" placeholder="Ban reason" />
        <button
          type="button"
          class="admin-btn-secondary text-xs"
          :disabled="loggingOut || !activeDevices.length"
          @click="confirmLogoutAll = true"
        >
          Logout all devices
        </button>
        <button
          type="button"
          class="admin-btn-danger text-xs"
          :disabled="banning || !devices.length"
          @click="banAll"
        >
          Ban All Devices
        </button>
      </div>
    </div>

    <div v-if="activeDevices.length" class="mb-4 rounded-md border border-admin-success/30 bg-admin-success/5 p-3">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
        Currently logged in
      </p>
      <ul class="space-y-1.5">
        <li v-for="device in activeDevices" :key="device.sessionId ?? device.id" class="text-sm">
          <span class="font-medium">{{ device.name ?? 'Unknown' }}</span>
          <span class="ml-2 font-mono text-xs text-admin-subtext">{{ device.id }}</span>
          <span v-if="device.lastActiveAt" class="ml-2 text-xs text-admin-muted">
            {{ format(new Date(device.lastActiveAt), 'dd MMM yyyy HH:mm') }}
          </span>
        </li>
      </ul>
    </div>
    <p v-else class="mb-4 text-xs text-admin-muted">No active logins right now.</p>

    <div
      v-if="otherLoginCount"
      class="mb-4 rounded-md border border-admin-warn/40 bg-admin-warn/5 p-3"
    >
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-subtext">
        Other users logged in from these devices
        <span class="ml-1 font-medium text-admin-text">({{ otherLoginCount }})</span>
      </p>
      <div v-for="group in otherLoginGroups" :key="group.deviceId" class="mb-3 last:mb-0">
        <p class="mb-1.5 text-xs text-admin-muted">
          <span class="font-medium text-admin-text">{{ group.deviceName }}</span>
          <span class="ml-2 font-mono">{{ group.deviceId }}</span>
        </p>
        <ul class="space-y-1.5">
          <li v-for="login in group.logins" :key="login.sessionId ?? login.userId">
            <RouterLink
              :to="`/admin/users/${login.userId}`"
              class="flex items-center gap-2 rounded-md border border-admin-border bg-admin-bg px-2 py-1.5 hover:border-admin-accent"
            >
              <img
                v-if="login.avatarUrl"
                :src="login.avatarUrl"
                alt=""
                class="h-8 w-8 rounded-full object-cover"
              />
              <div
                v-else
                class="flex h-8 w-8 items-center justify-center rounded-full bg-admin-border text-xs text-admin-muted"
              >
                {{ (otherLoginLabel(login)[0] ?? '?').toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ otherLoginLabel(login) }}</p>
                <p class="truncate font-mono text-[11px] text-admin-subtext">
                  {{ login.displayPublicId || login.publicId || login.userId }}
                  <span v-if="login.username" class="ml-1">@{{ login.username }}</span>
                </p>
              </div>
              <div class="text-right text-[11px] text-admin-muted">
                <p v-if="login.status" class="capitalize">{{ login.status }}</p>
                <p v-if="login.lastActiveAt">
                  {{ format(new Date(login.lastActiveAt), 'dd MMM HH:mm') }}
                </p>
              </div>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Device</th>
            <th>Platform</th>
            <th>IP</th>
            <th>Last Active</th>
            <th>Status</th>
            <th>Other logins</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="device in sortedDevices" :key="device.id">
            <tr :class="device.hasActiveSession ? 'bg-admin-success/5' : ''">
              <td>
                <p class="font-medium">{{ device.name ?? 'Unknown' }}</p>
                <p class="font-mono text-xs text-admin-subtext">{{ device.id }}</p>
              </td>
              <td class="text-xs capitalize">{{ device.platform ?? '—' }}</td>
              <td class="font-mono text-xs">{{ device.ipAddress ?? '—' }}</td>
              <td class="text-xs whitespace-nowrap">
                {{ device.lastActiveAt ? format(new Date(device.lastActiveAt), 'dd MMM yyyy HH:mm') : '—' }}
              </td>
              <td>
                <StatusBadge :status="deviceStatus(device).status" :label="deviceStatus(device).label" />
              </td>
              <td>
                <button
                  v-if="(device.otherActiveLogins ?? []).length"
                  type="button"
                  class="text-xs font-medium text-admin-accent hover:underline"
                  @click="toggleOtherLogins(device.id)"
                >
                  {{ device.otherActiveLogins?.length }} other
                  {{ expandedDeviceId === device.id ? '▴' : '▾' }}
                </button>
                <span v-else class="text-xs text-admin-muted">None</span>
              </td>
              <td>
                <div class="flex gap-1">
                  <button
                    v-if="!device.isBanned"
                    type="button"
                    class="admin-btn-danger py-1 text-xs"
                    :disabled="banning"
                    @click="banOne(device.id)"
                  >
                    Ban
                  </button>
                  <button
                    v-else
                    type="button"
                    class="admin-btn-secondary py-1 text-xs"
                    :disabled="banning"
                    @click="store.unbanDevice(device.id, userId)"
                  >
                    Unban
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="expandedDeviceId === device.id && (device.otherActiveLogins ?? []).length">
              <td colspan="7" class="bg-admin-warn/5 py-2">
                <ul class="space-y-1.5 px-2">
                  <li v-for="login in device.otherActiveLogins" :key="login.sessionId ?? login.userId">
                    <RouterLink
                      :to="`/admin/users/${login.userId}`"
                      class="flex items-center gap-2 text-sm hover:text-admin-accent"
                    >
                      <span class="font-medium">{{ otherLoginLabel(login) }}</span>
                      <span class="font-mono text-xs text-admin-subtext">
                        {{ login.displayPublicId || login.publicId }}
                      </span>
                      <span v-if="login.lastActiveAt" class="text-xs text-admin-muted">
                        {{ format(new Date(login.lastActiveAt), 'dd MMM yyyy HH:mm') }}
                      </span>
                    </RouterLink>
                  </li>
                </ul>
              </td>
            </tr>
          </template>
          <tr v-if="!devices.length">
            <td colspan="7" class="py-8 text-center text-admin-muted">No devices registered</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmActionDialog
      :open="confirmLogoutAll"
      title="Logout all devices"
      message="This ends every active login for this user (up to 3). They will need to sign in again. Devices are not banned."
      confirm-label="Logout all"
      variant="warn"
      require-confirm-text
      @close="confirmLogoutAll = false"
      @confirm="logoutAll"
    />
  </div>
</template>
