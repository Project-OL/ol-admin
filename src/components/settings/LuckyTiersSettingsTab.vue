<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { systemSettingsApi } from '@/api/systemSettings'
import type {
  LuckyTierDashboard,
  LuckyTierListItem,
  LuckyTierMode,
  LuckyTierSeedChoice,
} from '@/types/luckyTiers'
import { showToast } from '@/utils/toast'

const loading = ref(false)
const loadError = ref('')
const tiers = ref<LuckyTierListItem[]>([])
const dashboards = ref<Record<string, LuckyTierDashboard>>({})

const savingMode = ref<string | null>(null)
const savingSeed = ref<string | null>(null)

const modeDraft = reactive<Record<string, LuckyTierMode>>({})
const enforceOverride = reactive<Record<string, string>>({})

const seedForm = reactive<
  Record<string, { choice: LuckyTierSeedChoice; amount: string; reason: string }>
>({})

function ensureSeedForm(tierId: string) {
  if (!seedForm[tierId]) {
    seedForm[tierId] = { choice: 'start_empty', amount: '', reason: '' }
  }
  return seedForm[tierId]
}

function bpToPercent(bp: number): string {
  return (bp / 100).toFixed(2)
}

function formatRtp(rtpBp: number | null | undefined): string {
  if (rtpBp == null) return '—'
  return `${(rtpBp / 100).toFixed(2)}%`
}

async function loadTiers() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await systemSettingsApi.getLuckyTiers()
    tiers.value = data.tiers
    for (const t of data.tiers) {
      modeDraft[t.tierId] = t.mode
      ensureSeedForm(t.tierId)
      try {
        const dash = await systemSettingsApi.getLuckyTierDashboard(t.tierId)
        dashboards.value[t.tierId] = dash.data
      } catch {
        /* dashboard optional */
      }
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load lucky tiers'
  } finally {
    loading.value = false
  }
}

async function saveMode(tierId: string) {
  savingMode.value = tierId
  try {
    const mode = modeDraft[tierId] ?? 'off'
    const payload: { mode: LuckyTierMode; enforceOverrideReason?: string } = { mode }
    const override = enforceOverride[tierId]?.trim()
    if (mode === 'enforce' && override) payload.enforceOverrideReason = override
    await systemSettingsApi.updateLuckyTierMode(tierId, payload)
    showToast(`${tierId} mode set to ${mode}`, 'success')
    await loadTiers()
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Failed to update mode', 'error')
  } finally {
    savingMode.value = null
  }
}

async function submitSeed(tierId: string) {
  savingSeed.value = tierId
  const form = ensureSeedForm(tierId)
  try {
    await systemSettingsApi.seedLuckyTier(tierId, {
      choice: form.choice,
      amount: form.choice === 'seed' ? form.amount || undefined : '0',
      reason: form.reason.trim() || undefined,
    })
    showToast(`${tierId}: seed decision recorded`, 'success')
    await loadTiers()
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Failed to record seed', 'error')
  } finally {
    savingSeed.value = null
  }
}

onMounted(() => {
  void loadTiers()
})
</script>

