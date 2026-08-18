<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { format } from 'date-fns'
import { userAdminApi } from '@/api/userAdmin'
import { liveRestrictionsApi, isLiveEnforcedRestrictionType } from '@/api/liveRestrictions'
import { useLiveModerationActions } from '@/composables/useLiveModerationActions'
import { REPORT_REASON_OPTIONS } from '@/types/customerSupport'
import type {
  AdminGlobalRestrictionItem,
  AdminLiveStreamRow,
  HostStreamBanItem,
  LiveModerationKind,
  LiveNudityAction,
  LiveNudityLogItem,
  LiveUserReportItem,
  UserRestrictionType,
  VideoCallNudityLogItem,
} from '@/types/api'

type Workbench = LiveModerationKind | 'open_streams' | 'restrictions'

const route = useRoute()
const router = useRouter()
const actions = useLiveModerationActions()

const kind = ref<Workbench>('nudity')
const userId = ref('')
const actionFilter = ref<'' | LiveNudityAction>('')
const reasonFilter = ref('')
const statusFilter = ref('')
const restrictionType = ref<'' | UserRestrictionType>('')
const page = ref(1)
const loading = ref(false)
const actingId = ref<string | null>(null)

const items = ref<Array<LiveNudityLogItem | VideoCallNudityLogItem | HostStreamBanItem | LiveUserReportItem>>(
  [],
)
const streams = ref<AdminLiveStreamRow[]>([])
const restrictions = ref<AdminGlobalRestrictionItem[]>([])
const total = ref(0)

const showActionFilter = computed(() => kind.value === 'nudity' || kind.value === 'video_call')
const showReportFilters = computed(() => kind.value === 'user_report')

function qStr(v: unknown) {
  return typeof v === 'string' ? v : ''
}

function hydrateFromRoute() {
  const q = route.query
  const k = qStr(q.kind)
  if (
    k === 'nudity' ||
    k === 'video_call' ||
    k === 'host_ban' ||
    k === 'user_report' ||
    k === 'open_streams' ||
    k === 'restrictions'
  ) {
    kind.value = k
  }
  userId.value = qStr(q.userId)
  const action = qStr(q.action)
  actionFilter.value = action === 'BLOCK' || action === 'WARNING' ? action : ''
  reasonFilter.value = qStr(q.reason)
  statusFilter.value = qStr(q.status)
  const type = qStr(q.type)
  restrictionType.value = isLiveEnforcedRestrictionType(type) ? type : ''
  const p = Number(q.page)
  page.value = Number.isFinite(p) && p > 0 ? p : 1
}

function syncQuery() {
  const query: Record<string, string> = { kind: kind.value }
  if (userId.value.trim()) query.userId = userId.value.trim()
  if (actionFilter.value) query.action = actionFilter.value
  if (reasonFilter.value) query.reason = reasonFilter.value
  if (statusFilter.value) query.status = statusFilter.value
  if (restrictionType.value) query.type = restrictionType.value
  if (page.value > 1) query.page = String(page.value)
  void router.replace({ path: '/admin/live-moderation', query })
}

