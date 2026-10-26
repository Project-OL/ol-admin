<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { trafficApi } from '@/api/traffic'
import type { TrafficDay, TrafficNow, TrafficRange, TrafficSectionRow } from '@/types/traffic'
import { formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'

/**
 * TRF-06: traffic patterns over 24 hours (online users per minute, peak / low / quiet window),
 * sections used most to least, live and calls now, and a 7/30-day hour-of-day heatmap.
 * Everything is IST. Data: ol-node-rest `/admin/traffic/*` (SUPER_ADMIN).
 */
const IST = 'Asia/Kolkata'
const DAY_MS = 86_400_000

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date())
}
function istTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}
function n(v: number | null | undefined): string {
  return v == null ? '—' : formatNumber(v)
}

const date = ref(istToday())
const rangeDays = ref<7 | 30>(7)
const sectionSort = ref<'users' | 'requests'>('users')
const now = ref<TrafficNow | null>(null)
const day = ref<TrafficDay | null>(null)
const range = ref<TrafficRange | null>(null)
const loadingDay = ref(false)
const loadingRange = ref(false)
let nowTimer: ReturnType<typeof setInterval> | null = null

async function loadNow() {
  try {
    now.value = (await trafficApi.getNow()).data
  } catch {
    now.value = null
  }
}
async function loadDay() {
  loadingDay.value = true
  try {
    day.value = (await trafficApi.getDay(date.value)).data
  } catch {
    day.value = null
    showToast('Failed to load traffic for the day', 'error')
  } finally {
    loadingDay.value = false
  }
}
async function loadRange() {
  loadingRange.value = true
  try {
    range.value = (await trafficApi.getRange(rangeDays.value)).data
  } catch {
    range.value = null
    showToast('Failed to load the traffic range', 'error')
  } finally {
    loadingRange.value = false
  }
}
function refreshAll() {
  loadNow()
  loadDay()
  loadRange()
}

const isToday = computed(() => date.value === istToday())
const dayStart = computed(() => Date.parse(`${date.value}T00:00:00+05:30`))

/* ---- 24-hour line chart ---- */
const W = 960
const H = 220
const padL = 40
const padR = 12
const padT = 12
const padB = 26
const plotW = W - padL - padR
const plotH = H - padT - padB

const yMax = computed(() => {
  const d = day.value
  const peak = Math.max(
    4,
    ...(d?.minutes.map((m) => m.online) ?? []),
    ...(d?.previousDay.map((m) => m.online) ?? []),
  )
  const step = peak <= 10 ? 2 : peak <= 50 ? 10 : peak <= 200 ? 50 : 100
  return Math.ceil(peak / step) * step
})
const yTicks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax.value * f)))
const xOf = (ms: number) => padL + ((ms - dayStart.value) / DAY_MS) * plotW
const yOf = (v: number) => padT + plotH - (v / yMax.value) * plotH

/** Polyline segments, broken where a minute is missing (a gap is not zero). */
function segments(points: { t: string; online: number }[], shiftMs = 0): string[] {
  const out: string[] = []
  let cur: string[] = []
  let prev = 0
  for (const p of points) {
    const t = Date.parse(p.t) + shiftMs
    if (cur.length && t - prev > 60_000) {
      out.push(cur.join(' '))
      cur = []
    }
    cur.push(`${xOf(t).toFixed(1)},${yOf(p.online).toFixed(1)}`)
    prev = t
  }
  if (cur.length) out.push(cur.join(' '))
  return out
}
const todayLines = computed(() => segments(day.value?.minutes ?? []))
const prevLines = computed(() => segments(day.value?.previousDay ?? [], DAY_MS))
const peakPoint = computed(() => {
  const p = day.value?.summary.peak
  return p ? { x: xOf(Date.parse(p.at)), y: yOf(p.online), label: `${p.online} at ${istTime(p.at)}` } : null
})
const quietBand = computed(() => {
  const q = day.value?.summary.quietWindow
  if (!q) return null
  const x1 = xOf(Date.parse(q.from))
  return { x: x1, w: Math.max(2, xOf(Date.parse(q.to) + 60_000) - x1) }
})

