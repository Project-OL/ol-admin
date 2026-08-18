import liveApi from '@/api/liveClient'
import type { ApiUserRestriction, UserRestrictionType } from '@/types/api'

export const LIVE_ENFORCED_RESTRICTION_TYPES = [
  'LIVE_CHAT_MUTE',
  'LIVE_AUDIO_MUTE',
  'LIVE_STREAM_START_BAN',
] as const satisfies readonly UserRestrictionType[]

export type LiveEnforcedRestrictionType = (typeof LIVE_ENFORCED_RESTRICTION_TYPES)[number]

export type LiveRestrictionRow = {
  id: string
  userId?: string
  type: UserRestrictionType
  restrictedUntil: string
  reason?: string | null
  reportId?: string | null
  createdByAdminId?: string | null
  clearedAt?: string | null
  clearedByAdminId?: string | null
  createdAt?: string
  updatedAt?: string
}

type LiveEnvelope<T> = {
  success?: boolean
  message?: string
  data?: T
  clearedCount?: number
}

export type ApplyLiveRestrictionPayload = {
  type: UserRestrictionType
  restrictedUntil: string
  reason?: string
  reportId?: string
}

function unwrapData<T>(body: LiveEnvelope<T> | T): T {
  if (body && typeof body === 'object' && 'data' in body && (body as LiveEnvelope<T>).data !== undefined) {
    return (body as LiveEnvelope<T>).data as T
  }
  return body as T
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  return value.toISOString()
}

export function isLiveRestrictionActive(row: Pick<LiveRestrictionRow, 'clearedAt' | 'restrictedUntil'>): boolean {
  if (row.clearedAt) return false
  return new Date(row.restrictedUntil).getTime() > Date.now()
}

export function isLiveEnforcedRestrictionType(type: string): type is LiveEnforcedRestrictionType {
  return (LIVE_ENFORCED_RESTRICTION_TYPES as readonly string[]).includes(type)
}

export function normalizeLiveRestriction(row: LiveRestrictionRow): ApiUserRestriction {
  const restrictedUntil = toIso(row.restrictedUntil) ?? new Date().toISOString()
  const clearedAt = toIso(row.clearedAt)
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    restrictedUntil,
    reason: row.reason ?? null,
    reportId: row.reportId ?? null,
    createdByAdminId: row.createdByAdminId ?? undefined,
    clearedAt,
    clearedByAdminId: row.clearedByAdminId ?? null,
    createdAt: toIso(row.createdAt) ?? undefined,
    updatedAt: toIso(row.updatedAt) ?? undefined,
    active: isLiveRestrictionActive({ clearedAt, restrictedUntil }),
  }
}

export const liveRestrictionsApi = {
  async list(userId: string): Promise<ApiUserRestriction[]> {
    const { data } = await liveApi.get<LiveEnvelope<LiveRestrictionRow[]> | LiveRestrictionRow[]>(
      `/v1/admin/users/${userId}/restrictions`,
    )
    const rows = unwrapData(data)
    return (Array.isArray(rows) ? rows : []).map(normalizeLiveRestriction)
  },

  async apply(userId: string, payload: ApplyLiveRestrictionPayload): Promise<ApiUserRestriction> {
    const { data } = await liveApi.post<LiveEnvelope<LiveRestrictionRow> | LiveRestrictionRow>(
      `/v1/admin/users/${userId}/restrictions`,
      {
        type: payload.type,
        restrictedUntil: payload.restrictedUntil,
        reason: payload.reason,
        reportId: payload.reportId,
      },
    )
    return normalizeLiveRestriction(unwrapData(data) as LiveRestrictionRow)
  },

  async delete(userId: string, restrictionId: string): Promise<void> {
    await liveApi.delete(`/v1/admin/users/${userId}/restrictions/${restrictionId}`)
  },

  async clearByType(userId: string, type: UserRestrictionType): Promise<number> {
    const { data } = await liveApi.post<LiveEnvelope<unknown> & { clearedCount?: number }>(
      `/v1/admin/users/${userId}/restrictions/${type}/clear`,
    )
    return Number(data?.clearedCount ?? 0)
  },
}
