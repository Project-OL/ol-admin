<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { format } from 'date-fns'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import { useAgencyAdminStore } from '@/stores/agencyAdmin'
import type {
  AgencyApplicationKyc,
  AgencyApplicationListItem,
} from '@/types/agency'

const props = defineProps<{
  open: boolean
  application: AgencyApplicationListItem | null
  mode: 'pending' | 'rejected'
}>()

const emit = defineEmits<{
  close: []
  approve: [app: AgencyApplicationListItem]
  reject: [app: AgencyApplicationListItem]
}>()

const store = useAgencyAdminStore()
const loadingKyc = ref(false)

/** Merged display KYC — list row as base, enriched by GET …/kyc */
const displayKyc = ref<AgencyApplicationKyc | null>(null)
const displayFaceUrl = ref<string | null>(null)

const title = computed(() => {
  if (!props.application) return 'Application review'
  return props.mode === 'rejected' ? 'Rejected application' : 'Review application'
})

const kycComplete = computed(() => displayKyc.value?.isComplete ?? false)

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm')
  } catch {
    return value
  }
}

function kycFromApplication(app: AgencyApplicationListItem): AgencyApplicationKyc {
  return {
    govtIdUploaded: app.kyc.govtIdUploaded,
    govtIdUrl: app.kyc.govtIdUrl,
    govtIdSubmittedAt: app.kyc.govtIdSubmittedAt,
    contactSubmitted: app.kyc.contactSubmitted,
    contactPhone: app.kyc.contactPhone,
    contactEmail: app.kyc.contactEmail,
    contactSubmittedAt: app.kyc.contactSubmittedAt,
    faceVerified: app.kyc.faceVerified,
    faceImageUrl: app.kyc.faceImageUrl ?? app.faceImageUrl,
    isComplete: app.kyc.isComplete,
  }
}

async function loadKycEnrichment() {
  const app = props.application
  if (!app || !props.open) return

  displayKyc.value = kycFromApplication(app)
  displayFaceUrl.value = app.faceImageUrl ?? app.kyc.faceImageUrl

  loadingKyc.value = true
  try {
    const detail = await store.fetchApplicationKyc(app.applicantUserId)
    if (!detail || props.application?.applicantUserId !== app.applicantUserId) return

    displayKyc.value = {
      govtIdUploaded: detail.govtIdUploaded,
      govtIdUrl: detail.govtIdUrl ?? displayKyc.value?.govtIdUrl ?? null,
      govtIdSubmittedAt: detail.govtIdSubmittedAt ?? displayKyc.value?.govtIdSubmittedAt ?? null,
      contactSubmitted: detail.contactSubmitted,
      contactPhone: detail.contactPhone ?? displayKyc.value?.contactPhone ?? null,
      contactEmail: detail.contactEmail ?? displayKyc.value?.contactEmail ?? null,
      contactSubmittedAt: detail.contactSubmittedAt ?? displayKyc.value?.contactSubmittedAt ?? null,
      faceVerified: detail.faceVerified,
      faceImageUrl: detail.faceImageUrl ?? displayKyc.value?.faceImageUrl ?? null,
      isComplete:
        detail.govtIdUploaded &&
        detail.contactSubmitted &&
        detail.faceVerified,
    }
    displayFaceUrl.value = detail.faceImageUrl ?? displayFaceUrl.value
  } finally {
    loadingKyc.value = false
  }
}

watch(
  () => [props.open, props.application?.applicantUserId] as const,
  ([isOpen]) => {
    if (isOpen && props.application) void loadKycEnrichment()
    if (!isOpen) {
      displayKyc.value = null
      displayFaceUrl.value = null
    }
  },
)

function onApprove() {
  if (!props.application || !kycComplete.value) return
  emit('approve', props.application)
}

function onReject() {
  if (!props.application) return
  emit('reject', props.application)
}
</script>

