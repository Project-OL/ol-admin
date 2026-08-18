import type {
  SupportTicketInitialSubmission,
  SupportTicketListItem,
} from '@/types/customerSupport'

type TicketWithSubmission = Pick<
  SupportTicketListItem,
  | 'type'
  | 'subType'
  | 'typeLabel'
  | 'subTypeLabel'
  | 'description'
  | 'imageUrl'
  | 'refType'
  | 'refId'
  | 'createdAt'
  | 'initialSubmission'
>

/** Prefer `initialSubmission`; fall back to legacy top-level ticket fields. */
export function resolveInitialSubmission(
  ticket: TicketWithSubmission,
): SupportTicketInitialSubmission | null {
  if (ticket.initialSubmission) return ticket.initialSubmission

  const description = ticket.description?.trim()
  const imageUrl = ticket.imageUrl?.trim()
  if (!description && !imageUrl && !ticket.subType) return null

  return {
    type: ticket.type,
    subType: ticket.subType,
    typeLabel: ticket.typeLabel,
    subTypeLabel: ticket.subTypeLabel,
    description: ticket.description ?? null,
    imageUrl: ticket.imageUrl ?? null,
    transactionRef:
      ticket.refType && ticket.refId
        ? { refType: ticket.refType, refId: ticket.refId }
        : null,
    submittedAt: ticket.createdAt,
  }
}

export function ticketCategoryLabels(ticket: TicketWithSubmission) {
  const init = resolveInitialSubmission(ticket)
  const typeLabel = init?.typeLabel?.trim() || init?.type || ticket.typeLabel?.trim() || ticket.type
  const subTypeLabel =
    init?.subTypeLabel?.trim() || init?.subType || ticket.subTypeLabel?.trim() || ticket.subType || null
  return { typeLabel, subTypeLabel }
}

/** Breadcrumb: "Consult → Top Up" */
export function ticketCategoryBreadcrumb(ticket: TicketWithSubmission): string {
  const { typeLabel, subTypeLabel } = ticketCategoryLabels(ticket)
  if (subTypeLabel) return `${typeLabel} → ${subTypeLabel}`
  return typeLabel
}

export function ticketOpeningPreview(ticket: TicketWithSubmission): string | null {
  const init = resolveInitialSubmission(ticket)
  const text = init?.description?.trim()
  return text || null
}
