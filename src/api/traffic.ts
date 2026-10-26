import api from '@/api/client'
import type { TrafficDay, TrafficNow, TrafficRange } from '@/types/traffic'

export const trafficApi = {
  getNow() {
    return api.get<TrafficNow>('/admin/traffic/now')
  },

  /** `date` = IST day `YYYY-MM-DD`; omitted = today. */
  getDay(date?: string) {
    return api.get<TrafficDay>('/admin/traffic/day', { params: date ? { date } : undefined })
  },

  getRange(days: 7 | 30 = 7) {
    return api.get<TrafficRange>('/admin/traffic/range', { params: { days } })
  },
}