<template>
  <BaseDialog :open="open" :title="title" size="lg" @close="emit('close')">
    <template #body>
      <div v-if="!application" class="py-8 text-center text-admin-muted">No application selected</div>
      <div v-else class="space-y-5">
        <div class="flex flex-wrap items-start gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-lg font-semibold">{{ application.applicantUserName }}</p>
            <p class="font-mono text-xs text-admin-subtext">
              {{ application.userPublicId }}
              <span v-if="application.username"> · @{{ application.username }}</span>
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <StatusBadge :status="application.status.toLowerCase()" />
              <span
                :class="[
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  kycComplete
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-admin-warn/20 text-admin-warn',
                ]"
              >
                KYC {{ kycComplete ? 'complete' : 'incomplete' }}
              </span>
              <span v-if="loadingKyc" class="text-xs text-admin-muted">Refreshing KYC…</span>
            </div>
          </div>
          <div class="text-right text-xs text-admin-subtext">
            <p>Applied {{ formatDate(application.appliedAt) }}</p>
            <p v-if="application.country">Country {{ application.country }}</p>
            <p v-if="mode === 'rejected' && application.reviewedAt">
              Reviewed {{ formatDate(application.reviewedAt) }}
            </p>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Face -->
          <div class="space-y-2">
            <p class="text-xs font-medium uppercase tracking-wide text-admin-subtext">Face photo</p>
            <div
              class="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-admin-border bg-admin-bg"
            >
              <img
                v-if="displayFaceUrl || displayKyc?.faceImageUrl"
                :src="displayFaceUrl || displayKyc?.faceImageUrl || ''"
                alt="Face reference"
                class="h-full w-full object-contain"
              />
              <span v-else class="text-sm text-admin-muted">Not indexed</span>
            </div>
            <p class="text-xs text-admin-muted">
              Face verified: {{ displayKyc?.faceVerified ? 'yes' : 'no' }}
            </p>
          </div>

          <!-- Govt ID -->
          <div class="space-y-2">
            <p class="text-xs font-medium uppercase tracking-wide text-admin-subtext">Government ID</p>
            <div
              class="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-admin-border bg-admin-bg"
            >
              <a
                v-if="displayKyc?.govtIdUrl"
                :href="displayKyc.govtIdUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="block h-full w-full"
              >
                <img
                  :src="displayKyc.govtIdUrl"
                  alt="Government ID"
                  class="h-full w-full object-contain"
                />
              </a>
              <span v-else class="text-sm text-admin-muted">Not uploaded</span>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs text-admin-muted">
              <span>{{ displayKyc?.govtIdUploaded ? 'Uploaded' : 'Missing' }}</span>
              <a
                v-if="displayKyc?.govtIdUrl"
                :href="displayKyc.govtIdUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-admin-accent hover:underline"
              >
                Open document
              </a>
              <span v-if="displayKyc?.govtIdSubmittedAt">
                · {{ formatDate(displayKyc.govtIdSubmittedAt) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Contact -->
        <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-admin-subtext">Contact</p>
          <div class="grid gap-2 sm:grid-cols-2">
            <div>
              <p class="text-xs text-admin-muted">Phone</p>
              <p class="text-sm font-medium">{{ displayKyc?.contactPhone || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-admin-muted">Email</p>
              <p class="break-all text-sm font-medium">{{ displayKyc?.contactEmail || '—' }}</p>
            </div>
          </div>
          <p class="mt-2 text-xs text-admin-muted">
            Contact
            {{ displayKyc?.contactSubmitted ? 'submitted' : 'not submitted'
            }}<template v-if="displayKyc?.contactSubmittedAt">
              · {{ formatDate(displayKyc.contactSubmittedAt) }}
            </template>
          </p>
        </div>

        <!-- Notes -->
        <div
          :class="[
            'space-y-2 rounded-md border p-3',
            mode === 'rejected'
              ? 'border-admin-warn/40 bg-admin-warn/5'
              : 'border-admin-border bg-admin-bg/40',
          ]"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-admin-subtext">Notes</p>
          <div>
            <p class="text-xs text-admin-muted">Admin note</p>
            <p class="text-sm whitespace-pre-wrap">{{ application.adminNote || '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-admin-muted">User note</p>
            <p class="text-sm whitespace-pre-wrap">{{ application.userNote || '—' }}</p>
          </div>
        </div>

        <p v-if="mode === 'pending' && !kycComplete" class="text-xs text-admin-warn">
          Approve requires complete KYC (face verified, government ID, and contact).
        </p>
      </div>
    </template>

    <template #footer>
      <template v-if="application && mode === 'pending'">
        <button type="button" class="admin-btn-secondary" @click="emit('close')">Close</button>
        <button type="button" class="admin-btn-danger" @click="onReject">Reject</button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="!kycComplete"
          :title="kycComplete ? 'Approve application' : 'KYC incomplete'"
          @click="onApprove"
        >
          Approve
        </button>
      </template>
      <template v-else-if="application">
        <RouterLink
          :to="`/admin/users/${application.applicantUserId}`"
          class="admin-btn-secondary"
          @click="emit('close')"
        >
          Open user
        </RouterLink>
        <button type="button" class="admin-btn-primary" @click="emit('close')">Close</button>
      </template>
    </template>
  </BaseDialog>
</template>
