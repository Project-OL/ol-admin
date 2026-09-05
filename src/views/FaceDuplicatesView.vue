<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { format } from 'date-fns'
import axios from 'axios'
import { faceVerificationAdminApi } from '@/api/faceVerificationAdmin'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import type { PendingDuplicatePair } from '@/types/faceVerificationSessions'
import { formatNumber } from '@/utils/format'
import { showToast } from '@/utils/toast'

const pairs = ref<PendingDuplicatePair[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const loading = ref(false)

const acceptTarget = ref<PendingDuplicatePair | null>(null)
const acceptOpen = ref(false)
const accepting = ref(false)

const search = ref('')
/** Applied search term — kept separate so paging doesn't pick up an unsubmitted edit. */
const appliedSearch = ref('')
const reordering = ref<string | null>(null)

function axiosMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  const body = err.response?.data as { message?: string } | undefined
  return body?.message || fallback
}

function formatDt(iso: string) {
  try {
    return format(new Date(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function similarityLabel(similarity: number | null) {
  if (similarity == null) return '—'
  return `${similarity.toFixed(1)}% match`
}

async function load(p = 1) {
  loading.value = true
  page.value = p
  try {
    const { data } = await faceVerificationAdminApi.listPendingDuplicates({
      page: p,
      limit,
      search: appliedSearch.value || undefined,
    })
    pairs.value = data.pairs ?? []
    total.value = data.total ?? 0
  } catch {
    pairs.value = []
    total.value = 0
    showToast('Failed to load pending duplicate cases', 'error')
  } finally {
    loading.value = false
  }
}

function applySearch() {
  appliedSearch.value = search.value.trim()
  void load(1)
}

function clearSearch() {
  search.value = ''
  appliedSearch.value = ''
  void load(1)
}

/** Ordering only — parks a hard case at the bottom without resolving it. */
async function toggleRowOrder(pair: PendingDuplicatePair) {
  const userId = pair.blockedUser.userId
  if (reordering.value) return
  reordering.value = userId
  try {
    if (pair.deprioritized) {
      await faceVerificationAdminApi.restoreDuplicateOrder(userId)
      showToast('Restored to default position', 'success')
    } else {
      await faceVerificationAdminApi.sendDuplicateToBottom(userId)
      showToast('Moved to the bottom of the list', 'success')
    }
    await load(page.value)
  } catch (err) {
    showToast(axiosMessage(err, 'Failed to reorder this case'), 'error')
  } finally {
    reordering.value = null
  }
}

function openAccept(pair: PendingDuplicatePair) {
  acceptTarget.value = pair
  acceptOpen.value = true
}

async function confirmAccept(payload: { reason?: string }) {
  if (!acceptTarget.value || accepting.value) return
  accepting.value = true
  try {
    const { data } = await faceVerificationAdminApi.acceptDuplicateBoth(
      acceptTarget.value.blockedUser.userId,
      payload.reason,
    )
    showToast(data.message || 'Both accounts accepted', 'success')
    acceptOpen.value = false
    acceptTarget.value = null
    await load(page.value)
  } catch (err) {
    showToast(axiosMessage(err, 'Failed to accept both accounts'), 'error')
  } finally {
    accepting.value = false
  }
}

onMounted(() => load(1))
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Face Duplicates</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        Registrations blocked because Rekognition matched them to another account's already-indexed
        face. Each case pairs the blocked user (left) with the matched/owner account (right) and both
        reference images, so you can tell a real duplicate from a false-positive match at a glance.
        "Accept both" indexes the blocked user's image as-is and leaves the owner untouched — use it
        when the two photos are clearly different people. If the match is genuine, resolve it from the
        user's own Face Verification panel instead (that flow resets both accounts to register again).
      </p>
    </div>

    <section class="admin-card">
      <div class="admin-search-row mb-4">
        <input
          v-model="search"
          class="admin-input min-w-0 flex-1"
          placeholder="Search user by id, public id, username or part of a name…"
          @keyup.enter="applySearch"
        />
        <button type="button" class="admin-btn-primary w-full sm:w-auto" :disabled="loading" @click="applySearch">
          Search
        </button>
        <button
          v-if="appliedSearch"
          type="button"
          class="admin-btn-secondary w-full sm:w-auto"
          :disabled="loading"
          @click="clearSearch"
        >
          Clear
        </button>
      </div>
      <p v-if="appliedSearch" class="mb-3 text-xs text-admin-subtext">
        Showing cases where either account matches “{{ appliedSearch }}”.
      </p>

      <div v-if="loading && !pairs.length" class="py-10 text-center text-admin-muted">Loading…</div>
      <div v-else-if="!pairs.length" class="py-10 text-center text-admin-muted">
        {{ appliedSearch ? 'No duplicate cases match this user' : 'No pending duplicate cases' }}
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="pair in pairs"
          :key="pair.blockedUser.userId"
          class="rounded-lg border border-admin-border p-3"
          :class="pair.deprioritized ? 'opacity-70' : ''"
        >
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr_auto]">
            <div class="flex gap-3">
              <img
                v-if="pair.blockedUser.imageUrl"
                :src="pair.blockedUser.imageUrl"
                alt="Blocked user's submitted photo"
                class="h-20 w-20 shrink-0 rounded-md border border-admin-border object-cover"
              />
              <div v-else class="h-20 w-20 shrink-0 rounded-md border border-admin-border bg-admin-muted/10"></div>
              <div class="min-w-0">
                <p class="text-[11px] font-medium uppercase tracking-wide text-admin-subtext">Blocked</p>
                <RouterLink
                  class="block truncate font-medium text-admin-accent hover:underline"
                  :to="`/admin/users/${pair.blockedUser.userId}`"
                >
                  {{ pair.blockedUser.userName }}
                </RouterLink>
                <p class="font-mono text-xs text-admin-subtext">
                  {{ pair.blockedUser.displayPublicId ?? pair.blockedUser.userId }}
                </p>
                <p class="mt-1 text-xs text-admin-muted">Flagged {{ formatDt(pair.blockedUser.flaggedAt) }}</p>
              </div>
            </div>

            <div class="flex flex-col items-center justify-center text-center">
              <span class="text-lg text-admin-muted">↔</span>
              <span class="text-xs font-medium text-admin-warn">{{ similarityLabel(pair.faceMatchSimilarity) }}</span>
            </div>

            <div class="flex gap-3">
              <img
                v-if="pair.ownerUser?.imageUrl"
                :src="pair.ownerUser.imageUrl"
                alt="Matched account's photo"
                class="h-20 w-20 shrink-0 rounded-md border border-admin-border object-cover"
              />
              <div v-else class="h-20 w-20 shrink-0 rounded-md border border-admin-border bg-admin-muted/10"></div>
              <div v-if="pair.ownerUser" class="min-w-0">
                <p class="text-[11px] font-medium uppercase tracking-wide text-admin-subtext">
                  Matched account
                </p>
                <RouterLink
                  class="block truncate font-medium text-admin-accent hover:underline"
                  :to="`/admin/users/${pair.ownerUser.userId}`"
                >
                  {{ pair.ownerUser.userName }}
                </RouterLink>
                <p class="font-mono text-xs text-admin-subtext">
                  {{ pair.ownerUser.displayPublicId ?? pair.ownerUser.userId }}
                </p>
                <p class="mt-1 text-xs text-admin-muted">{{ pair.ownerUser.status }}</p>
              </div>
              <p v-else class="text-xs text-admin-muted">Matched account no longer available</p>
            </div>

            <div class="flex flex-col items-stretch justify-center gap-2 sm:items-end">
              <button
                type="button"
                class="admin-btn-primary py-1.5 text-xs"
                :disabled="accepting"
                @click="openAccept(pair)"
              >
                Accept both
              </button>
              <button
                type="button"
                class="admin-btn-secondary py-1.5 text-xs whitespace-nowrap"
                :disabled="reordering === pair.blockedUser.userId || loading"
                :title="
                  pair.deprioritized
                    ? 'Restore this case to its default position'
                    : 'Park this case below every other row'
                "
                @click="toggleRowOrder(pair)"
              >
                {{ pair.deprioritized ? '↑ Restore order' : '↓ Send to bottom' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="admin-pagination mt-4">
        <span>{{ formatNumber(total) }} total</span>
        <div class="flex items-center gap-2">
          <span class="text-xs">Page {{ page }}</span>
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
            :disabled="page * limit >= total || loading"
            @click="load(page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <ConfirmActionDialog
      :open="acceptOpen"
      title="Accept both accounts"
      :message="
        acceptTarget
          ? `Indexes ${acceptTarget.blockedUser.userName}'s submitted photo in Rekognition as-is and marks it verified. ${acceptTarget.ownerUser?.userName ?? 'The matched account'} is left untouched — both accounts end up verified independently. Only do this once you've visually confirmed the two photos are different people.`
          : ''
      "
      confirm-label="Accept both"
      variant="danger"
      require-reason
      @close="acceptOpen = false"
      @confirm="confirmAccept"
    />
  </div>
</template>
