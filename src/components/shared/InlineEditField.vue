<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    type?: 'text' | 'number'
    disabled?: boolean
    placeholder?: string
    /** Shown when value is null/empty (e.g. ∞ for open-ended max). */
    emptyLabel?: string
    /** Appended after the display value (e.g. %). */
    suffix?: string
    nullable?: boolean
    min?: number | string
    max?: number | string
    step?: number | string
    inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
    mono?: boolean
    align?: 'left' | 'right'
  }>(),
  {
    type: 'text',
    disabled: false,
    nullable: false,
    emptyLabel: '—',
    align: 'left',
  },
)

const model = defineModel<string | number | null | undefined>({ required: true })

const editing = ref(false)
/** Always kept as a string — never bind as HTML number input v-model (Vue can coerce to number). */
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

const displayText = computed(() => {
  const v = model.value
  if (v === null || v === undefined || v === '') return props.emptyLabel
  const base = typeof v === 'number' && Number.isFinite(v) ? formatNumber(v) : String(v)
  return props.suffix ? `${base}${props.suffix}` : base
})

const isEmptyDisplay = computed(() => {
  const v = model.value
  return v === null || v === undefined || v === ''
})

const resolvedInputMode = computed(() => {
  if (props.inputmode) return props.inputmode
  if (props.type !== 'number') return undefined
  return isIntegerStep() ? 'numeric' : 'decimal'
})

function formatNumber(n: number) {
  if (Number.isInteger(n)) return String(n)
  return String(Number(n.toPrecision(12)))
}

function isIntegerStep() {
  if (props.step === undefined || props.step === '' || props.step === 'any') return false
  const step = Number(props.step)
  return Number.isFinite(step) && step >= 1 && Number.isInteger(step)
}

function asDraftString(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  return String(raw)
}

/** Parse draft into a model value. Returns undefined if draft is invalid (keep previous). */
function parseDraft(raw: unknown): string | number | null | undefined {
  const text = asDraftString(raw)
  if (props.type === 'number') {
    const trimmed = text.trim()
    if (trimmed === '') {
      return props.nullable ? null : undefined
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n)) return undefined
    return isIntegerStep() ? Math.trunc(n) : n
  }
  return text
}

function applyDraftToModel() {
  if (!editing.value) return
  const parsed = parseDraft(draft.value)
  if (parsed === undefined) return
  if (model.value !== parsed) model.value = parsed
}

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled && editing.value) cancel()
  },
)

// Keep parent v-model in sync while typing so dependents (totals) and Save see live values.
watch(draft, () => {
  if (editing.value) applyDraftToModel()
})

async function startEdit() {
  if (props.disabled || editing.value) return
  const v = model.value
  draft.value = v === null || v === undefined ? '' : String(v)
  editing.value = true
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
}

function cancel() {
  editing.value = false
  draft.value = ''
}

function onDraftInput(e: Event) {
  const el = e.target as HTMLInputElement
  draft.value = el.value
}

function commit() {
  if (!editing.value) return

  const text = asDraftString(draft.value)
  const parsed = parseDraft(text)

  if (props.type === 'number') {
    if (text.trim() === '') {
      if (props.nullable) model.value = null
      cancel()
      return
    }
    if (parsed === undefined) {
      cancel()
      return
    }
    model.value = parsed
    cancel()
    return
  }

  model.value = parsed as string
  cancel()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancel()
  }
}
</script>

<template>
  <div class="min-w-0" :class="align === 'right' ? 'text-right' : 'text-left'">
    <input
      v-if="editing"
      ref="inputEl"
      class="admin-input"
      type="text"
      :value="draft"
      :class="[mono ? 'font-mono text-xs' : '', align === 'right' ? 'text-right' : '']"
      :min="min"
      :max="max"
      :step="step"
      :inputmode="resolvedInputMode"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onDraftInput"
      @blur="commit"
      @keydown="onKeydown"
    />
    <button
      v-else
      type="button"
      class="flex min-h-[2.25rem] w-full items-center rounded-md border border-transparent px-3 py-2 text-sm transition-colors"
      :class="[
        mono ? 'font-mono text-xs' : '',
        isEmptyDisplay ? 'text-admin-muted' : 'text-admin-text',
        disabled
          ? 'cursor-default opacity-60'
          : 'cursor-text hover:border-admin-border hover:bg-admin-bg focus-visible:border-admin-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent',
      ]"
      :disabled="disabled"
      :title="disabled ? undefined : 'Click to edit'"
      @click="startEdit"
    >
      <span class="truncate">{{ displayText }}</span>
    </button>
  </div>
</template>
