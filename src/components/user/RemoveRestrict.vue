<script setup lang="ts">

import { ref } from 'vue'

import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'

import { useUserDetailStore } from '@/stores/userDetail'



const props = defineProps<{ userId: string }>()

const store = useUserDetailStore()



type Action =

  | 'removePicture'

  | 'removeBio'

  | 'resetIdentity'

  | 'removeAgency'

  | null



const activeAction = ref<Action>(null)



const configs: Record<Exclude<Action, null>, {

  title: string

  message: string

  confirmLabel: string

  variant: 'danger' | 'warn' | 'default'

  requireReason?: boolean

}> = {

  removePicture: {

    title: 'Remove Profile Picture',

    message: 'The user\'s avatar will be removed.',

    confirmLabel: 'Remove',

    variant: 'danger',

  },

  removeBio: {

    title: 'Remove Bio',

    message: 'The user\'s bio will be cleared.',

    confirmLabel: 'Remove',

    variant: 'danger',

  },

  resetIdentity: {

    title: 'Reset Identity',

    message: 'Clears first/last name and sets username to user_{publicId}.',

    confirmLabel: 'Reset Identity',

    variant: 'warn',

  },

  removeAgency: {

    title: 'Remove from Agency',

    message: 'This user will be removed from their agency. Fails if user is agency owner.',

    confirmLabel: 'Remove',

    variant: 'warn',

    requireReason: true,

  },

}



async function handleAction() {

  switch (activeAction.value) {

    case 'removePicture':

      await store.removeProfilePicture(props.userId)

      break

    case 'removeBio':

      await store.removeBio(props.userId)

      break

    case 'resetIdentity':

      await store.resetIdentity(props.userId)

      break

    case 'removeAgency':

      await store.removeFromAgency(props.userId)

      break

  }

  activeAction.value = null

}

</script>



<template>

  <div class="admin-card">

    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-admin-subtext">Profile & Agency</h2>



    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">

      <button type="button" class="admin-btn-danger text-xs" @click="activeAction = 'removePicture'">

        Remove Profile Picture

      </button>

      <button type="button" class="admin-btn-danger text-xs" @click="activeAction = 'removeBio'">

        Remove Bio

      </button>

      <button type="button" class="admin-btn-warn text-xs" @click="activeAction = 'resetIdentity'">

        Reset Identity

      </button>

      <button type="button" class="admin-btn-warn text-xs" @click="activeAction = 'removeAgency'">

        Remove from Agency

      </button>

    </div>



    <ConfirmActionDialog

      v-if="activeAction"

      :open="!!activeAction"

      v-bind="configs[activeAction]"

      @close="activeAction = null"

      @confirm="handleAction"

    />

  </div>

</template>

