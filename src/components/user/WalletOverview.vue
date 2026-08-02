<script setup lang="ts">

import { ref } from 'vue'

import type { UserProfile } from '@/types/user'

import { formatCoins, formatPoints } from '@/utils/format'

import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'

import { useUserDetailStore } from '@/stores/userDetail'



const props = defineProps<{ user: UserProfile }>()

const store = useUserDetailStore()



type WalletAction =

  | 'addPersonalCoins'

  | 'deductPersonalCoins'

  | 'addTradingCoins'

  | 'deductTradingCoins'

  | 'addPoints'

  | 'deductPoints'

  | 'freezePersonalCoins'

  | 'unfreezePersonalCoins'

  | 'freezeTradingCoins'

  | 'unfreezeTradingCoins'

  | 'freezePoints'

  | 'unfreezePoints'

  | null



const activeAction = ref<WalletAction>(null)



const dialogConfig: Record<Exclude<WalletAction, null>, {

  title: string

  message: string

  confirmLabel: string

  variant: 'default' | 'danger' | 'warn'

  amountInput?: boolean

  requireReason?: boolean

  requireConfirmText?: boolean

}> = {

  addPersonalCoins: {

    title: 'Add Personal Coins',

    message: 'Credit personal coins to this user\'s wallet.',

    confirmLabel: 'Add Coins',

    variant: 'default',

    amountInput: true,

    requireReason: true,

  },

  deductPersonalCoins: {

    title: 'Deduct Personal Coins',

    message: 'Deduct personal coins from this user\'s wallet.',

    confirmLabel: 'Deduct Coins',

    variant: 'danger',

    amountInput: true,

    requireReason: true,

    requireConfirmText: true,

  },

  addTradingCoins: {

    title: 'Add Trading Coins',

    message: 'Credit trading coins to this user\'s wallet.',

    confirmLabel: 'Add Trading Coins',

    variant: 'default',

    amountInput: true,

    requireReason: true,

  },

  deductTradingCoins: {

    title: 'Deduct Trading Coins',

    message: 'Deduct trading coins from this user\'s wallet.',

    confirmLabel: 'Deduct',

    variant: 'danger',

    amountInput: true,

    requireReason: true,

    requireConfirmText: true,

  },

  addPoints: {

    title: 'Add Points',

    message: 'Credit points to this user\'s wallet.',

    confirmLabel: 'Add Points',

    variant: 'default',

    amountInput: true,

    requireReason: true,

  },

  deductPoints: {

    title: 'Deduct Points',

    message: 'Deduct points from this user\'s wallet.',

    confirmLabel: 'Deduct Points',

    variant: 'danger',

    amountInput: true,

    requireReason: true,

    requireConfirmText: true,

  },

  freezePersonalCoins: {

    title: 'Freeze Personal Coins',

    message: 'Blocks all personal coin debits.',

    confirmLabel: 'Freeze',

    variant: 'warn',

  },

  unfreezePersonalCoins: {

    title: 'Unfreeze Personal Coins',

    message: 'Allow personal coin spending again.',

    confirmLabel: 'Unfreeze',

    variant: 'default',

  },

  freezeTradingCoins: {

    title: 'Freeze Trading Coins',

    message: 'Blocks all trading coin debits.',

    confirmLabel: 'Freeze',

    variant: 'warn',

  },

  unfreezeTradingCoins: {

    title: 'Unfreeze Trading Coins',

    message: 'Allow trading coin spending again.',

    confirmLabel: 'Unfreeze',

    variant: 'default',

  },

  freezePoints: {

    title: 'Freeze Points',

    message: 'Blocks all point debits.',

    confirmLabel: 'Freeze',

    variant: 'warn',

  },

  unfreezePoints: {

    title: 'Unfreeze Points',

    message: 'Allow point spending again.',

    confirmLabel: 'Unfreeze',

    variant: 'default',

  },

}



async function handleConfirm(payload: { reason?: string; amount?: number }) {

  if (!activeAction.value) return

  await store.walletAction(

    props.user.id,

    activeAction.value,

    payload.amount,

    payload.reason,

  )

  activeAction.value = null

}

