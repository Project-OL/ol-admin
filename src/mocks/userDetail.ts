import type {
  CoinTransaction,
  LiveSummary,
  PointTransaction,
  Post,
  ReportSummary,
  UserProfile,
} from '@/types/user'

export const mockUser: UserProfile = {
  id: '24566789',
  name: 'Riya Sharma',
  avatar: 'https://i.pravatar.cc/150?u=24566789',
  vip: true,
  status: 'active',
  wealthLevel: 42,
  streamLevel: 18,
  walletCoins: 125000,
  points: 8450,
  totalEarnings: 2450000,
  totalPoints: 125000,
  totalRechargeCoin: 890000,
  lastActive: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  mobile: '+91 98765 43210',
  email: 'riya.sharma@example.com',
  gender: 'Female',
  country: 'India',
  city: 'Mumbai',
  tags: ['Top Host', 'Verified', 'Premium'],
  registrationDate: '2023-04-15T10:30:00Z',
  lastLogin: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  inAgency: true,
  agencyName: 'Star Agency',
  ipAddress: '103.21.45.89',
  deviceName: 'Samsung Galaxy S24',
  deviceId: 'DEV-88291034',
  coinsFrozen: false,
  pointsFrozen: false,
  pointInDollar: 84.5,
  totalWithdrawUsd: 12500,
  coinsInTrading: 15000,
  faceVerificationStatus: 'verified',
}

export const mockCoinTransactions: CoinTransaction[] = Array.from({ length: 25 }, (_, i) => ({
  id: `CTX-${1000 + i}`,
  date: new Date(Date.now() - i * 86400000).toISOString(),
  description: ['Gift received', 'Recharge', 'Coin transfer', 'Live reward', 'Purchase'][i % 5]!,
  amount: (i % 2 === 0 ? 1 : -1) * (500 + i * 100),
  status: (['success', 'pending', 'failed'] as const)[i % 3]!,
}))

export const mockPointTransactions: PointTransaction[] = Array.from({ length: 25 }, (_, i) => ({
  id: `PTX-${2000 + i}`,
  date: new Date(Date.now() - i * 86400000).toISOString(),
  description: ['Stream bonus', 'Daily login', 'Referral bonus', 'Task reward', 'Withdrawal'][i % 5]!,
  amount: (i % 3 === 0 ? -1 : 1) * (50 + i * 10),
  status: (['success', 'pending', 'failed'] as const)[i % 3]!,
}))

export const mockPosts: Post[] = [
  {
    id: 'POST-001',
    thumbnail: 'https://picsum.photos/seed/post1/120/120',
    caption: 'Beautiful sunset from my live stream today! Thanks everyone for joining 🌅',
    type: 'image',
    date: new Date(Date.now() - 86400000).toISOString(),
    url: 'https://picsum.photos/seed/post1/800/600',
  },
  {
    id: 'POST-002',
    thumbnail: 'https://picsum.photos/seed/post2/120/120',
    caption: 'New dance challenge video — check it out!',
    type: 'video',
    date: new Date(Date.now() - 172800000).toISOString(),
    url: 'https://picsum.photos/seed/post2/800/600',
  },
  {
    id: 'POST-003',
    thumbnail: 'https://picsum.photos/seed/post3/120/120',
    caption: 'Behind the scenes from today\'s photoshoot',
    type: 'image',
    date: new Date(Date.now() - 259200000).toISOString(),
    url: 'https://picsum.photos/seed/post3/800/600',
  },
  {
    id: 'POST-004',
    thumbnail: 'https://picsum.photos/seed/post4/120/120',
    caption: 'Thank you for 1M followers! Special announcement coming soon',
    type: 'video',
    date: new Date(Date.now() - 345600000).toISOString(),
    url: 'https://picsum.photos/seed/post4/800/600',
  },
]

export const mockReportsSummary: ReportSummary = {
  nudity: 3,
  abuse: 7,
  fakeStreaming: 1,
}

export const mockLiveSummary: LiveSummary = {
  liveHours: 28.5,
  receivingCount: 1420,
}

export const mockAvailableTags = [
  'Top Host',
  'Verified',
  'Premium',
  'New User',
  'Influencer',
  'Agency Host',
  'VIP',
  'Featured',
]

export function paginate<T>(items: T[], page: number, limit: number) {
  const start = (page - 1) * limit
  const data = items.slice(start, start + limit)
  return {
    data,
    total: items.length,
    page,
    limit,
    hasMore: start + limit < items.length,
  }
}

export function filterTransactions<T extends { status: string; date: string }>(
  items: T[],
  params: { status?: string; from?: string; to?: string },
): T[] {
  return items.filter((item) => {
    if (params.status && item.status !== params.status) return false
    if (params.from && new Date(item.date) < new Date(params.from)) return false
    if (params.to && new Date(item.date) > new Date(params.to + 'T23:59:59')) return false
    return true
  })
}
