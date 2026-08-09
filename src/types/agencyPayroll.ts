export type PayrollAssignmentStatus =
  | 'PENDING'
  | 'WAITING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | string

export type AdminPayrollUserCard = {
  userId: string
  username: string
  displayName: string
  name: string
  publicId: string
  displayPublicId: string
  avatarUrl: string | null
  country: string | null
}

export type AdminPayrollPaymentMethod = {
  methodType: 'EPAY' | 'BANK' | string
  epayEmail?: string | null
  firstName?: string | null
  lastName?: string | null
  holderName?: string | null
  bankName?: string | null
  branch?: string | null
  accountNumber?: string | null
  ifscCode?: string | null
  phone?: string | null
  upiId?: string | null
  email?: string | null
}

export type AdminPayrollAssignmentWithdrawal = {
  withdrawalId: string
  status: string
  requestedAt: string
  processedAt: string | null
  disputeTicketId: string | null
  assignmentCount: number
  grossPoints: string
  platformFeePoints: string
  hostPayoutPoints: string
  hostPayoutUsd: string | null
  localCurrencyAmount: string
  localCurrencyCode: 'INR' | string
  agentRewardPoints: string
  notes: string | null
}

export type AdminPayrollAssignment = {
  assignmentId: string
  status: PayrollAssignmentStatus
  assignmentNumber: number
  assignedAt: string
  expiresAt: string
  waitingExpiresAt: string | null
  completedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  proofS3Key: string | null
  proofImageUrl: string | null
  agent: AdminPayrollUserCard
  host: AdminPayrollUserCard
  withdrawal: AdminPayrollAssignmentWithdrawal
  paymentMethod: AdminPayrollPaymentMethod | null
}

export type AdminPayrollAssignmentsPage = {
  items: AdminPayrollAssignment[]
  nextCursor: string | null
  hasMore: boolean
}

export type AdminPayrollAssignmentsQuery = {
  limit?: number
  cursor?: string
  status?: string
  agencyUserId?: string
  hostUserId?: string
  withdrawalId?: string
  from?: string
  to?: string
}

export type AdminDisputedPayrollItem = {
  withdrawalId: string
  hostUserId: string
  hostDisplayName: string
  hostPublicId: string
  grossPoints: string
  hostPayoutUsd: string | null
  localCurrencyAmount: string
  localCurrencyCode: 'INR' | string
  disputeTicketId: string | null
  requestedAt: string
  assignment: {
    id: string
    agentUserId: string
    agentDisplayName: string
    agentPublicId: string
    proofS3Key: string | null
    waitingExpiresAt: string | null
  }
  paymentMethod: AdminPayrollPaymentMethod | null
}

export type AdminDisputedPayrollsPage = {
  items: AdminDisputedPayrollItem[]
  nextCursor: string | null
  hasMore: boolean
}

export type AdminPendingPlatformWithdrawal = {
  id: string
  grossPoints: string
  status: string
  requestedAt: string
  processedAt: string | null
  hostPayoutUsd: string | null
  platformFeePoints: string | null
  agentRewardPoints: string | null
  assignmentCount: number
  disputeTicketId: string | null
  paymentMethodId: string | null
  failReason: string | null
}

export type AdminPendingPlatformPage = {
  items: AdminPendingPlatformWithdrawal[]
  nextCursor?: string | null
  hasMore: boolean
}

export type CursorPageQuery = {
  limit?: number
  cursor?: string
}
