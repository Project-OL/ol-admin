<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    open: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const emit = defineEmits<{
  close: []
  confirm: []
}>()

const sizeClasses = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  },
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          :class="[
            'relative flex max-h-[min(92dvh,100vh)] w-full flex-col rounded-t-2xl border border-admin-border bg-admin-surface shadow-2xl sm:rounded-xl',
            sizeClasses[size],
          ]"
          role="dialog"
          aria-modal="true"
        >
          <div class="flex shrink-0 items-center justify-between border-b border-admin-border px-4 py-3 sm:px-5 sm:py-4">
            <h2 class="min-w-0 truncate pr-2 text-base font-semibold text-admin-text sm:text-lg">
              {{ title }}
            </h2>
            <button
              type="button"
              class="shrink-0 rounded-md p-1.5 text-admin-subtext hover:bg-admin-border hover:text-admin-text"
              aria-label="Close"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <slot name="body" />
          </div>
          <div
            v-if="$slots.footer"
            class="admin-dialog-footer shrink-0 border-t border-admin-border px-4 py-3 sm:px-5 sm:py-4"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
