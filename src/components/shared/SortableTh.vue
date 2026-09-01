<script setup lang="ts">
defineProps<{
  label: string
  sortKey: string
  activeKey: string | null
  direction: 'asc' | 'desc'
}>()

const emit = defineEmits<{ sort: [key: string] }>()
</script>

<template>
  <th
    class="cursor-pointer select-none hover:text-admin-text"
    :aria-sort="activeKey === sortKey ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'"
    @click="emit('sort', sortKey)"
  >
    <span class="inline-flex items-center gap-1">
      {{ label }}
      <span class="text-[10px]" :class="activeKey === sortKey ? 'text-admin-accent' : 'text-admin-muted'">
        <template v-if="activeKey === sortKey">{{ direction === 'asc' ? '▲' : '▼' }}</template>
        <template v-else>⇅</template>
      </span>
    </span>
  </th>
</template>
