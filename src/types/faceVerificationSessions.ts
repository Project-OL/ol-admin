/** face_registration_sessions statuses that still "need attention" -- hung
 * (non-terminal) or a terminal failure not yet retried past. */
export type RegistrationSessionStatus =
  | 'PENDING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'LIVENESS_PASSED'
  | 'INDEX_PENDING'
  | 'LIVENESS_FAILED'
  | 'VALIDATION_FAILED'
  | 'REJECTED'

export type RegistrationSessionRow = {
  sessionId: string
  status: RegistrationSessionStatus
  awsSessionId: string | null
  riskScore: number
  failureReason?: string | null
  /** Rekognition reference image captured on the failed attempt, when one was saved. */
  failureImageUrl?: string | null
  createdAt: string
  updatedAt: string
  stuckForSec: number
}

/** Row shape for the global cross-user worklist (adds who it belongs to). */
export type StuckRegistrationSessionRow = RegistrationSessionRow & {
  userId: string
  publicId: string | null
  name: string
}

export type StuckRegistrationSessionsQuery = {
  minAgeSec?: number
  page?: number
  limit?: number
  userId?: string
}

export type StuckRegistrationSessionsResponse = {
  minAgeSec: number
  page: number
  limit: number
  total: number
  sessions: StuckRegistrationSessionRow[]
}

export type UserRegistrationSessionsResponse = {
  sessions: RegistrationSessionRow[]
}

export type RecheckRegistrationSessionResponse = {
  success: true
  sessionId: string
  message: string
}

export type ClearRegistrationSessionsResponse = {
  success: true
  clearedSessionIds: string[]
  message: string
}

export type ClearAllStuckSessionsQuery = {
  minAgeSec?: number
  userId?: string
  reason?: string
}

export type ClearAllStuckSessionsResponse = {
  success: true
  usersCleared: number
  sessionsCleared: number
  message: string
}

export type DuplicateCaseUser = {
  userId: string
  userName: string
  displayPublicId: string | null
  imageUrl: string | null
}

export type PendingDuplicatePair = {
  blockedUser: DuplicateCaseUser & { flaggedAt: string }
  ownerUser: (DuplicateCaseUser & { status: string }) | null
  faceMatchSimilarity: number | null
  /** True when an admin parked this case at the bottom of the worklist. */
  deprioritized?: boolean
}

export type PendingDuplicatesQuery = {
  page?: number
  limit?: number
  /** User id, public id, username or partial name; matches either side of the pair. */
  search?: string
}

export type DuplicateOrderResponse = {
  success: true
  userId: string
  deprioritized: boolean
}

export type PendingDuplicatesResponse = {
  page: number
  limit: number
  total: number
  pairs: PendingDuplicatePair[]
}

export type AcceptDuplicateBothResponse = {
  success: true
  userId: string
  ownerUserId: string | null
  rekognitionFaceId: string
  message: string
}