const hover = ref<{ x: number; label: string } | null>(null)
function onMove(e: MouseEvent) {
  const d = day.value
  const svg = e.currentTarget as SVGSVGElement
  const box = svg.getBoundingClientRect()
  const x = ((e.clientX - box.left) / box.width) * W
  if (!d || x < padL || x > W - padR) {
    hover.value = null
    return
  }
  const t = dayStart.value + ((x - padL) / plotW) * DAY_MS
  const nearest = (pts: { t: string; online: number }[], shift = 0) => {
    let best: { t: string; online: number } | null = null
    let bestD = Infinity
    for (const p of pts) {
      const dd = Math.abs(Date.parse(p.t) + shift - t)
      if (dd < bestD) {
        bestD = dd
        best = p
      }
    }
    return bestD <= 5 * 60_000 ? best : null
  }
  const cur = nearest(d.minutes)
  const prev = nearest(d.previousDay, DAY_MS)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit' }).format(
    new Date(t),
  )
  hover.value = {
    x,
    label: `${time} · ${cur ? cur.online : '—'} online${prev ? ` (day before ${prev.online})` : ''}`,
  }
}

/* ---- hours and sections ---- */
const hourBars = computed(() => {
  const rows = day.value?.hours ?? []
  const max = Math.max(1, ...rows.map((h) => h.users))
  return Array.from({ length: 24 }, (_, h) => {
    const r = rows.find((x) => Number(x.hour) === h)
    return { hour: h, users: r?.users ?? 0, requests: r?.requests ?? 0, pct: ((r?.users ?? 0) / max) * 100 }
  })
})
function sortSections(rows: TrafficSectionRow[]) {
  const key = sectionSort.value
  return [...rows].sort((a, b) => b[key] - a[key] || b.users - a.users)
}
const daySections = computed(() => sortSections(day.value?.sections ?? []))
const rangeSections = computed(() => sortSections(range.value?.sections ?? []))
const sectionMax = (rows: TrafficSectionRow[]) => Math.max(1, ...rows.map((r) => r[sectionSort.value]))

