<script setup lang="ts">
import { ref, watch } from 'vue'
import axios from 'axios'
import { format } from 'date-fns'
import { customerSupportApi } from '@/api/customerSupport'
import type { CsaAdmin, CsaIpWhitelistEntry } from '@/types/customerSupport'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import { showToast } from '@/utils/toast'

const props = defineProps<{
  open: boolean
  csa: CsaAdmin | null
}>()

const emit = defineEmits<{
  close: []
}>()

const ips = ref<CsaIpWhitelistEntry[]>([])
const loading = ref(false)
const acting = ref(false)
const newIp = ref('')
const ipError = ref('')

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/
/** Loose IPv6 check — server still validates. */
const IPV6 = /^[0-9a-fA-F:.]{2,45}$/

function isValidIp(raw: string) {
  const ip = raw.trim()
  if (!ip) return false
  if (IPV4.test(ip)) return true
  if (ip.includes(':') && IPV6.test(ip)) return true
  return false
}

async function load() {
  if (!props.csa) return
  loading.value = true
  try {
    const { data } = await customerSupportApi.listCsaIpWhitelist(props.csa.id)
    ips.value = data.ips ?? []
  } catch {
    ips.value = []
    showToast('Failed to load IP allow-list', 'error')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.csa?.id] as const,
  ([open]) => {
    if (open && props.csa) {
      newIp.value = ''
      ipError.value = ''
      void load()
    }
  },
)

async function addIp() {
  if (!props.csa || acting.value) return
  const ipAddress = newIp.value.trim()
  if (!isValidIp(ipAddress)) {
    ipError.value = 'Enter a valid IPv4 or IPv6 address'
    return
  }
  if (ips.value.length >= 20) {
    ipError.value = 'Maximum 20 IPs per agent'
    return
  }
  ipError.value = ''
  acting.value = true
  try {
    const { data } = await customerSupportApi.addCsaIp(props.csa.id, ipAddress)
    ips.value = [...ips.value, data.ip]
    newIp.value = ''
    showToast('IP added', 'success')
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'CSA_IP_CONFLICT') {
        showToast('That IP is already on the allow-list', 'error')
        return
      }
      if (code === 'CSA_IP_LIMIT') {
        showToast('Maximum 20 IPs reached', 'error')
        return
      }
      if (code === 'CSA_NOT_FOUND') {
        showToast('CSA not found', 'error')
        return
      }
    }
    showToast('Failed to add IP', 'error')
  } finally {
    acting.value = false
  }
}

async function removeIp(row: CsaIpWhitelistEntry) {
  if (!props.csa || acting.value) return
  if (ips.value.length <= 1) {
    const ok = confirm(
      'This is the last allow-listed IP. The agent will be unable to log in until another IP is added. Continue?',
    )
    if (!ok) return
  } else {
    const ok = confirm(`Remove ${row.ipAddress} from the allow-list?`)
    if (!ok) return
  }
  acting.value = true
  try {
    await customerSupportApi.removeCsaIp(props.csa.id, row.id)
    ips.value = ips.value.filter((i) => i.id !== row.id)
    showToast('IP removed', 'success')
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'CSA_IP_NOT_FOUND') {
        showToast('IP entry not found', 'error')
        await load()
        return
      }
    }
    showToast('Failed to remove IP', 'error')
  } finally {
    acting.value = false
  }
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="csa ? `IP allow-list · ${csa.name}` : 'IP allow-list'"
    size="lg"
    @close="emit('close')"
  >
    <template #body>
      <p class="mb-3 text-xs text-admin-subtext">
        Exact IPv4/IPv6 only (no CIDR). CSA login is checked against this list.
        An empty list blocks all logins for this agent.
      </p>

      <div class="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          v-model="newIp"
          type="text"
          class="admin-input min-w-0 flex-1 font-mono"
          placeholder="203.0.113.10 or 2001:db8::1"
          maxlength="45"
          @keydown.enter.prevent="addIp"
        />
        <button
          type="button"
          class="admin-btn-primary w-full shrink-0 sm:w-auto"
          :disabled="acting || !newIp.trim()"
          @click="addIp"
        >
          Add IP
        </button>
      </div>
      <p v-if="ipError" class="mb-3 text-xs text-admin-danger">{{ ipError }}</p>
      <p class="mb-2 text-xs text-admin-muted">{{ ips.length }} / 20 IPs</p>

      <div v-if="loading" class="py-8 text-center text-sm text-admin-muted">Loading…</div>
      <div v-else-if="!ips.length" class="rounded-md border border-admin-warn/40 bg-admin-warn/10 px-3 py-4 text-sm text-admin-warn">
        No IPs allow-listed — this agent cannot log in.
      </div>
      <ul v-else class="max-h-[40vh] space-y-2 overflow-y-auto">
        <li
          v-for="row in ips"
          :key="row.id"
          class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-admin-border bg-admin-bg/40 px-3 py-2"
        >
          <div class="min-w-0">
            <p class="font-mono text-sm">{{ row.ipAddress }}</p>
            <p class="text-[10px] text-admin-muted">
              Added {{ format(new Date(row.createdAt), 'dd MMM yyyy HH:mm') }}
            </p>
          </div>
          <button
            type="button"
            class="admin-btn-danger py-1 text-xs"
            :disabled="acting"
            @click="removeIp(row)"
          >
            Remove
          </button>
        </li>
      </ul>
    </template>
    <template #footer>
      <button type="button" class="admin-btn-secondary" @click="emit('close')">Done</button>
    </template>
  </BaseDialog>
</template>
