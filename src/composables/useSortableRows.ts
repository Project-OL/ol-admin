import { computed, ref, type Ref } from 'vue'

export type SortDirection = 'asc' | 'desc'

/**
 * Client-side column sort for an admin table's currently-loaded rows (the
 * fetched page, not a server-side re-query). Click a column: asc -> desc ->
 * unsorted (back to the original/server order).
 */
export function useSortableRows<T>(
  rows: Ref<T[]>,
  getValue: (row: T, key: string) => unknown = (row, key) => (row as Record<string, unknown>)[key],
) {
  const sortKey = ref<string | null>(null)
  const sortDir = ref<SortDirection>('asc')

  function toggleSort(key: string) {
    if (sortKey.value !== key) {
      sortKey.value = key
      sortDir.value = 'asc'
    } else if (sortDir.value === 'asc') {
      sortDir.value = 'desc'
    } else {
      sortKey.value = null
    }
  }

  function compareValues(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0
    if (a == null) return -1
    if (b == null) return 1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
    // localeCompare with numeric:true also correctly orders ISO date strings and numeric-looking strings
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
  }

  const sortedRows = computed<T[]>(() => {
    if (!sortKey.value) return rows.value
    const key = sortKey.value
    const dir = sortDir.value === 'asc' ? 1 : -1
    return [...rows.value].sort((a, b) => dir * compareValues(getValue(a, key), getValue(b, key)))
  })

  return { sortKey, sortDir, sortedRows, toggleSort }
}
