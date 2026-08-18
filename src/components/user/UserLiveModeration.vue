<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { format } from 'date-fns'
import axios from 'axios'
import { userAdminApi } from '@/api/userAdmin'
import type { UserLiveModerationDossier } from '@/types/api'
import { showToast } from '@/utils/toast'
import { useLiveModerationActions } from '@/composables/useLiveModerationActions'

const props = defineProps<{ userId: string }>()
const actions = useLiveModerationActions()

const dossier = ref<UserLiveModerationDossier | null>(null)
const loading = ref(false)
const clearing = ref(false)

async function load() {
  loading.value = true
  try {
    const { data } = await userAdminApi.getUserLiveModeration(props.userId, { limit: 20 })
    dossier.value = data
  } catch {
    dossier.value = null
  } finally {
    loading.value = false
  }
}

async function clearHostBan() {
  clearing.value = true
  try {
    await userAdminApi.clearHostStreamSuspension(props.userId)
    showToast('Host streaming suspension cleared', 'success')
    await load()
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data as { message?: string } | undefined
      showToast(body?.message || 'Failed to clear host suspension', 'error')
    } else {
      showToast('Failed to clear host suspension', 'error')
    }
  } finally {
    clearing.value = false
  }
}

onMounted(load)
watch(() => props.userId, load)

defineExpose({ load, dossier })
</script>

