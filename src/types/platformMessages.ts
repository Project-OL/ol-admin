export interface SendMessagePayload {
  message: string
}

export interface SendMessageResponse {
  ok: boolean
  conversationId: string
  messageId: string
  content: string
  campaignId?: string
}

export interface BroadcastNotificationPayload {
  message: string
  userIds?: string[]
  campaignId?: string
}

export interface BroadcastNotificationResponse {
  ok: boolean
  queued: boolean
  campaignId: string | null
}

export type SingleMessageType = 'system' | 'notification'
export type BroadcastScope = 'all' | 'selected'
