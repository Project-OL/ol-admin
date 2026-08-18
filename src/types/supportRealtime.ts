/**
 * Support ticket realtime contract (user-app WebSocket).
 * Keep in sync with ol-node-rest `src/realtime/types.ts` and
 * `docs/flow-md/support-ticket-realtime-flow.md`.
 *
 * The admin portal does **not** join `JOIN_SUPPORT_TICKET` (owner-only on `/ws`).
 * CSA workbench uses HTTP polling + `/admin/support/notifications` instead.
 */

export type SupportTicketMessageFrame = {
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

export type SupportTicketDigestFrame = {
  t: 'SUPPORT_TICKET_DIGEST'
  ticketId: string
  ticketPublicId: string
  assignedAdminId: string | null
  senderType: 'USER' | 'SUPPORT'
  preview: string
  createdAt: string
}
