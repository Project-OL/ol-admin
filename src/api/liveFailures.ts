import liveApi from '@/api/liveClient'

/** Live-server failure log (backlog LIVE-06): GET /v1/admin/live/failures. */
export type LiveFailureKind =
  | 'GO_LIVE_REJECTED'
  | 'JOIN_REJECTED'
  | 'CLIENT_CONNECT_FAILED'
  | 'GHOST_STREAM_ENDED'
  | 'HEARTBEAT_LOST'

export const LIVE_FAILURE_KIND_LABELS: Record<LiveFailureKind, string> = {
  GO_LIVE_REJECTED: 'Go-live rejected',
  JOIN_REJECTED: 'Join rejected',
  CLIENT_CONNECT_FAILED: 'App: LiveKit connect failed',
  GHOST_STREAM_ENDED: 'Host never connected (ghost)',
  HEARTBEAT_LOST: 'Host heartbeat lost',
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
}

export type LiveFailureDay = {
  day: string
  total: number
  byKind: Record<LiveFailureKind, number>
}

export type LiveFailureList = {
  items: LiveFailureEvent[]
  pagination: { page: number; limit: number; total: number }
  retained: number
  maxRetained: number
  kinds: LiveFailureKind[]
  summary: LiveFailureDay[]
}

export type LiveFailureQuery = {
  kind?: LiveFailureKind
  userId?: string
  streamId?: string
  code?: string
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
