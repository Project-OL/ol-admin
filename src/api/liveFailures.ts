import liveApi from '@/api/liveClient'

/** Live-server failure log (backlog LIVE-06, hardening BE-01..11): GET /v1/admin/live/failures. */
export type LiveFailureKind =
  | 'GO_LIVE_REJECTED'
  | 'JOIN_REJECTED'
  | 'CLIENT_CONNECT_FAILED'
  | 'GHOST_STREAM_ENDED'
  | 'HEARTBEAT_LOST'
  | 'GOLIVE_ABANDONED'
  | 'CALL_NET_LOST'
  | 'CALL_CONNECT_FAIL'
  | 'CLIENT_EVENT'

export const LIVE_FAILURE_KIND_LABELS: Record<LiveFailureKind, string> = {
  GO_LIVE_REJECTED: 'Go-live rejected',
  JOIN_REJECTED: 'Join rejected',
  CLIENT_CONNECT_FAILED: 'App: LiveKit connect failed',
  GHOST_STREAM_ENDED: 'Host never connected (ghost)',
  HEARTBEAT_LOST: 'Host heartbeat lost',
  GOLIVE_ABANDONED: 'Go-live abandoned (< 30 s, no video)',
  CALL_NET_LOST: 'Call dropped (connection lost)',
  CALL_CONNECT_FAIL: 'Call side never connected',
  CLIENT_EVENT: 'App-reported event',
}

/** S0 critical .. S4 info (crash & reconnect hardening plan). Events before 26 Oct 2026 have none. */
export type LiveFailureSeverity = 'S0' | 'S1' | 'S2' | 'S3' | 'S4'
export const LIVE_FAILURE_SEVERITY_LABELS: Record<LiveFailureSeverity, string> = {
  S0: 'S0 Critical',
  S1: 'S1 High',
  S2: 'S2 Medium',
  S3: 'S3 Low',
  S4: 'S4 Info',
}

export type LiveFailureArea = 'stream' | 'call' | 'socket' | 'app'
export const LIVE_FAILURE_AREA_LABELS: Record<LiveFailureArea, string> = {
  stream: 'Live streams',
  call: 'Video calls',
  socket: 'Sockets',
  app: 'App',
}

export type LiveFailureEvent = {
  id: string
  at: string
  kind: LiveFailureKind
  userId: string | null
  streamId: string | null
  status: number | null
  code: string | null
  message: string | null
  meta: Record<string, string | number | boolean> | null
  user: { id: string; username: string; name: string | null; country: string | null } | null
  // BE-01 fields (absent on events recorded before 2026-10-26)
  severity?: LiveFailureSeverity
  area?: LiveFailureArea
  source?: 'server' | 'app'
  role?: string | null
  callId?: string | null
  occurredAt?: string
  appVersion?: string | null
  platform?: string | null
  deviceModel?: string | null
  network?: string | null
}

export type LiveFailureDay = {
  day: string
  total: number
  byKind: Record<LiveFailureKind, number>
  bySeverity?: Record<LiveFailureSeverity, number>
}

export type LiveFailureList = {
  items: LiveFailureEvent[]
  pagination: { page: number; limit: number; total: number }
  retained: number
  maxRetained: number
  kinds: LiveFailureKind[]
  severities?: LiveFailureSeverity[]
  areas?: LiveFailureArea[]
  summary: LiveFailureDay[]
}

export type LiveFailureQuery = {
  kind?: LiveFailureKind
  userId?: string
  streamId?: string
  code?: string
  severity?: LiveFailureSeverity
  area?: LiveFailureArea
  page?: number
  limit?: number
}

export const liveFailuresApi = {
  async list(query: LiveFailureQuery = {}): Promise<LiveFailureList> {
    const { data } = await liveApi.get<{ success?: boolean; data: LiveFailureList }>(
      '/v1/admin/live/failures',
      { params: query },
    )
    return data.data
  },
}
