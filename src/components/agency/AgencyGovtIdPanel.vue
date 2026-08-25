<script setup lang="ts">
import { ref, watch } from 'vue'
import { format } from 'date-fns'

const props = defineProps<{
  govtIdUrl?: string | null
  govtIdSubmittedAt?: string | null
  uploading?: boolean
}>()

const emit = defineEmits<{
  replace: [file: File]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const imgBroken = ref(false)

watch(
  () => props.govtIdUrl,
  () => {
    imgBroken.value = false
  },
)

function formatDate(value: string | null | undefined) {
  if (!value) return null
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm')
  } catch {
    return value
  }
}

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('replace', file)
}
</script>

<template>
  <div class="space-y-2">
    <div
      class="flex aspect-[4/3] max-h-56 items-center justify-center overflow-hidden rounded-lg border border-admin-border bg-admin-bg"
    >
      <a
        v-if="govtIdUrl && !imgBroken"
        :href="govtIdUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="block h-full w-full"
      >
        <img
          :src="govtIdUrl"
          alt="Government ID"
          class="h-full w-full object-contain"
          @error="imgBroken = true"
        />
      </a>
      <a
        v-else-if="govtIdUrl"
        :href="govtIdUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-admin-accent hover:underline"
      >
        Open document
      </a>
      <span v-else class="text-sm text-admin-muted">Not uploaded</span>
    </div>
    <div class="flex flex-wrap items-center gap-2 text-xs text-admin-muted">
      <span>{{ govtIdUrl ? 'Uploaded' : 'Missing' }}</span>
      <a
        v-if="govtIdUrl"
        :href="govtIdUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-admin-accent hover:underline"
      >
        Open
      </a>
      <span v-if="formatDate(govtIdSubmittedAt)">· {{ formatDate(govtIdSubmittedAt) }}</span>
    </div>
    <div>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        class="hidden"
        @change="onFile"
      />
      <button
        type="button"
        class="admin-btn-secondary text-xs"
        :disabled="uploading"
        @click="fileInput?.click()"
      >
        {{ uploading ? 'Uploading…' : govtIdUrl ? 'Replace government ID' : 'Upload government ID' }}
      </button>
    </div>
  </div>
</template>
