import api from '@/api/client'
import type { AdminCountryAccess } from '@/types/api'

export const adminCountryAccessApi = {
  /** Caller's own granted countries — drives the country-search page's picker. */
  getMyCountries() {
    return api.get<AdminCountryAccess>('/admin/country-access/me')
  },

  getForAdmin(adminId: string) {
    return api.get<AdminCountryAccess>(`/admin/country-access/${adminId}`)
  },

  /** Replace the target admin's granted-country set entirely. Empty array clears all grants. */
  setForAdmin(adminId: string, countries: string[]) {
    return api.put<AdminCountryAccess>(`/admin/country-access/${adminId}`, { countries })
  },
}
