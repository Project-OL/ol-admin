<script setup lang="ts">
import { computed } from 'vue'
import { isAllowedCatalogAssetFile } from '@/utils/catalogValidation'
import { showToast } from '@/utils/toast'

const props = withDefaults(
  defineProps<{
    label: string
    mode: 'url' | 'file'
    url: string
    file: File | null
    domain: 'gift' | 'store'
    accept: string
    required?: boolean
    optional?: boolean
    error?: string | null
    existingUrl?: string | null
  }>(),
  {
    required: false,
    optional: false,
    error: null,
    existingUrl: null,
  },
)

const emit = defineEmits<{
  'update:mode': [value: 'url' | 'file']
  'update:url': [value: string]
  'update:file': [value: File | null]
}>()

const previewUrl = computed(() => {
  if (props.mode === 'url' && props.url.trim()) return props.url.trim()
  if (
    props.mode === 'file' &&
    props.file &&
    (props.file.type.startsWith('image/') || props.file.type.startsWith('video/'))
  ) {
    return URL.createObjectURL(props.file)
  }
  if (props.mode === 'file' && !props.file && props.existingUrl) return props.existingUrl
  return null
})

const isVideoPreview = computed(() => {
  if (props.mode === 'file' && props.file?.type.startsWith('video/')) return true
  const src = previewUrl.value
  if (!src) return false
  return /\.(mp4|webm)(\?|$)/i.test(src)
})

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0] ?? null
  if (!selected) {
    emit('update:file', null)
    return
  }
  const check = isAllowedCatalogAssetFile(selected, props.domain)
  if (!check.ok) {
    input.value = ''
    emit('update:file', null)
    showToast(check.message, 'error')
    return
  }
  emit('update:file', selected)
}

function setMode(next: 'url' | 'file') {
  emit('update:mode', next)
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <label class="text-xs text-admin-subtext">
        {{ label }}
        <span v-if="optional" class="text-admin-muted">(optional)</span>
        <span v-else-if="required" class="text-admin-danger">*</span>
      </label>
      <div class="flex rounded-md border border-admin-border p-0.5 text-xs">
        <button
          type="button"
          :class="[
            'rounded px-2 py-1 transition-colors',
            mode === 'url' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="setMode('url')"
        >
          URL
        </button>
        <button
          type="button"
          :class="[
            'rounded px-2 py-1 transition-colors',
            mode === 'file' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
          ]"
          @click="setMode('file')"
        >
          Upload
        </button>
      </div>
    </div>

    <input
      v-if="mode === 'url'"
      :value="url"
      class="admin-input"
      placeholder="https://…"
      @input="emit('update:url', ($event.target as HTMLInputElement).value)"
    />
    <div v-else class="space-y-2">
      <input
        type="file"
        class="admin-input cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-admin-accent file:px-3 file:py-1 file:text-xs file:text-white"
        :accept="accept"
        @change="onFileChange"
      />
      <p v-if="file" class="text-xs text-admin-subtext">
        {{ file.name }} · {{ (file.size / 1024).toFixed(1) }} KB
      </p>
      <p v-else-if="existingUrl" class="text-xs text-admin-muted">
        Current file kept unless you choose a new upload.
      </p>
    </div>

    <div v-if="previewUrl" class="flex items-center gap-2">
      <video
        v-if="isVideoPreview"
        :src="previewUrl"
        class="h-12 w-12 rounded border border-admin-border object-cover"
        muted
        playsinline
        preload="metadata"
      />
      <img
        v-else
        :src="previewUrl"
        :alt="label"
        class="h-12 w-12 rounded border border-admin-border object-cover"
      />
      <span class="text-xs text-admin-muted">Preview</span>
    </div>

    <p v-if="error" class="text-xs text-admin-danger">{{ error }}</p>
  </div>
</template>
