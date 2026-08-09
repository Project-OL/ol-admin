<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import axios from 'axios'
import { userAdminApi } from '@/api/userAdmin'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import type { UserProfile } from '@/types/user'
import { showToast } from '@/utils/toast'
import { useUserDetailStore } from '@/stores/userDetail'

const props = defineProps<{ user: UserProfile }>()
const store = useUserDetailStore()

type LevelType = 'wealth' | 'livestream'

const dialogOpen = ref(false)
const levelType = ref<LevelType>('wealth')
const targetLevel = ref(1)
const reason = ref('')
const confirmLower = ref(false)
const acting = ref(false)

const currentLevel = computed(() =>
  levelType.value === 'wealth' ? props.user.wealthLevel : props.user.streamLevel,
)

const maxLevel = computed(() => (levelType.value === 'wealth' ? 200 : 35))

const isLowering = computed(
  () =>
    Number.isFinite(targetLevel.value) &&
    targetLevel.value < currentLevel.value &&
    targetLevel.value >= 1,
)

const isRaising = computed(
  () =>
    Number.isFinite(targetLevel.value) &&
    targetLevel.value > currentLevel.value &&
    targetLevel.value <= maxLevel.value,
)

const canSubmit = computed(() => {
  if (!Number.isFinite(targetLevel.value)) return false
  if (targetLevel.value < 1 || targetLevel.value > maxLevel.value) return false
  if (targetLevel.value === currentLevel.value) return false
  if (isLowering.value && !confirmLower.value) return false
  return true
})

function open(type: LevelType) {
  levelType.value = type
  targetLevel.value = Math.min(currentLevel.value + 1, maxLevel.value)
  reason.value = ''
  confirmLower.value = false
  dialogOpen.value = true
}

watch(levelType, () => {
  targetLevel.value = Math.min(
    (levelType.value === 'wealth' ? props.user.wealthLevel : props.user.streamLevel) + 1,
    levelType.value === 'wealth' ? 200 : 35,
  )
  confirmLower.value = false
})

watch(targetLevel, () => {
  if (!isLowering.value) confirmLower.value = false
})

async function confirm() {
  if (!canSubmit.value || acting.value) return
  acting.value = true
  try {
    const { data } = await userAdminApi.setUserLevel(props.user.id, levelType.value, {
      targetLevel: targetLevel.value,
      reason: reason.value.trim() || undefined,
    })
    showToast(
      `${levelType.value === 'wealth' ? 'Wealth' : 'Livestream'} level ${data.previousLevel} → ${data.currentLevel}`,
      'success',
    )
    dialogOpen.value = false
    await store.fetchUser(props.user.id)
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'LEVEL_ALREADY_AT_TARGET' || code === 'LEVEL_ALREADY_AT_OR_ABOVE') {
        showToast('User is already at that level threshold', 'error')
        return
      }
      if (code === 'INVALID_TARGET_LEVEL') {
        showToast('Target level out of range', 'error')
        return
      }
    }
    showToast('Failed to set level', 'error')
  } finally {
    acting.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <div class="admin-card space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">Levels</h2>
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-md bg-admin-bg/60 p-3">
        <p class="text-xs text-admin-subtext">Wealth</p>
        <p class="tabular-nums text-lg font-semibold">{{ user.wealthLevel }}</p>
        <button type="button" class="admin-btn-secondary mt-2 w-full text-xs" @click="open('wealth')">
          Set wealth level
        </button>
      </div>
      <div class="rounded-md bg-admin-bg/60 p-3">
        <p class="text-xs text-admin-subtext">Livestream</p>
        <p class="tabular-nums text-lg font-semibold">{{ user.streamLevel }}</p>
        <button
          type="button"
          class="admin-btn-secondary mt-2 w-full text-xs"
          @click="open('livestream')"
        >
          Set livestream level
        </button>
      </div>
    </div>
    <p class="text-xs text-admin-muted">
      Sets cumulative XP to the target level threshold (raise or lower). No ledger write.
    </p>
  </div>

  <BaseDialog
    :open="dialogOpen"
    :title="levelType === 'wealth' ? 'Set wealth level' : 'Set livestream level'"
    @close="dialogOpen = false"
  >
    <template #body>
      <div class="space-y-3 text-sm">
        <p class="text-admin-subtext">
          Current level <strong class="text-admin-text">{{ currentLevel }}</strong>
          (range 1–{{ maxLevel }}). Leaving the user at the start of the target level.
        </p>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Target level</label>
          <input
            v-model.number="targetLevel"
            type="number"
            class="admin-input tabular-nums"
            :min="1"
            :max="maxLevel"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs text-admin-subtext">Reason (optional)</label>
          <input
            v-model="reason"
            type="text"
            class="admin-input"
            placeholder="Support adjustment"
            maxlength="500"
          />
        </div>
        <div
          v-if="isLowering"
          class="rounded-md border border-admin-warn/40 bg-admin-warn/10 px-3 py-2 text-xs text-admin-warn"
        >
          <p class="font-medium">Lowering will claw back XP to this level’s threshold.</p>
          <label class="mt-2 flex cursor-pointer items-start gap-2 text-admin-text">
            <input v-model="confirmLower" type="checkbox" class="mt-0.5" />
            <span>I understand this intentionally lowers the user’s level</span>
          </label>
        </div>
        <p v-else-if="isRaising" class="text-xs text-admin-muted">
          Raising will set XP to the threshold for level {{ targetLevel }}.
        </p>
      </div>
    </template>
    <template #footer>
      <button type="button" class="admin-btn-secondary" @click="dialogOpen = false">Cancel</button>
      <button
        type="button"
        class="admin-btn-primary"
        :class="isLowering ? 'bg-admin-warn hover:opacity-90' : ''"
        :disabled="acting || !canSubmit"
        @click="confirm"
      >
        {{
          acting
            ? 'Saving…'
            : isLowering
              ? `Lower to ${targetLevel}`
              : `Set to ${targetLevel}`
        }}
      </button>
    </template>
  </BaseDialog>
</template>