async function load(nextPage = 1) {
  loading.value = true
  page.value = nextPage
  syncQuery()
  const uid = userId.value.trim() || undefined
  try {
    if (kind.value === 'open_streams') {
      const { data } = await userAdminApi.listAllActiveLiveStreams({
        hostUserId: uid,
        page: nextPage,
        limit: 20,
      })
      streams.value = data.items ?? []
      total.value = data.pagination?.total ?? streams.value.length
      items.value = []
      restrictions.value = []
    } else if (kind.value === 'restrictions') {
      if (!uid) {
        restrictions.value = []
        total.value = 0
        items.value = []
        streams.value = []
      } else {
        const rows = await liveRestrictionsApi.list(uid)
        const filtered = rows
          .filter((row) => {
            if (row.active === false) return false
            if (restrictionType.value && row.type !== restrictionType.value) return false
            return isLiveEnforcedRestrictionType(row.type)
          })
          .map((row) => ({ ...row, userId: row.userId || uid }))
        restrictions.value = filtered
        total.value = filtered.length
        items.value = []
        streams.value = []
      }
    } else {
      const { data } = await userAdminApi.listLiveModeration({
        kind: kind.value,
        userId: uid,
        action: showActionFilter.value ? actionFilter.value || undefined : undefined,
        reason: showReportFilters.value ? reasonFilter.value || undefined : undefined,
        status: showReportFilters.value ? statusFilter.value || undefined : undefined,
        page: nextPage,
        limit: 20,
      })
      items.value = data.items ?? []
      total.value = data.pagination?.total ?? items.value.length
      streams.value = []
      restrictions.value = []
    }
  } catch {
    items.value = []
    streams.value = []
    restrictions.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  hydrateFromRoute()
  void load(page.value)
})
watch(kind, () => void load(1))

function asNudity(row: (typeof items.value)[number]): LiveNudityLogItem | null {
  return row.kind === 'nudity' ? row : null
}
function asVideo(row: (typeof items.value)[number]): VideoCallNudityLogItem | null {
  return row.kind === 'video_call' ? row : null
}
function asBan(row: (typeof items.value)[number]): HostStreamBanItem | null {
  return row.kind === 'host_ban' ? row : null
}
function asReport(row: (typeof items.value)[number]): LiveUserReportItem | null {
  return row.kind === 'user_report' ? row : null
}

function userLink(user?: { id?: string; name?: string; username?: string | null } | null) {
  if (!user?.id) return null
  return { id: user.id, label: user.name || user.username || user.id.slice(0, 8) }
}

function targetUserId(row: (typeof items.value)[number]) {
  return (
    asNudity(row)?.hostUserId ||
    asBan(row)?.userId ||
    asReport(row)?.reportedUser?.id ||
    asVideo(row)?.creator?.id ||
    asVideo(row)?.caller?.id ||
    null
  )
}

async function mute(userIdValue: string, type: 'LIVE_CHAT_MUTE' | 'LIVE_AUDIO_MUTE' | 'LIVE_STREAM_START_BAN', reportId?: string) {
  actingId.value = `${userIdValue}:${type}`
  await actions.applyMute({
    userId: userIdValue,
    type,
    reportId,
    reason: 'Admin live moderation',
  })
  actingId.value = null
}

async function closeStream(streamRef: string) {
  actingId.value = streamRef
  const ok = await actions.stopLive(streamRef, 'Closed from live moderation')
  actingId.value = null
  if (ok) void load(page.value)
}

async function liftBan(uid: string) {
  actingId.value = uid
  const ok = await actions.liftHostBan(uid)
  actingId.value = null
  if (ok) void load(page.value)
}

async function clearRestriction(uid: string, restrictionId: string) {
  actingId.value = restrictionId
  const ok = await actions.clearLiveRestriction(uid, restrictionId)
  actingId.value = null
  if (ok) void load(page.value)
}

async function resolveReport(id: string, status: 'RESOLVED' | 'DISMISSED') {
  actingId.value = id
  const ok = await actions.reviewReport(id, status)
  actingId.value = null
  if (ok) void load(page.value)
}
</script>

