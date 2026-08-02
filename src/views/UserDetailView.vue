<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserDetailStore } from '@/stores/userDetail'
import UserHeader from '@/components/user/UserHeader.vue'
import UserBasicInfo from '@/components/user/UserBasicInfo.vue'
import WalletOverview from '@/components/user/WalletOverview.vue'
import TransactionTabs from '@/components/user/TransactionTabs.vue'
import PostModeration from '@/components/user/PostModeration.vue'
import QuickActions from '@/components/user/QuickActions.vue'
import RemoveRestrict from '@/components/user/RemoveRestrict.vue'
import ModerationControls from '@/components/user/ModerationControls.vue'
import DeviceList from '@/components/user/DeviceList.vue'
import RecentReports from '@/components/user/RecentReports.vue'
import RecentLiveSummary from '@/components/user/RecentLiveSummary.vue'
import UserLevelControls from '@/components/user/UserLevelControls.vue'

const route = useRoute()
const store = useUserDetailStore()
const sidebarOpen = ref(false)

const userId = computed(() => route.params.id as string)
const isDetails = computed(() => store.activeTab === 'details')

const tabs = [
  { id: 'details', label: 'User Details' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'wallet', label: 'Wallet & Points' },
  { id: 'live', label: 'Live & Activity' },
  { id: 'devices', label: 'Devices' },
  { id: 'reports', label: 'Reports' },
]

async function loadUser(id: string) {
  await Promise.all([
    store.fetchUser(id),
    store.fetchPosts(id),
    store.fetchDevices(id),
    store.fetchReportsSummary(id),
    store.fetchLiveSummary(id),
  ])
}

onMounted(() => loadUser(userId.value))
watch(userId, (id) => loadUser(id))

function setTab(tab: string) {
  store.setActiveTab(tab)
  sidebarOpen.value = false
}
</script>

<template>
  <div class="min-h-[calc(100vh-3.5rem)]">
    <div
      v-if="store.loading && !store.user"
      class="flex min-h-[calc(100vh-3.5rem)] items-center justify-center"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent"
      />
    </div>

    <div v-else-if="store.user" class="admin-page !space-y-0">
      <UserHeader :user="store.user" />

      <div class="mt-4 border-b border-admin-border sm:mt-6">
        <nav class="-mb-px flex gap-1 overflow-x-auto pb-px [-webkit-overflow-scrolling:touch]">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            :class="[
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4',
              store.activeTab === tab.id
                ? 'border-admin-accent text-admin-accent'
                : 'border-transparent text-admin-subtext hover:border-admin-border hover:text-admin-text',
            ]"
            @click="setTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <button
        v-if="isDetails"
        type="button"
        class="admin-btn-secondary mt-4 w-full sm:w-auto lg:hidden"
        @click="sidebarOpen = !sidebarOpen"
      >
        {{ sidebarOpen ? 'Hide Panel' : 'Show Actions Panel' }}
      </button>

      <!--
        Top: 3 columns (basic info | wallet/live | actions).
        Below basic-info row: transactions / posts / account status span first two columns.
      -->
      <div v-if="isDetails" class="mt-4 grid grid-cols-1 items-start gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-12">
        <div class="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:col-span-8 lg:grid-cols-8">
          <div class="lg:col-span-3">
            <UserBasicInfo :user="store.user" />
          </div>
          <div class="space-y-4 sm:space-y-6 lg:col-span-5">
            <WalletOverview :user="store.user" />
            <RecentLiveSummary :summary="store.liveSummary" />
          </div>
          <div class="space-y-4 sm:space-y-6 lg:col-span-8">
            <TransactionTabs :user-id="store.user.id" />
            <PostModeration :user-id="store.user.id" :posts="store.posts" />
            <RemoveRestrict :user-id="store.user.id" />
          </div>
        </div>

        <div
          :class="[
            'flex min-w-0 flex-col gap-4 sm:gap-6 lg:col-span-4',
            sidebarOpen ? 'flex' : 'hidden lg:flex',
          ]"
        >
          <RecentReports :user-id="store.user.id" :summary="store.reportsSummary" />
          <UserLevelControls :user="store.user" />
          <QuickActions :user="store.user" />
          <ModerationControls :user="store.user" />
        </div>
      </div>

      <!-- Other tabs: original-style main + side panel -->
      <div v-else class="mt-4 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-12">
        <div
          v-show="store.activeTab === 'devices'"
          class="space-y-4 sm:space-y-6 lg:col-span-3"
        >
          <UserBasicInfo :user="store.user" />
        </div>

        <div
          :class="[
            'space-y-4 sm:space-y-6',
            store.activeTab === 'devices' ? 'lg:col-span-9' : 'lg:col-span-12',
          ]"
        >
          <div v-show="store.activeTab === 'wallet'">
            <WalletOverview :user="store.user" />
          </div>
          <div v-show="store.activeTab === 'live'">
            <RecentLiveSummary :summary="store.liveSummary" />
          </div>
          <div v-show="store.activeTab === 'transactions'">
            <TransactionTabs :user-id="store.user.id" />
          </div>
          <div v-show="store.activeTab === 'devices'">
            <DeviceList :user-id="store.user.id" :devices="store.devices" />
          </div>
          <div v-show="store.activeTab === 'reports'">
            <RecentReports :user-id="store.user.id" :summary="store.reportsSummary" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex min-h-[calc(100vh-3.5rem)] items-center justify-center text-admin-subtext">
      User not found
    </div>
  </div>
</template>