</script>



<template>

  <div class="admin-card">

    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-admin-subtext">Wallet Overview</h2>



    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">

      <div class="rounded-md bg-admin-bg/60 p-3">

        <div class="flex items-center gap-1 text-xs text-admin-subtext">

          Personal Coins

          <span v-if="user.coinsFrozen" title="Frozen">🔒</span>

        </div>

        <p class="tabular-nums text-lg font-semibold">{{ formatCoins(user.walletCoins) }}</p>

      </div>

      <div class="rounded-md bg-admin-bg/60 p-3">

        <div class="flex items-center gap-1 text-xs text-admin-subtext">

          Points

          <span v-if="user.pointsFrozen" title="Frozen">🔒</span>

        </div>

        <p class="tabular-nums text-lg font-semibold">{{ formatPoints(user.points) }}</p>

      </div>

      <div class="rounded-md bg-admin-bg/60 p-3">

        <div class="flex items-center gap-1 text-xs text-admin-subtext">

          Trading Coins

          <span v-if="user.tradingCoinsFrozen" title="Frozen">🔒</span>

        </div>

        <p class="tabular-nums text-lg font-semibold">{{ formatCoins(user.coinsInTrading) }}</p>

      </div>

      <div class="rounded-md bg-admin-bg/60 p-3">

        <p class="text-xs text-admin-subtext">Total Recharge</p>

        <p class="tabular-nums text-lg font-semibold">{{ formatCoins(user.totalRechargeCoin) }}</p>

      </div>

      <div class="rounded-md bg-admin-bg/60 p-3 sm:col-span-2">

        <p class="text-xs text-admin-subtext">Total Withdrawal (points processed)</p>

        <p class="tabular-nums text-lg font-semibold">{{ formatPoints(user.totalWithdrawUsd) }}</p>

      </div>

    </div>



    <div class="mt-4 space-y-2">

      <p class="text-xs font-medium text-admin-subtext">Personal Coins</p>

      <div class="flex flex-wrap gap-2">

        <button type="button" class="admin-btn-primary text-xs" @click="activeAction = 'addPersonalCoins'">Add</button>

        <button type="button" class="admin-btn-danger text-xs" @click="activeAction = 'deductPersonalCoins'">Deduct</button>

        <button type="button" class="admin-btn-warn text-xs" @click="activeAction = 'freezePersonalCoins'">Freeze</button>

        <button type="button" class="admin-btn-secondary text-xs" @click="activeAction = 'unfreezePersonalCoins'">Unfreeze</button>

      </div>

      <p class="text-xs font-medium text-admin-subtext">Trading Coins</p>

      <div class="flex flex-wrap gap-2">

        <button type="button" class="admin-btn-primary text-xs" @click="activeAction = 'addTradingCoins'">Add</button>

        <button type="button" class="admin-btn-danger text-xs" @click="activeAction = 'deductTradingCoins'">Deduct</button>

        <button type="button" class="admin-btn-warn text-xs" @click="activeAction = 'freezeTradingCoins'">Freeze</button>

        <button type="button" class="admin-btn-secondary text-xs" @click="activeAction = 'unfreezeTradingCoins'">Unfreeze</button>

      </div>

      <p class="text-xs font-medium text-admin-subtext">Points</p>

      <div class="flex flex-wrap gap-2">

        <button type="button" class="admin-btn-primary text-xs" @click="activeAction = 'addPoints'">Add</button>

        <button type="button" class="admin-btn-danger text-xs" @click="activeAction = 'deductPoints'">Deduct</button>

        <button type="button" class="admin-btn-warn text-xs" @click="activeAction = 'freezePoints'">Freeze</button>

        <button type="button" class="admin-btn-secondary text-xs" @click="activeAction = 'unfreezePoints'">Unfreeze</button>

      </div>

    </div>



    <ConfirmActionDialog

      v-if="activeAction"

      :open="!!activeAction"

      v-bind="dialogConfig[activeAction]"

      @close="activeAction = null"

      @confirm="handleConfirm"

    />

  </div>

</template>

