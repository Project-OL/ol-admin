/**
 * Minimal WebSocket client for admin support-ticket realtime.
 * Only handles support-ticket frames (JOIN/LEAVE + STATUS_CHANGED + MESSAGE).
 * Singleton — shared across all views while logged in.
 */

import { ref } from 'vue'
import api from '@/api/client'

const WS_BASE_URL = (() => {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string ?? 'https://api.offoolive.com/api/v1'
  return apiBase.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '')
})()

const PING_INTERVAL_MS = 35_000

export type AdminWsServerFrame =
  | { t: 'PONG'; ts: number }
  | { t: 'ERROR'; code: string; message: string }
  | {
      t: 'SUPPORT_TICKET_MESSAGE'
      ticketId: string
      ticketPublicId: string
      assignedAdminId: string | null
      message: {
        id: string
        publicId: string
        senderType: 'USER' | 'SUPPORT'
        senderUserId: string | null
        content: string
        imageUrl: string | null
        isAutoReply: boolean
        createdAt: string
      }
    }
  | {
      t: 'SUPPORT_TICKET_STATUS_CHANGED'
      ticketId: string
      ticketPublicId: string
      /** `AWAITING_REPLY` means a super admin reopened the ticket. */
      status: 'PENDING_REVIEW' | 'CLOSED' | 'AWAITING_REPLY'
      resolution: 'RESOLVED' | 'REJECTED' | null
      assignedAdminId: string | null
      changedAt: string
    }
  | { t: 'GOAWAY'; reason?: string }

type MessageListener = (frame: AdminWsServerFrame) => void

function createAdminWebSocket() {
  const connected = ref(false)
  const supportTicketSubs = ref<Set<string>>(new Set())
  const listeners = new Set<MessageListener>()

  let ws: WebSocket | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = 1_000
  let intentionalClose = false

  async function getWsTicket(): Promise<string | null> {
    try {
      const { data } = await api.post<{ token: string }>('/admin/auth/ws-ticket')
      return data.token
    } catch {
      return null
    }
  }

  function send(payload: object) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }

  function startPing() {
    stopPing()
    pingInterval = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      send({ t: 'PING', ts: Date.now() })
    }, PING_INTERVAL_MS)
  }

  function stopPing() {
    if (pingInterval) clearInterval(pingInterval)
    pingInterval = null
  }

  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
      void connect()
    }, reconnectDelay)
  }

  async function connect() {
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return
    intentionalClose = false

    const ticket = await getWsTicket()
    if (!ticket) return

    const socket = new WebSocket(`${WS_BASE_URL}/ws?ticket=${ticket}`)
    ws = socket

    socket.onopen = () => {
      connected.value = true
      reconnectDelay = 1_000
      startPing()
      send({ t: 'PING', ts: Date.now() })
      // Rejoin rooms after reconnect
      supportTicketSubs.value.forEach((tid) => send({ t: 'JOIN_SUPPORT_TICKET', ticketId: tid }))
    }

    socket.onmessage = (evt) => {
      try {
        const frame = JSON.parse(String(evt.data)) as AdminWsServerFrame
        if (frame.t === 'GOAWAY') {
          setTimeout(() => void connect(), 2_000)
          return
        }
        for (const cb of listeners) cb(frame)
      } catch { /* malformed */ }
    }

    socket.onclose = (evt) => {
      connected.value = false
      stopPing()
      ws = null
      if (intentionalClose) return
      if (evt.code !== 1000) scheduleReconnect()
    }

    socket.onerror = () => socket.close()
  }

  function disconnect() {
    intentionalClose = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    stopPing()
    ws?.close(1000, 'user_disconnect')
    ws = null
    connected.value = false
  }

  function joinSupportTicket(ticketId: string) {
    if (!ticketId) return
    supportTicketSubs.value.add(ticketId)
    send({ t: 'JOIN_SUPPORT_TICKET', ticketId })
  }

  function leaveSupportTicket(ticketId: string) {
    if (!ticketId) return
    supportTicketSubs.value.delete(ticketId)
    send({ t: 'LEAVE_SUPPORT_TICKET', ticketId })
  }

  function onFrame(cb: MessageListener) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  return {
    connected,
    connect,
    disconnect,
    joinSupportTicket,
    leaveSupportTicket,
    onFrame,
  }
}

let _instance: ReturnType<typeof createAdminWebSocket> | null = null

export function useAdminWebSocket() {
  if (!_instance) _instance = createAdminWebSocket()
  return _instance
}

export function resetAdminWebSocket() {
  _instance?.disconnect()
  _instance = null
}
