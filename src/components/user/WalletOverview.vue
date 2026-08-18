<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import type { UserProfile } from '@/types/user'
import { userAdminApi } from '@/api/userAdmin'
import { formatCoins, formatPoints } from '@/utils/format'
import { showToast } from '@/utils/toast'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import { useUserDetailStore } from '@/stores/userDetail'

const props = defineProps<{ user: UserProfile }>()
const store = useUserDetailStore()
const useMock = import.meta.env.VITE_USE_MOCK === 'true'

type WalletKind = 'coins' | 'points' | 'trading'

const WALLET_OPTIONS: { key: WalletKind; label: string }[] = [
  { key: 'coins', label: 'Coins' },
  { key: 'points', label: 'Points' },
  { key: 'trading', label: 'Trading coins' },
]

const selected = reactive<Record<WalletKind, boolean>>({
  coins: false,
  points: false,
  trading: false,
})

const pendingMode = ref<'freeze' | 'unfreeze' | null>(null)
const submitting = ref(false)

const selectedKinds = computed(() => WALLET_OPTIONS.filter((opt) => selected[opt.key]).map((opt) => opt.key))
const selectedLabels = computed(() =>
  WALLET_OPTIONS.filter((opt) => selected[opt.key]).map((opt) => opt.label),
)

const dialogTitle = computed(() =>
  pendingMode.value === 'unfreeze' ? 'Unfreeze selected wallets' : 'Freeze selected wallets',
)
const dialogMessage = computed(() => {
  const list = selectedLabels.value.join(', ')
  return pendingMode.value === 'unfreeze'
    ? `Allow spending again for: ${list}.`
    : `Blocks all debits for: ${list}.`
})

function isFrozen(kind: WalletKind) {
  if (kind === 'coins') return props.user.coinsFrozen
  if (kind === 'points') return props.user.pointsFrozen
  return !!props.user.tradingCoinsFrozen
}

function requestAction(mode: 'freeze' | 'unfreeze') {
  if (!selectedKinds.value.length) {
    showToast('Select coins, points, and/or trading coins', 'error')
    return
  }
  pendingMode.value = mode
}

async function applyWalletAction(kind: WalletKind, mode: 'freeze' | 'unfreeze') {
  const id = props.user.id
  if (kind === 'coins') {
    return mode === 'freeze' ? userAdminApi.freezePersonalCoins(id) : userAdminApi.unfreezePersonalCoins(id)
  }
  if (kind === 'points') {
    return mode === 'freeze' ? userAdminApi.freezePoints(id) : userAdminApi.unfreezePoints(id)
  }
  return mode === 'freeze' ? userAdminApi.freezeTradingCoins(id) : userAdminApi.unfreezeTradingCoins(id)
}

async function handleConfirm() {
  if (submitting.value || !pendingMode.value || !selectedKinds.value.length) return
  const mode = pendingMode.value
  submitting.value = true
  try {
    if (useMock) {
      if (store.user) {
        for (const kind of selectedKinds.value) {
          const frozen = mode === 'freeze'
          if (kind === 'coins') store.user.coinsFrozen = frozen
          else if (kind === 'points') store.user.pointsFrozen = frozen
          else store.user.tradingCoinsFrozen = frozen
        }
      }
    } else {
      for (const kind of selectedKinds.value) {
        await applyWalletAction(kind, mode)
      }
      await store.fetchUser(props.user.id)
    }
    showToast(mode === 'freeze' ? 'Wallets frozen' : 'Wallets unfrozen', 'success')
    pendingMode.value = null
  } catch (err) {
    showToast(
      axios.isAxiosError(err) ? err.response?.data?.message || 'Wallet update failed' : 'Wallet update failed',
      'error',
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="admin-card">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">Wallet Overview</h2>
      <RouterLink class="text-xs text-admin-accent underline" to="/admin/currency">
        Open Currency page
      </RouterLink>
    </div>

    <div class="flex flex-wrap gap-3">
      <div class="min-w-min basis-40 grow rounded-md bg-admin-bg/60 p-3">
        <div class="flex items-center gap-1 text-xs text-admin-subtext">
          Personal Coins
          <span v-if="user.coinsFrozen" title="Frozen">🔒</span>
        </div>
        <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatCoins(user.walletCoins) }}</p>
      </div>
      <div class="min-w-min basis-40 grow rounded-md bg-admin-bg/60 p-3">
        <div class="flex items-center gap-1 text-xs text-admin-subtext">
          Points
          <span v-if="user.pointsFrozen" title="Frozen">🔒</span>
        </div>
        <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatPoints(user.points) }}</p>
      </div>
      <div class="min-w-min basis-40 grow rounded-md bg-admin-bg/60 p-3">
        <div class="flex items-center gap-1 text-xs text-admin-subtext">
          Trading Coins
          <span v-if="user.tradingCoinsFrozen" title="Frozen">🔒</span>
        </div>
        <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatCoins(user.coinsInTrading) }}</p>
      </div>
      <div class="min-w-min basis-40 grow rounded-md bg-admin-bg/60 p-3">
        <p class="text-xs text-admin-subtext">Total Recharge</p>
        <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatCoins(user.totalRechargeCoin) }}</p>
      </div>
      <div class="min-w-min basis-40 grow rounded-md bg-admin-bg/60 p-3">
        <p class="text-xs text-admin-subtext">Total Withdrawal (points processed)</p>
        <p class="whitespace-nowrap tabular-nums text-lg font-semibold">{{ formatPoints(user.totalWithdrawUsd) }}</p>
      </div>
    </div>

    <div class="mt-4 space-y-3 border-t border-admin-border pt-4">
      <p class="text-xs font-medium text-admin-subtext">Freeze controls</p>
      <div class="flex flex-wrap gap-4">
        <label
          v-for="opt in WALLET_OPTIONS"
          :key="opt.key"
          class="flex items-center gap-1.5 text-xs text-admin-subtext"
        >
          <input v-model="selected[opt.key]" type="checkbox" class="accent-admin-accent" />
          {{ opt.label }}
          <span v-if="isFrozen(opt.key)" title="Frozen">🔒</span>
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="admin-btn-warn text-xs"
          :disabled="submitting || !selectedKinds.length"
          @click="requestAction('freeze')"
        >
          Freeze
        </button>
        <button
          type="button"
          class="admin-btn-secondary text-xs"
          :disabled="submitting || !selectedKinds.length"
          @click="requestAction('unfreeze')"
        >
          Unfreeze
        </button>
      </div>
    </div>

    <ConfirmActionDialog
      v-if="pendingMode"
      :open="!!pendingMode"
      :title="dialogTitle"
      :message="dialogMessage"
      :confirm-label="pendingMode === 'unfreeze' ? 'Unfreeze' : 'Freeze'"
      :variant="pendingMode === 'unfreeze' ? 'default' : 'warn'"
      @close="pendingMode = null"
      @confirm="handleConfirm"
    />
  </div>
</template>