<template>
  <div class="space-y-4">
    <div class="admin-card space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-admin-subtext">
          Live & nudity reports
        </h2>
        <button type="button" class="admin-btn-secondary py-1 text-xs" :disabled="loading" @click="load">
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>

      <div
        v-if="dossier?.hostStreamSuspendedUntil"
        class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-admin-danger/40 bg-admin-danger/5 px-3 py-2"
      >
        <p class="text-sm text-admin-danger">
          Host streaming suspended until
          {{ format(new Date(dossier.hostStreamSuspendedUntil), 'dd MMM yyyy HH:mm') }}
          (auto nudity ban)
        </p>
        <button
          type="button"
          class="admin-btn-secondary py-1 text-xs"
          :disabled="clearing"
          @click="clearHostBan"
        >
          {{ clearing ? 'Clearing…' : 'Lift host suspension' }}
        </button>
      </div>

      <div v-if="dossier" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="rounded-md bg-admin-bg/60 p-2">
          <p class="text-[11px] text-admin-muted">Nudity (live + reports)</p>
          <p class="tabular-nums text-lg font-semibold text-admin-danger">{{ dossier.summary.nudity }}</p>
        </div>
        <div class="rounded-md bg-admin-bg/60 p-2">
          <p class="text-[11px] text-admin-muted">Video-call nudity</p>
          <p class="tabular-nums text-lg font-semibold">{{ dossier.summary.videoCallNudity }}</p>
        </div>
        <div class="rounded-md bg-admin-bg/60 p-2">
          <p class="text-[11px] text-admin-muted">Fake streaming</p>
          <p class="tabular-nums text-lg font-semibold text-purple-400">{{ dossier.summary.fakeStreaming }}</p>
        </div>
        <div class="rounded-md bg-admin-bg/60 p-2">
          <p class="text-[11px] text-admin-muted">Host bans</p>
          <p class="tabular-nums text-lg font-semibold">{{ dossier.summary.hostBans }}</p>
        </div>
      </div>
      <p v-else-if="!loading" class="text-xs text-admin-muted">Could not load live moderation.</p>
    </div>

    <div v-if="dossier?.liveNudityLogs.length" class="admin-card space-y-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-admin-subtext">
        Auto nudity detections (live)
      </h3>
      <ul class="space-y-2">
        <li
          v-for="log in dossier.liveNudityLogs"
          :key="log.id"
          class="rounded-md border border-admin-border p-2"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm">
                {{ log.detectedLabel }}
                <span class="text-xs text-admin-muted">({{ Math.round(log.confidence) }}%)</span>
              </p>
              <p class="text-xs text-admin-muted">
                {{ log.action }} · {{ format(new Date(log.checkedAt), 'dd MMM yyyy HH:mm') }}
                <span v-if="log.title"> · {{ log.title }}</span>
              </p>
            </div>
            <a
              v-if="log.evidenceUrl"
              :href="log.evidenceUrl"
              target="_blank"
              rel="noopener"
              class="text-xs text-admin-accent hover:underline"
            >
              Evidence
            </a>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="dossier?.videoCallLogs.length" class="admin-card space-y-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-admin-subtext">
        Video-call nudity
      </h3>
      <ul class="space-y-2">
        <li
          v-for="log in dossier.videoCallLogs"
          :key="log.id"
          class="rounded-md border border-admin-border p-2"
        >
          <p class="text-sm">
            {{ log.detectedLabel }}
            <span class="text-xs text-admin-muted">({{ Math.round(log.confidence) }}%)</span>
            · {{ log.action }}
          </p>
          <p class="text-xs text-admin-muted">
            {{ format(new Date(log.checkedAt), 'dd MMM yyyy HH:mm') }}
            · caller
            <RouterLink
              v-if="log.caller?.id"
              class="text-admin-accent hover:underline"
              :to="`/admin/users/${log.caller.id}`"
            >
              {{ log.caller.name || log.caller.username }}
            </RouterLink>
            · creator
            <RouterLink
              v-if="log.creator?.id"
              class="text-admin-accent hover:underline"
              :to="`/admin/users/${log.creator.id}`"
            >
              {{ log.creator.name || log.creator.username }}
            </RouterLink>
          </p>
          <a
            v-if="log.evidenceUrl"
            :href="log.evidenceUrl"
            target="_blank"
            rel="noopener"
            class="text-xs text-admin-accent hover:underline"
          >
            Evidence
          </a>
        </li>
      </ul>
    </div>

    <div v-if="dossier?.hostBans.length" class="admin-card space-y-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-admin-subtext">Host stream bans</h3>
      <ul class="space-y-2">
        <li
          v-for="ban in dossier.hostBans"
          :key="ban.id"
          class="flex justify-between gap-2 rounded-md border border-admin-border px-3 py-2 text-sm"
        >
          <span>Ban #{{ ban.banNumber }} · {{ ban.banDurationHours }}h</span>
          <span class="text-xs text-admin-muted">
            until {{ format(new Date(ban.suspendedUntil), 'dd MMM yyyy HH:mm') }}
            <span v-if="ban.active" class="text-admin-danger"> · active</span>
          </span>
        </li>
      </ul>
    </div>

    <div v-if="dossier?.userReports.length" class="admin-card space-y-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-admin-subtext">
        User reports (this account)
      </h3>
      <ul class="space-y-2">
        <li
          v-for="rep in dossier.userReports"
          :key="rep.id"
          class="rounded-md border border-admin-border p-2 text-sm"
        >
          <p>
            {{ rep.reason }} · {{ rep.context }}
            <span class="text-xs text-admin-muted">· {{ rep.status }}</span>
          </p>
          <p class="text-xs text-admin-muted">
            {{ format(new Date(rep.createdAt), 'dd MMM yyyy HH:mm') }}
            · reporter
            <RouterLink
              v-if="rep.reporter?.id"
              class="text-admin-accent hover:underline"
              :to="`/admin/users/${rep.reporter.id}`"
            >
              {{ rep.reporter.name || rep.reporter.username }}
            </RouterLink>
          </p>
          <p v-if="rep.additionalInfo" class="mt-1 text-xs">{{ rep.additionalInfo }}</p>
          <div class="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              class="admin-btn-secondary py-1 text-xs"
              @click="actions.applyMute({ userId: props.userId, type: 'LIVE_CHAT_MUTE', reportId: rep.id })"
            >
              Mute chat
            </button>
            <button
              type="button"
              class="admin-btn-secondary py-1 text-xs"
              @click="actions.applyMute({ userId: props.userId, type: 'LIVE_AUDIO_MUTE', reportId: rep.id })"
            >
              Mute audio
            </button>
            <button
              v-if="rep.liveSessionId"
              type="button"
              class="admin-btn-secondary py-1 text-xs"
              @click="actions.stopLive(rep.liveSessionId, 'Closed from user report')"
            >
              Close live
            </button>
            <RouterLink
              class="px-2 py-1 text-xs text-admin-accent hover:underline"
              :to="`/admin/support?tab=reports&reportId=${rep.id}`"
            >
              Review
            </RouterLink>
          </div>
          <div v-if="rep.evidenceUrls.length" class="mt-1 flex flex-wrap gap-2">
            <a
              v-for="url in rep.evidenceUrls"
              :key="url"
              :href="url"
              target="_blank"
              rel="noopener"
              class="text-xs text-admin-accent hover:underline"
            >
              Evidence
            </a>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
