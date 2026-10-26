/** TRF-05/06: admin Traffic page (ol-node-rest `/admin/traffic/*`). All days are IST. */

export type TrafficSectionRow = { section: string; users: number; requests: number; errors5xx?: number }

export type TrafficNow = {
  at: string
  onlineUsers: number
  live: {
    at: string
    hostsLive: number | null
    viewers: number | null
    callsActive: number | null
    usersInCalls: number | null
  } | null
  thisHour: { hour: string; users: number; sections: TrafficSectionRow[] }
  lastSampleAt: string | null
}

export type TrafficMinutePoint = {
  t: string
  online: number
  hosts: number | null
  viewers: number | null
  calls: number | null
}

export type TrafficDay = {
  date: string
  timezone: string
  summary: {
    coverageMinutes: number
    peak: { online: number; at: string } | null
    low: { online: number; at: string } | null
    median: number | null
    quietWindow: { from: string; to: string; minutes: number; threshold: number } | null
    activeUsers: number | null
    requests: number | null
    errors5xx: number | null
    peakHostsLive: number | null
  }
  minutes: TrafficMinutePoint[]
  previousDay: { t: string; online: number }[]
  hours: { hour: string; users: number; requests: number; errors5xx: number }[]
  sections: TrafficSectionRow[]
}

export type TrafficRange = {
  days: 7 | 30
  from: string
  to: string
  uniqueUsers: number
  perDay: { date: string; activeUsers: number | null; requests: number | null; peakOnline: number | null }[]
  heatmap: { date: string; hour: number; users: number }[]
  sections: TrafficSectionRow[]
}
