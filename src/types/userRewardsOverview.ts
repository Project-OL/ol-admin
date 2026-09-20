import type { RewardClaim, AdminDeduction } from './rewards'

export type NormalHostSlot = {
  claimType: number
  hourSlot: number
  requiredMinutes: number
  completedMinutes: number
  unlocked: boolean
  claimed: boolean
  pointsAmount: string
}

export type NormalHostNextTier = {
  thresholdPoints: string
  windowDays: number
  earningsSoFar: string
  earningsRemaining: string
  progressPercent: number
}

export type NormalHostUpcomingTier = {
  thresholdPoints: string
  hourlyRatePoints: string
  hourCapHours: number
  windowDays: number
  earnedPoints: string
  remainingPoints: string
  progressPercent: number
}

export type NormalHostTierListItem = {
  thresholdPoints: string
  hourlyRatePoints: string
  hourCapHours: number
  windowDays: number
}

export type NormalHostRewardStatus =
  | { eligible: false }
  | {
      eligible: true
      rewardDate: string
      streamedSecondsToday: number
      hasTier: false
      nextTier: NormalHostNextTier
      tiers: NormalHostTierListItem[]
    }
  | {
      eligible: true
      rewardDate: string
      streamedSecondsToday: number
      hasTier: true
      currentTier: {
        thresholdPoints: string
        hourlyRatePoints: string
        hourCapHours: number
        windowDays: number
      }
      nextTier: NormalHostUpcomingTier | null
      slots: NormalHostSlot[]
      totalClaimedToday: string
      tiers: NormalHostTierListItem[]
    }

export type RoyalHostTimingClaimType = 'TIMING_STEP_1' | 'TIMING_STEP_2'

export type RoyalHostCurrentTiming = {
  claimType: RoyalHostTimingClaimType | null
  points: string
  requiredMinutes: number
  completedMinutes: number
  earningThreshold: string | null
  earnedPoints: string | null
  remainingPoints: string | null
  progressPercent: number
  unlocked: boolean
  claimed: boolean
}

export type RoyalHostNextTiming = {
  claimType: RoyalHostTimingClaimType
  points: string
  earningThreshold: string | null
}

export type RoyalHostCurrentGifting = {
  claimType: string
  threshold: string
  points: string
  earnedPoints: string
  remainingPoints: string
  progressPercent: number
  unlocked: boolean
  claimed: boolean
}

export type RoyalHostNextGifting = {
  claimType: string
  threshold: string
  points: string
}

export type RoyalHostTierReward = {
  threshold: string
  totalReward: string
}

export type RoyalHostRewardStatus =
  | { eligible: false }
  | {
      eligible: true
      weekStart: string
      weekEndsInSeconds: number
      dailyHoursCapMinutes: number
      weeklyEarningsPoints: string
      timingReward: {
        totalClaimed: string
        earningThreshold: string
        earnedPoints: string
        progressPercent: number
        requiredMinutes: number
        completedMinutes: number
        current: RoyalHostCurrentTiming
        next: RoyalHostNextTiming | null
      }
      giftingReward: {
        totalClaimed: string
        current: RoyalHostCurrentGifting | null
        next: RoyalHostNextGifting | null
      }
      tiers: RoyalHostTierReward[]
      totalRewardPointsThisWeek: string
    }

export type LivestreamRewardPart = {
  part: number
  thresholdMinutes: number
  points: string
  unlocked: boolean
  claimed: boolean
}

export type LivestreamRewardDay = {
  dayIndex: number
  date: string
  parts: LivestreamRewardPart[]
}

export type LivestreamRewardStatus = {
  eligible: boolean
  dayIndex: number
  streamedMinutesToday: number
  parts: LivestreamRewardPart[]
  previousRewards: LivestreamRewardDay[]
}

export type LiveTimingSession = {
  streamId: string
  startedAt: string | null
  endedAt: string | null
  isLive: boolean
  effectiveDurationSeconds: number
}

export type LiveTimingWindow = {
  totalEffectiveSeconds: number
  sessionCount: number
  sessions: LiveTimingSession[]
}

export type UserRewardsOverview = {
  user: {
    userId: string
    username: string
    publicId: string
    country: string | null
    avatarUrl: string | null
    isRoyalHost: boolean
  }
  generatedAt: string
  normalHostReward: NormalHostRewardStatus
  royalHostReward: RoyalHostRewardStatus
  livestreamReward: LivestreamRewardStatus
  liveTiming: {
    today: LiveTimingWindow & { date: string }
    thisWeek: LiveTimingWindow & { weekStart: string; weekEnd: string }
  }
  claimHistory: {
    claims: RewardClaim[]
    deductions: AdminDeduction[]
  }
}
