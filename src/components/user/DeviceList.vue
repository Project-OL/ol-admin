<script setup lang="ts">

import { ref } from 'vue'

import { format } from 'date-fns'

import type { DeviceInfo } from '@/types/user'

import StatusBadge from '@/components/shared/StatusBadge.vue'

import { useUserDetailStore } from '@/stores/userDetail'



const props = defineProps<{

  userId: string

  devices: DeviceInfo[]

}>()



const store = useUserDetailStore()

const banReason = ref('Policy violation')

const banning = ref(false)



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

</script>



<template>

  <div class="admin-card">

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">

      <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">Registered Devices</h2>

      <div class="flex items-center gap-2">

        <input v-model="banReason" type="text" class="admin-input w-40 py-1 text-xs" placeholder="Ban reason" />

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



    <div class="admin-table-wrap">

      <table class="admin-table">

        <thead>

          <tr>

            <th>Device</th>

            <th>Platform</th>

            <th>IP</th>

            <th>Last Active</th>

            <th>Status</th>

            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          <tr v-for="device in devices" :key="device.id">

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

              <StatusBadge :status="device.isBanned ? 'banned' : 'active'" :label="device.isBanned ? 'Banned' : 'OK'" />

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

          <tr v-if="!devices.length">

            <td colspan="6" class="py-8 text-center text-admin-muted">No devices registered</td>

          </tr>

        </tbody>

      </table>

    </div>

  </div>

</template>