<template>
  <section class="admin-card max-w-5xl space-y-4">
    <div>
      <h2 class="text-sm font-semibold text-admin-text">Lucky tiers (water-level)</h2>
      <p class="mt-0.5 text-xs text-admin-subtext">
        Per price-band pools for server-draw lucky gifts. Global host share and RTP sliders on the
        Host tab still apply; under water_v1 each tier has its own
        <code class="text-xs">r_bp</code> (inflow rate). Enforce requires a seed decision and
        normally prior shadow mode.
      </p>
    </div>

    <div v-if="loading" class="py-4 text-center text-xs text-admin-subtext">Loading tiers…</div>
    <div v-else-if="loadError" class="space-y-2">
      <p class="text-xs text-admin-danger">{{ loadError }}</p>
      <button type="button" class="admin-btn-secondary text-xs" @click="loadTiers">Retry</button>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="tier in tiers"
        :key="tier.tierId"
        class="rounded-md border border-admin-border p-3 space-y-3"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-sm font-medium text-admin-text">
            {{ tier.tierId }}
            <span class="text-xs font-normal text-admin-subtext">
              ({{ tier.priceMin }}–{{ tier.priceMax ?? '∞' }} coins · v{{ tier.version }})
            </span>
          </h3>
          <span class="text-xs text-admin-subtext">
            r={{ bpToPercent(tier.rBp) }}% · L0={{ tier.l0 }} · floor={{ tier.floor }}
          </span>
        </div>

        <dl class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <dt class="text-admin-subtext">Live pool W</dt>
            <dd class="font-medium">{{ tier.poolBalance ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-admin-subtext">Shadow pool</dt>
            <dd class="font-medium">{{ tier.shadowPoolBalance ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-admin-subtext">Seed logged</dt>
            <dd class="font-medium">
              {{ tier.hasSeedDecision ? tier.latestSeedChoice : 'no' }}
            </dd>
          </div>
          <div v-if="dashboards[tier.tierId]">
            <dt class="text-admin-subtext">λ / band</dt>
            <dd class="font-medium">
              {{ dashboards[tier.tierId]!.lambdaBp }} bp · {{ dashboards[tier.tierId]!.band }}
            </dd>
          </div>
        </dl>

        <dl
          v-if="dashboards[tier.tierId]"
          class="grid grid-cols-2 gap-2 rounded bg-admin-bg px-2 py-1.5 text-xs sm:grid-cols-3"
        >
          <div>
            <dt class="text-admin-subtext">RTP today (enforce draws)</dt>
            <dd>{{ formatRtp(dashboards[tier.tierId]!.rtpTodayBp) }}</dd>
          </div>
          <div>
            <dt class="text-admin-subtext">Draws today</dt>
            <dd>{{ dashboards[tier.tierId]!.drawCountToday }}</dd>
          </div>
          <div>
            <dt class="text-admin-subtext">RTP 7d (snapshots)</dt>
            <dd>{{ formatRtp(dashboards[tier.tierId]!.snapshotRtp7dBp) }}</dd>
          </div>
        </dl>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Mode</label>
            <select
              v-model="modeDraft[tier.tierId]"
              class="admin-input w-full text-xs"
              :disabled="savingMode === tier.tierId"
            >
              <option value="off">off</option>
              <option value="shadow">shadow</option>
              <option value="enforce">enforce</option>
            </select>
            <input
              v-if="modeDraft[tier.tierId] === 'enforce'"
              v-model="enforceOverride[tier.tierId]"
              type="text"
              class="admin-input mt-1 w-full text-xs"
              placeholder="Override reason (if skipping shadow gates)"
            />
            <button
              type="button"
              class="admin-btn-secondary mt-1 text-xs"
              :disabled="savingMode === tier.tierId"
              @click="saveMode(tier.tierId)"
            >
              {{ savingMode === tier.tierId ? 'Saving…' : 'Save mode' }}
            </button>
          </div>

          <form class="space-y-1" @submit.prevent="submitSeed(tier.tierId)">
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Seed decision (F10)</label>
            <select v-model="ensureSeedForm(tier.tierId).choice" class="admin-input w-full text-xs">
              <option value="start_empty">start_empty</option>
              <option value="capped_ladder">capped_ladder</option>
              <option value="seed">seed (set pool balance)</option>
            </select>
            <input
              v-if="ensureSeedForm(tier.tierId).choice === 'seed'"
              v-model="ensureSeedForm(tier.tierId).amount"
              type="text"
              inputmode="numeric"
              class="admin-input w-full text-xs"
              placeholder="Pool balance (coins)"
            />
            <input
              v-model="ensureSeedForm(tier.tierId).reason"
              type="text"
              class="admin-input w-full text-xs"
              placeholder="Reason (optional)"
            />
            <button
              type="submit"
              class="admin-btn-primary text-xs"
              :disabled="savingSeed === tier.tierId"
            >
              {{ savingSeed === tier.tierId ? 'Saving…' : 'Record seed' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
