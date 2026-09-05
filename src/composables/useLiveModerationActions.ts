import axios from 'axios'
import { liveRestrictionsApi } from '@/api/liveRestrictions'
import { userAdminApi } from '@/api/userAdmin'
import { customerSupportApi } from '@/api/customerSupport'
import type { UserRestrictionType } from '@/types/api'
import { showToast } from '@/utils/toast'

function hoursFromNowIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function errorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { message?: string } | undefined
    return body?.message || fallback
  }
  return fallback
}

export function useLiveModerationActions() {
  async function applyMute(params: {
    userId: string
    type: Extract<UserRestrictionType, 'LIVE_CHAT_MUTE' | 'LIVE_AUDIO_MUTE' | 'LIVE_STREAM_START_BAN'>
    hours?: number
    reason?: string
    reportId?: string
  }) {
    try {
      await liveRestrictionsApi.apply(params.userId, {
        type: params.type,
        restrictedUntil: hoursFromNowIso(params.hours ?? 24),
        reason: params.reason,
        reportId: params.reportId,
      })
      const label =
        params.type === 'LIVE_CHAT_MUTE'
          ? 'Live chat muted'
          : params.type === 'LIVE_AUDIO_MUTE'
            ? 'Live audio muted'
            : 'Live-start ban applied'
      showToast(`${label} for ${params.hours ?? 24}h`, 'success')
      return true
    } catch (err) {
      showToast(errorMessage(err, 'Failed to apply restriction'), 'error')
      return false
    }
  }

  async function clearLiveRestriction(userId: string, restrictionId: string) {
    try {
      await liveRestrictionsApi.delete(userId, restrictionId)
      showToast('Restriction cleared', 'success')
      return true
    } catch (err) {
      showToast(errorMessage(err, 'Failed to clear restriction'), 'error')
      return false
    }
  }

  async function stopLive(streamRef: string, reason?: string) {
    try {
      const { data } = await userAdminApi.stopLiveStreamGlobal(streamRef, reason)
      showToast(data.message || `Room ${data.roomId} closed`, 'success')
      return true
    } catch (err) {
      showToast(errorMessage(err, 'Failed to close live stream'), 'error')
      return false
    }
  }

  async function stopAllLive(params: { country?: string; reason?: string }) {
    try {
      const { data } = await userAdminApi.stopAllActiveLiveStreams(params)
      showToast(
        data.failed > 0
          ? `Closed ${data.stopped} stream(s), ${data.failed} failed`
          : `Closed ${data.stopped} stream(s)`,
        data.failed > 0 ? 'error' : 'success',
      )
      return true
    } catch (err) {
      showToast(errorMessage(err, 'Failed to close streams'), 'error')
      return false
    }
  }

  async function liftHostBan(userId: string) {
    try {
      await userAdminApi.clearHostStreamSuspension(userId)
      showToast('Host streaming suspension cleared', 'success')
      return true
    } catch (err) {
      showToast(errorMessage(err, 'Failed to clear host suspension'), 'error')
      return false
    }
  }

  async function reviewReport(
    reportId: string,
    status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED',
    resolutionNote?: string,
  ) {
    try {
      await customerSupportApi.reviewReport(reportId, { status, resolutionNote })
      showToast('Report updated', 'success')
      return true
    } catch (err) {
      showToast(errorMessage(err, 'Failed to update report'), 'error')
      return false
    }
  }

  return { applyMute, clearLiveRestriction, stopLive, stopAllLive, liftHostBan, reviewReport }
}