/* ---- heatmap ---- */
const heatRows = computed(() => {
  const r = range.value
  if (!r) return []
  const max = Math.max(1, ...r.heatmap.map((c) => c.users))
  return r.perDay.map((d) => ({
    date: d.date,
    cells: Array.from({ length: 24 }, (_, h) => {
      const c = r.heatmap.find((x) => x.date === d.date && x.hour === h)
      return { hour: h, users: c?.users ?? null, opacity: c ? 0.12 + 0.88 * (c.users / max) : 0 }
    }),
  }))
})
function shortDate(d: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${d}T00:00:00Z`),
  )
}

onMounted(() => {
  refreshAll()
  nowTimer = setInterval(() => {
    loadNow()
    if (isToday.value) loadDay()
  }, 60_000)
})
onBeforeUnmount(() => {
  if (nowTimer) clearInterval(nowTimer)
})
</script>

<template>
  <div class="admin-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold sm:text-2xl">Traffic</h1>
        <p class="mt-1 text-sm text-admin-subtext">
          Online users through the day, the busiest and quietest times, and which app sections people use.
          All times IST. Online = app open with the chat connection alive in the last minute.
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <label class="flex flex-col gap-1 text-xs text-admin-subtext">
          Day (IST)
          <input v-model="date" type="date" class="admin-input w-auto" :max="istToday()" @change="loadDay()" />
        </label>
        <button type="button" class="admin-btn-secondary" :disabled="loadingDay || loadingRange" @click="refreshAll">
          {{ loadingDay || loadingRange ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- KPI cards -->
    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="admin-card">
        <p class="text-xs text-admin-subtext">Online now</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">{{ n(now?.onlineUsers) }}</p>
        <p class="mt-1 text-xs text-admin-muted">
          last sample {{ istTime(now?.lastSampleAt) }} · this hour {{ n(now?.thisHour.users) }} users
        </p>
      </div>
      <div class="admin-card border border-admin-accent/50">
        <p class="text-xs text-admin-subtext">Peak {{ isToday ? 'today' : 'that day' }}</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-admin-accent">
          {{ day?.summary.peak ? `${day.summary.peak.online} at ${istTime(day.summary.peak.at)}` : '—' }}
        </p>
        <p class="mt-1 text-xs text-admin-muted">median {{ n(day?.summary.median) }} online</p>
      </div>
      <div class="admin-card">
        <p class="text-xs text-admin-subtext">Low</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ day?.summary.low ? `${day.summary.low.online} at ${istTime(day.summary.low.at)}` : '—' }}
        </p>
        <p class="mt-1 text-xs text-admin-muted">
          <template v-if="day?.summary.quietWindow">
            quiet {{ istTime(day.summary.quietWindow.from) }}–{{ istTime(day.summary.quietWindow.to) }}
            (≤ {{ day.summary.quietWindow.threshold }} online)
          </template>
          <template v-else>no quiet window yet</template>
        </p>
      </div>
      <div class="admin-card">
        <p class="text-xs text-admin-subtext">Active users {{ isToday ? 'today' : 'that day' }}</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">{{ n(day?.summary.activeUsers) }}</p>
        <p class="mt-1 text-xs text-admin-muted">
          {{ n(day?.summary.requests) }} requests · {{ n(day?.summary.errors5xx) }} server errors
        </p>
      </div>
    </section>

    <!-- 24h line -->
    <section class="admin-card">
      <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-lg font-medium">Online users through the day</h2>
        <p class="text-xs text-admin-muted">
          <span class="mr-3"><span class="inline-block h-0.5 w-4 bg-admin-accent align-middle"></span> {{ date }}</span>
          <span class="mr-3"><span class="inline-block h-0.5 w-4 bg-admin-muted align-middle"></span> day before</span>
          <span><span class="inline-block h-2 w-4 bg-admin-border align-middle"></span> quiet window</span>
        </p>
      </div>
      <p v-if="day && day.summary.coverageMinutes === 0" class="py-10 text-center text-sm text-admin-muted">
        No samples for this day. Collection started on 26 Oct 2026 at about 16:50 IST.
      </p>
      <div v-else class="relative">
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          class="w-full"
          role="img"
          aria-label="Online users per minute"
          @mousemove="onMove"
          @mouseleave="hover = null"
        >
          <rect v-if="quietBand" :x="quietBand.x" :y="padT" :width="quietBand.w" :height="plotH" class="fill-admin-border" opacity="0.6" />
          <g v-for="t in yTicks" :key="`y${t}`">
            <line :x1="padL" :x2="W - padR" :y1="yOf(t)" :y2="yOf(t)" class="stroke-admin-border" stroke-width="1" />
            <text :x="padL - 6" :y="yOf(t) + 4" text-anchor="end" class="fill-admin-subtext" font-size="11">{{ t }}</text>
          </g>
          <g v-for="h in [0, 3, 6, 9, 12, 15, 18, 21, 24]" :key="`x${h}`">
            <text :x="padL + (h / 24) * plotW" :y="H - 8" text-anchor="middle" class="fill-admin-subtext" font-size="11">
              {{ String(h % 24).padStart(2, '0') }}:00
            </text>
          </g>
          <polyline v-for="(pts, i) in prevLines" :key="`p${i}`" :points="pts" fill="none" class="stroke-admin-muted" stroke-width="1.25" opacity="0.7" />
          <polyline v-for="(pts, i) in todayLines" :key="`c${i}`" :points="pts" fill="none" class="stroke-admin-accent" stroke-width="2" />
          <g v-if="peakPoint">
            <circle :cx="peakPoint.x" :cy="peakPoint.y" r="4" class="fill-admin-accent" />
            <text :x="peakPoint.x + 8" :y="peakPoint.y - 6" class="fill-admin-text" font-size="12">peak {{ peakPoint.label }}</text>
          </g>
          <line v-if="hover" :x1="hover.x" :x2="hover.x" :y1="padT" :y2="padT + plotH" class="stroke-admin-subtext" stroke-dasharray="3 3" />
        </svg>
        <p v-if="hover" class="pointer-events-none absolute right-2 top-1 rounded bg-admin-bg/90 px-2 py-1 text-xs tabular-nums">
          {{ hover.label }}
        </p>
      </div>

      <h3 class="mb-2 mt-5 text-sm font-medium text-admin-subtext">Distinct users per hour</h3>
      <div class="flex h-24 items-end gap-1">
        <div
          v-for="b in hourBars"
          :key="b.hour"
          class="group relative flex-1 rounded-t bg-admin-accent/70 hover:bg-admin-accent"
          :style="{ height: `${Math.max(b.users ? 4 : 0, b.pct)}%` }"
          :title="`${String(b.hour).padStart(2, '0')}:00 · ${b.users} users · ${b.requests} requests`"
        ></div>
      </div>
      <div class="mt-1 flex gap-1 text-[10px] text-admin-muted">
        <span v-for="b in hourBars" :key="`l${b.hour}`" class="flex-1 text-center">{{ b.hour % 3 === 0 ? String(b.hour).padStart(2, '0') : '' }}</span>
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-3">
      <!-- Sections -->
      <section class="admin-card lg:col-span-2">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-medium">App sections, most to least used ({{ date }})</h2>
          <select v-model="sectionSort" class="admin-input w-auto">
            <option value="users">By users</option>
            <option value="requests">By requests</option>
          </select>
        </div>
        <div v-if="daySections.length" class="space-y-2">
          <div v-for="s in daySections" :key="s.section" class="grid grid-cols-[9rem_1fr_7rem] items-center gap-3 text-sm">
            <span class="truncate">{{ s.section }}</span>
            <div class="h-3 rounded bg-admin-bg">
              <div class="h-3 rounded bg-admin-accent" :style="{ width: `${(s[sectionSort] / sectionMax(daySections)) * 100}%` }"></div>
            </div>
            <span class="text-right tabular-nums text-xs text-admin-subtext">
              {{ formatNumber(s.users) }} users · {{ formatNumber(s.requests) }}
            </span>
          </div>
        </div>
        <p v-else class="py-6 text-center text-sm text-admin-muted">{{ loadingDay ? 'Loading…' : 'No section data for this day' }}</p>
        <p class="mt-3 text-xs text-admin-muted">
          Server-to-server traffic (game webhooks, LiveKit), admin and health checks are left out. Updated every 10 minutes.
        </p>
      </section>

      <!-- Live and calls now -->
      <section class="admin-card">
        <h2 class="mb-4 text-lg font-medium">Live and calls now</h2>
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div><dt class="text-xs text-admin-subtext">Hosts live</dt><dd class="text-xl font-semibold tabular-nums">{{ n(now?.live?.hostsLive) }}</dd></div>
          <div><dt class="text-xs text-admin-subtext">Viewers</dt><dd class="text-xl font-semibold tabular-nums">{{ n(now?.live?.viewers) }}</dd></div>
          <div><dt class="text-xs text-admin-subtext">Calls</dt><dd class="text-xl font-semibold tabular-nums">{{ n(now?.live?.callsActive) }}</dd></div>
          <div><dt class="text-xs text-admin-subtext">Users in calls</dt><dd class="text-xl font-semibold tabular-nums">{{ n(now?.live?.usersInCalls) }}</dd></div>
        </dl>
        <p class="mt-3 text-xs text-admin-muted">
          From Live-server at {{ istTime(now?.live?.at) }}. Peak hosts live {{ isToday ? 'today' : 'that day' }}: {{ n(day?.summary.peakHostsLive) }}.
        </p>
        <h3 class="mb-2 mt-5 text-sm font-medium text-admin-subtext">This hour ({{ now?.thisHour.hour ?? '—' }})</h3>
        <ul class="space-y-1 text-sm">
          <li v-for="s in (now?.thisHour.sections ?? []).slice(0, 6)" :key="s.section" class="flex justify-between">
            <span>{{ s.section }}</span>
            <span class="tabular-nums text-admin-subtext">{{ s.users }} users</span>
          </li>
          <li v-if="!(now?.thisHour.sections ?? []).length" class="text-admin-muted">No requests yet this hour</li>
        </ul>
      </section>
    </div>

    <!-- Range -->
    <section class="admin-card">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-medium">
          Last {{ rangeDays }} days
          <span v-if="range" class="ml-2 text-sm font-normal text-admin-subtext">{{ formatNumber(range.uniqueUsers) }} unique users</span>
        </h2>
        <div class="flex gap-1">
          <button
            v-for="d in [7, 30] as const"
            :key="d"
            type="button"
            :class="rangeDays === d ? 'admin-btn-primary' : 'admin-btn-secondary'"
            @click="rangeDays = d; loadRange()"
          >
            {{ d }} days
          </button>
        </div>
      </div>

      <h3 class="mb-2 text-sm font-medium text-admin-subtext">Busiest hours (darker = more distinct users)</h3>
      <div class="overflow-x-auto">
        <table class="text-xs">
          <thead>
            <tr>
              <th class="pr-2"></th>
              <th v-for="h in 24" :key="`hh${h}`" class="w-6 text-center font-normal text-admin-muted">{{ (h - 1) % 3 === 0 ? String(h - 1).padStart(2, '0') : '' }}</th>
              <th class="pl-3 text-left font-normal text-admin-muted">Active</th>
              <th class="pl-3 text-left font-normal text-admin-muted">Peak online</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in heatRows" :key="row.date">
              <td class="whitespace-nowrap pr-2 text-admin-subtext">{{ shortDate(row.date) }}</td>
              <td v-for="c in row.cells" :key="c.hour" class="p-0.5">
                <div
                  class="h-4 w-5 rounded-sm"
                  :class="c.users == null ? 'bg-admin-bg' : 'bg-admin-accent'"
                  :style="c.users == null ? {} : { opacity: c.opacity }"
                  :title="`${row.date} ${String(c.hour).padStart(2, '0')}:00 · ${c.users ?? 'no data'} users`"
                ></div>
              </td>
              <td class="pl-3 tabular-nums">{{ n(range?.perDay[i]?.activeUsers) }}</td>
              <td class="pl-3 tabular-nums">{{ n(range?.perDay[i]?.peakOnline) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 class="mb-2 mt-5 text-sm font-medium text-admin-subtext">Sections over the last {{ rangeDays }} days</h3>
      <div v-if="rangeSections.length" class="space-y-2">
        <div v-for="s in rangeSections" :key="`r${s.section}`" class="grid grid-cols-[9rem_1fr_7rem] items-center gap-3 text-sm">
          <span class="truncate">{{ s.section }}</span>
          <div class="h-3 rounded bg-admin-bg">
            <div class="h-3 rounded bg-admin-accent/70" :style="{ width: `${(s[sectionSort] / sectionMax(rangeSections)) * 100}%` }"></div>
          </div>
          <span class="text-right tabular-nums text-xs text-admin-subtext">
            {{ formatNumber(s.users) }} users · {{ formatNumber(s.requests) }}
          </span>
        </div>
      </div>
      <p v-else class="py-6 text-center text-sm text-admin-muted">{{ loadingRange ? 'Loading…' : 'No data in this range yet' }}</p>
    </section>
  </div>
</template>
