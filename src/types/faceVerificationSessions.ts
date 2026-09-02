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
