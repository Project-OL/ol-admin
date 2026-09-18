import api from '@/api/client'
import type { CountryScopedUser } from '@/types/api'

export const countryUserSearchApi = {
  /**
   * Country-scoped, minimal-field search. `userId` in the response is only
   * for targeting restriction/remove-avatar actions — never render it.
   */
  search(params: { country?: string; q?: string; limit?: number } = {}) {
    return api.get<{ users: CountryScopedUser[] }>('/admin/users/country-search', { params })
  },
}