<template>
  <div class="admin-page space-y-4">
    <div>
      <h1 class="text-lg font-semibold">Live moderation</h1>
      <p class="text-sm text-admin-muted">
        Overall and per-user nudity detections, user reports, host bans, and open rooms.
        Chat mute, audio mute, and going-live ban are applied on the live backend
        (live.offoolive.com) — not room kick or stream-admin tools.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <select v-model="kind" class="admin-input w-auto">
        <option value="nudity">Live nudity detections</option>
        <option value="video_call">Video-call nudity</option>
        <option value="host_ban">Host stream bans</option>
        <option value="user_report">User live reports</option>
        <option value="open_streams">Open live streams</option>
        <option value="restrictions">Active mutes / bans</option>
      </select>
      <input
        v-model="userId"
        class="admin-input w-64"
        :placeholder="kind === 'restrictions' ? 'User UUID (required)' : 'Filter user UUID'"
        @keyup.enter="load(1)"
      />
      <select
        v-if="showActionFilter"
        v-model="actionFilter"
        class="admin-input w-auto"
        @change="load(1)"
      >
        <option value="">All actions</option>
        <option value="WARNING">WARNING</option>
        <option value="BLOCK">BLOCK</option>
      </select>
      <select
        v-if="showReportFilters"
        v-model="reasonFilter"
        class="admin-input w-auto"
        @change="load(1)"
      >
        <option value="">All reasons</option>
        <option v-for="r in REPORT_REASON_OPTIONS" :key="r" :value="r">{{ r }}</option>
      </select>
      <select
        v-if="showReportFilters"
        v-model="statusFilter"
        class="admin-input w-auto"
        @change="load(1)"
      >
        <option value="">All status</option>
        <option value="PENDING">PENDING</option>
        <option value="REVIEWED">REVIEWED</option>
        <option value="RESOLVED">RESOLVED</option>
        <option value="DISMISSED">DISMISSED</option>
      </select>
      <select
        v-if="kind === 'restrictions'"
        v-model="restrictionType"
        class="admin-input w-auto"
        @change="load(1)"
      >
        <option value="">All types</option>
        <option value="LIVE_CHAT_MUTE">Chat mute</option>
        <option value="LIVE_AUDIO_MUTE">Audio mute</option>
        <option value="LIVE_STREAM_START_BAN">Live-start ban</option>
      </select>
      <button type="button" class="admin-btn-primary" :disabled="loading" @click="load(1)">
        {{ loading ? 'Loading…' : 'Apply' }}
      </button>
    </div>

    <div v-if="kind === 'open_streams'" class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Host</th>
            <th>Room</th>
            <th>Started</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in streams" :key="row.id">
            <td>
              <RouterLink
                v-if="row.hostUserId"
                class="text-admin-accent hover:underline"
                :to="`/admin/users/${row.hostUserId}`"
              >
                {{ row.host?.name || row.host?.username || row.hostUserId.slice(0, 8) }}
              </RouterLink>
              <span v-else>—</span>
            </td>
            <td class="text-sm">
              <p>{{ row.title || row.roomId }}</p>
              <p class="text-xs text-admin-muted">{{ row.source }} · {{ row.status }}</p>
            </td>
            <td class="whitespace-nowrap text-xs">
              {{ row.startedAt ? format(new Date(row.startedAt), 'dd MMM yyyy HH:mm') : '—' }}
            </td>
            <td class="space-x-2 whitespace-nowrap text-xs">
              <button
                type="button"
                class="admin-btn-secondary py-1 text-xs"
                :disabled="actingId === row.id"
                @click="closeStream(row.id)"
              >
                Close stream
              </button>
              <button
                v-if="row.hostUserId"
                type="button"
                class="admin-btn-secondary py-1 text-xs"
                :disabled="actingId === `${row.hostUserId}:LIVE_CHAT_MUTE`"
                @click="mute(row.hostUserId, 'LIVE_CHAT_MUTE')"
              >
                Mute chat
              </button>
              <button
                v-if="row.hostUserId"
                type="button"
                class="admin-btn-secondary py-1 text-xs"
                :disabled="actingId === `${row.hostUserId}:LIVE_AUDIO_MUTE`"
                @click="mute(row.hostUserId, 'LIVE_AUDIO_MUTE')"
              >
                Mute audio
              </button>
            </td>
          </tr>
          <tr v-if="!streams.length && !loading">
            <td colspan="4" class="py-10 text-center text-admin-muted">No open live streams</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="kind === 'restrictions'" class="admin-table-wrap">
      <p v-if="!userId.trim()" class="px-4 py-6 text-sm text-admin-muted">
        Enter a user UUID to load chat mute, audio mute, and going-live bans from the live backend.
      </p>
      <table v-else class="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Type</th>
            <th>Until</th>
            <th>Reason</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in restrictions" :key="row.id">
            <td>
              <RouterLink
                v-if="row.userId"
                class="text-admin-accent hover:underline"
                :to="`/admin/users/${row.userId}`"
              >
                {{ row.user?.name || row.user?.username || row.userId.slice(0, 8) }}
              </RouterLink>
              <span v-else class="text-xs text-admin-muted">—</span>
            </td>
            <td class="text-xs">{{ row.type }}</td>
            <td class="whitespace-nowrap text-xs">
              {{ format(new Date(row.restrictedUntil), 'dd MMM yyyy HH:mm') }}
            </td>
            <td class="text-xs">{{ row.reason || '—' }}</td>
            <td>
              <button
                v-if="row.userId"
                type="button"
                class="admin-btn-secondary text-xs"
                :disabled="actingId === row.id"
                @click="clearRestriction(row.userId, row.id)"
              >
                {{ actingId === row.id ? 'Clearing…' : 'Clear' }}
              </button>
            </td>
          </tr>
          <tr v-if="!restrictions.length && !loading">
            <td colspan="5" class="py-10 text-center text-admin-muted">No active live restrictions</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Detail</th>
            <th>People</th>
            <th>Evidence</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="whitespace-nowrap text-xs">
              {{
                format(
                  new Date(
                    asNudity(row)?.checkedAt ||
                      asVideo(row)?.checkedAt ||
                      asBan(row)?.createdAt ||
                      asReport(row)?.createdAt ||
                      '',
                  ),
                  'dd MMM yyyy HH:mm',
                )
              }}
            </td>
            <td class="text-sm">
              <template v-if="asNudity(row)">
                {{ asNudity(row)!.detectedLabel }} · {{ asNudity(row)!.action }}
                ({{ Math.round(asNudity(row)!.confidence) }}%)
                <p v-if="asNudity(row)!.title" class="text-xs text-admin-muted">
                  {{ asNudity(row)!.title }}
                </p>
              </template>
              <template v-else-if="asVideo(row)">
                {{ asVideo(row)!.detectedLabel }} · {{ asVideo(row)!.action }}
                ({{ Math.round(asVideo(row)!.confidence) }}%)
              </template>
              <template v-else-if="asBan(row)">
                Ban #{{ asBan(row)!.banNumber }} · {{ asBan(row)!.banDurationHours }}h
                <span v-if="asBan(row)!.active" class="text-admin-danger"> · active</span>
              </template>
              <template v-else-if="asReport(row)">
                {{ asReport(row)!.reason }} · {{ asReport(row)!.context }} ·
                {{ asReport(row)!.status }}
              </template>
            </td>
            <td class="text-sm">
              <template v-if="asNudity(row) && userLink(asNudity(row)!.host)">
                <RouterLink class="text-admin-accent hover:underline" :to="`/admin/users/${userLink(asNudity(row)!.host)!.id}`">
                  {{ userLink(asNudity(row)!.host)!.label }}
                </RouterLink>
              </template>
              <template v-else-if="asVideo(row)">
                <RouterLink
                  v-if="userLink(asVideo(row)!.caller)"
                  class="text-admin-accent hover:underline"
                  :to="`/admin/users/${userLink(asVideo(row)!.caller)!.id}`"
                >
                  {{ userLink(asVideo(row)!.caller)!.label }}
                </RouterLink>
                /
                <RouterLink
                  v-if="userLink(asVideo(row)!.creator)"
                  class="text-admin-accent hover:underline"
                  :to="`/admin/users/${userLink(asVideo(row)!.creator)!.id}`"
                >
                  {{ userLink(asVideo(row)!.creator)!.label }}
                </RouterLink>
              </template>
              <template v-else-if="asBan(row) && userLink(asBan(row)!.user)">
                <RouterLink class="text-admin-accent hover:underline" :to="`/admin/users/${userLink(asBan(row)!.user)!.id}`">
                  {{ userLink(asBan(row)!.user)!.label }}
                </RouterLink>
              </template>
              <template v-else-if="asReport(row) && userLink(asReport(row)!.reportedUser)">
                <RouterLink
                  class="text-admin-accent hover:underline"
                  :to="`/admin/users/${userLink(asReport(row)!.reportedUser)!.id}`"
                >
                  {{ userLink(asReport(row)!.reportedUser)!.label }}
                </RouterLink>
              </template>
            </td>
            <td>
              <a
                v-if="asNudity(row)?.evidenceUrl"
                :href="asNudity(row)!.evidenceUrl!"
                target="_blank"
                rel="noopener"
                class="text-xs text-admin-accent hover:underline"
              >
                Open
              </a>
              <a
                v-else-if="asVideo(row)?.evidenceUrl"
                :href="asVideo(row)!.evidenceUrl!"
                target="_blank"
                rel="noopener"
                class="text-xs text-admin-accent hover:underline"
              >
                Open
              </a>
              <a
                v-else-if="asReport(row)?.evidenceUrls?.[0]"
                :href="asReport(row)!.evidenceUrls[0]"
                target="_blank"
                rel="noopener"
                class="text-xs text-admin-accent hover:underline"
              >
                Open
              </a>
              <span v-else class="text-xs text-admin-muted">—</span>
            </td>
            <td class="space-x-1 whitespace-nowrap text-xs">
              <template v-if="targetUserId(row)">
                <button
                  type="button"
                  class="admin-btn-secondary py-1 text-xs"
                  @click="mute(targetUserId(row)!, 'LIVE_CHAT_MUTE', asReport(row)?.id)"
                >
                  Mute chat
                </button>
                <button
                  type="button"
                  class="admin-btn-secondary py-1 text-xs"
                  @click="mute(targetUserId(row)!, 'LIVE_AUDIO_MUTE', asReport(row)?.id)"
                >
                  Mute audio
                </button>
              </template>
              <button
                v-if="asNudity(row)?.isLive && asNudity(row)?.roomId"
                type="button"
                class="admin-btn-secondary py-1 text-xs"
                @click="closeStream(asNudity(row)!.roomId!)"
              >
                Close live
              </button>
              <button
                v-if="asBan(row)?.active && asBan(row)?.userId"
                type="button"
                class="admin-btn-secondary py-1 text-xs"
                @click="liftBan(asBan(row)!.userId)"
              >
                Lift ban
              </button>
              <template v-if="asReport(row) && asReport(row)!.status === 'PENDING'">
                <button type="button" class="admin-btn-secondary py-1 text-xs" @click="resolveReport(asReport(row)!.id, 'RESOLVED')">
                  Resolve
                </button>
                <button type="button" class="admin-btn-secondary py-1 text-xs" @click="resolveReport(asReport(row)!.id, 'DISMISSED')">
                  Dismiss
                </button>
              </template>
              <RouterLink
                v-if="asReport(row)"
                class="text-admin-accent hover:underline"
                :to="`/admin/support?tab=reports&reportId=${asReport(row)!.id}`"
              >
                Review
              </RouterLink>
            </td>
          </tr>
          <tr v-if="!items.length && !loading">
            <td colspan="5" class="py-10 text-center text-admin-muted">No records</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > 20" class="flex justify-end gap-2">
      <button
        type="button"
        class="admin-btn-secondary text-xs"
        :disabled="page <= 1 || loading"
        @click="load(page - 1)"
      >
        Previous
      </button>
      <button
        type="button"
        class="admin-btn-secondary text-xs"
        :disabled="page * 20 >= total || loading"
        @click="load(page + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>
