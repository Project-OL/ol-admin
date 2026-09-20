import api from '@/api/client'
import type { UserRewardsOverview } from '@/types/userRewardsOverview'

export const userRewardsOverviewApi = {
  get(userId: string) {
    return api.get<UserRewardsOverview>(`/admin/users/${userId}/rewards-overview`)
  },
}
