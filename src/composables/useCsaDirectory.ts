import { ref } from 'vue'
import { customerSupportApi } from '@/api/customerSupport'
import type { CsaDirectoryEntry } from '@/types/customerSupport'
import { showToast } from '@/utils/toast'

function csaLabel(csa: CsaDirectoryEntry) {
  return csa.username ? `${csa.name} (@${csa.username})` : csa.name
}

/**
 * ACTIVE CSA picker list. Prefers GET /csas/directory (CSA + SUPER_ADMIN);
 * falls back to the SUPER_ADMIN roster when the directory is not in the view.
 */
export function useCsaDirectory() {
  const csas = ref<CsaDirectoryEntry[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const { data } = await customerSupportApi.listCsaDirectory()
      csas.value = data.csas ?? []
    } catch {
      try {
        const { data } = await customerSupportApi.listCsas({ status: 'ACTIVE', limit: 100 })
        csas.value = (data.csas ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          username: c.username,
        }))
      } catch {
        csas.value = []
        showToast('Failed to load CSA list', 'error')
      }
    } finally {
      loading.value = false
    }
  }

  return { csas, loading, load, csaLabel }
}
