<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { format } from 'date-fns'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import {
  customerSupportApi,
  uploadSupportReplyImage,
} from '@/api/customerSupport'
import { useAuthStore } from '@/stores/auth'
import type {
  SupportMessage,
  SupportNote,
  SupportReplyTemplate,
  SupportTicketDetail,
  SupportTicketPriority,
  SupportTicketResolution,
} from '@/types/customerSupport'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import SupportTicketInitialSubmissionPanel from '@/components/support/SupportTicketInitialSubmissionPanel.vue'
import { ticketCategoryBreadcrumb } from '@/utils/supportTicket'
import { showToast } from '@/utils/toast'
import { useAdminWebSocket } from '@/composables/useAdminWebSocket'
import { useCsaDirectory } from '@/composables/useCsaDirectory'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const adminWs = useAdminWebSocket()

const ticketId = computed(() => String(route.params.ticketId))
const ticket = ref<SupportTicketDetail | null>(null)
const messages = ref<SupportMessage[]>([])
const notes = ref<SupportNote[]>([])
const messagesHasMore = ref(false)
const messagesCursor = ref<string | null>(null)
const loadingMoreMessages = ref(false)
const loading = ref(true)
const acting = ref(false)
const detailTab = ref<'messages' | 'notes'>('messages')
const messagesEl = ref<HTMLElement | null>(null)

const replyText = ref('')
const replyFile = ref<File | null>(null)
const noteText = ref('')
const resolveOpen = ref(false)
const resolveNote = ref('')
const resolveType = ref<SupportTicketResolution>('RESOLVED')
const replyTemplates = ref<SupportReplyTemplate[]>([])
const loadingTemplates = ref(false)
const starring = ref(false)
const selectedTemplateId = ref('')
const assignOpen = ref(false)
const assignAdminId = ref('')
const { csas: csaOptions, loading: loadingCsas, load: loadCsaDirectory, csaLabel } = useCsaDirectory()

const assignChoices = computed(() => {
  const current = ticket.value?.assignedAdminId
  return csaOptions.value.filter((c) => c.id !== current)
})

const isFrozen = computed(() => {
  if (!ticket.value) return false
  if (ticket.value.stage === 'pending_review' || ticket.value.status === 'PENDING_REVIEW') return true
  if (ticket.value.rating != null) return true
  return false
})

const canAct = computed(() => {
  if (!ticket.value) return false
  if (ticket.value.stage === 'closed') return false
  if (isFrozen.value) return false
  if (auth.isSuperAdmin) return true
  return ticket.value.assignedAdminId === auth.admin?.id
})

// Support can always keep talking to the user — a resolved or closed ticket still
// accepts messages (the API re-opens the review window on any non-closed ticket).
const canReply = computed(() => {
  if (!ticket.value) return false
  if (auth.isSuperAdmin) return true
  if (!ticket.value.assignedAdminId) return false
  return ticket.value.assignedAdminId === auth.admin?.id
})

const canHandOff = computed(() => canAct.value && !isFrozen.value)
const canResolve = computed(() => canAct.value && !isFrozen.value)

const canForceClose = computed(() => {
  if (!ticket.value) return false
  if (ticket.value.stage === 'closed') return false
  if (ticket.value.rating != null) return false
  if (auth.isSuperAdmin) return true
  return ticket.value.assignedAdminId === auth.admin?.id
})

const isUnassigned = computed(() => !ticket.value?.assignedAdminId)

function stageLabel(stage: string) {
  const map: Record<string, string> = {
    open: 'Open',
    assigned: 'In progress',
    pending_review: 'Pending review',
    closed: 'Closed',
  }
  return map[stage] ?? stage
}

function ticketErrorMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback
  const code = (err.response?.data as { code?: string; message?: string } | undefined)?.code
  const message = (err.response?.data as { message?: string } | undefined)?.message
  switch (code) {
    case 'TICKET_NOT_ASSIGNED_TO_YOU': return 'Ticket is not assigned to you'
    case 'TICKET_CLOSED': return 'Ticket is already closed'
    case 'ALREADY_ASSIGNED': return 'Ticket is already assigned'
    case 'TICKET_ALREADY_PENDING_REVIEW': return 'Ticket is already pending user review'
    case 'TICKET_PENDING_REVIEW_FROZEN': return 'Ticket is frozen during pending review — no hand-off'
    case 'TICKET_RATED_FROZEN': return 'Ticket was rated and is frozen to the assignee'
    case 'TICKET_ALREADY_RATED': return 'Ticket already has a rating'
    case 'INVALID_REQUEST': return message || 'Invalid request (note may be required)'
    default: return message || fallback
  }
}

function upsertMessage(msg: SupportMessage) {
  if (messages.value.some((m) => m.id === msg.id || (msg.publicId && m.publicId === msg.publicId))) return
  messages.value = [...messages.value, msg]
  void nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
}

async function loadTicket(appendMessages = false, silent = false) {
  if (!appendMessages && !silent) loading.value = true
  try {
    const { data } = await customerSupportApi.getTicket(ticketId.value, {
      cursor: appendMessages ? messagesCursor.value ?? undefined : undefined,
      limit: 30,
    })
    ticket.value = data.ticket
    if (appendMessages) {
      messages.value = [...(data.messages ?? []), ...messages.value]
    } else {
      messages.value = data.messages ?? []
      notes.value = data.notes ?? []
    }
    messagesHasMore.value = Boolean(data.hasMore)
    messagesCursor.value = data.nextCursor ?? null
  } catch {
    if (!appendMessages) showToast('Failed to load ticket', 'error')
  } finally {
    if (!appendMessages && !silent) loading.value = false
  }
}

async function loadOlderMessages() {
  if (!messagesHasMore.value || !messagesCursor.value || loadingMoreMessages.value) return
  loadingMoreMessages.value = true
  try {
    await loadTicket(true)
  } finally {
    loadingMoreMessages.value = false
  }
}

async function sendReply() {
  if (!replyText.value.trim() && !replyFile.value) {
    showToast('Enter a reply or attach an image', 'error')
    return
  }
  acting.value = true
  const optimisticContent = replyText.value.trim() || '(image)'
  const optimisticId = `optimistic-${Date.now()}`
  // Captured before the inputs are cleared below, otherwise the attachment is lost.
  const pendingFile = replyFile.value
  const wasClosed = ticket.value?.stage === 'closed'
  // Optimistic insert
  const optimistic: SupportMessage = {
    id: optimisticId,
    senderType: 'SUPPORT',
    content: optimisticContent,
    imageUrl: null,
    createdAt: new Date().toISOString(),
  }
  messages.value = [...messages.value, optimistic]
  void nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
  replyText.value = ''
  replyFile.value = null
  try {
    let imageUrl: string | undefined
    if (pendingFile) {
      imageUrl = await uploadSupportReplyImage(ticketId.value, pendingFile)
    }
    const { data } = await customerSupportApi.reply(ticketId.value, {
      content: optimisticContent,
      imageUrl,
    })
    // Replace optimistic with real
    messages.value = messages.value.map((m) => m.id === optimisticId ? (data.message ?? m) : m)
    showToast(wasClosed ? 'Message sent' : 'Reply sent — ticket marked resolved', 'success')
    // A reply on a live ticket moves it to pending review; refresh the header state.
    await loadTicket(false, true)
  } catch (err) {
    // Remove optimistic on failure
    messages.value = messages.value.filter((m) => m.id !== optimisticId)
    replyText.value = optimisticContent
    replyFile.value = pendingFile
    showToast(ticketErrorMessage(err, 'Reply failed'), 'error')
  } finally {
    acting.value = false
  }
}

async function claim() {
  acting.value = true
  try {
    await customerSupportApi.claim(ticketId.value)
    showToast('Ticket claimed', 'success')
    await loadTicket(false, true)
  } catch (err) {
    showToast(ticketErrorMessage(err, 'Claim failed'), 'error')
  } finally {
    acting.value = false
  }
}

async function loadReplyTemplates() {
  if (replyTemplates.value.length || loadingTemplates.value) return
  loadingTemplates.value = true
  try {
    const { data } = await customerSupportApi.listReplyTemplates()
    replyTemplates.value = data.templates ?? []
  } catch {
    /* template picker is optional; leave the note free-typed */
  } finally {
    loadingTemplates.value = false
  }
}

function applyTemplate() {
  const template = replyTemplates.value.find((t) => t.id === selectedTemplateId.value)
  if (template) resolveNote.value = template.content
}

async function submitResolve() {
  const note = resolveNote.value.trim()
  acting.value = true
  try {
    await customerSupportApi.resolve(ticketId.value, {
      resolution: resolveType.value,
      ...(note ? { note } : {}),
    })
    resolveOpen.value = false
    showToast('Resolution offered — pending user review', 'success')
    await loadTicket(false, true)
  } catch (err) {
    showToast(ticketErrorMessage(err, 'Resolve failed'), 'error')
  } finally {
    acting.value = false
  }
}

/** Resolve is one click: no confirmation dialog, no template, no note. */
async function resolveNow() {
  if (acting.value) return
  acting.value = true
  try {
    await customerSupportApi.resolve(ticketId.value, { resolution: 'RESOLVED' })
    showToast('Ticket resolved — pending user review', 'success')
    await loadTicket(false, true)
  } catch (err) {
    showToast(ticketErrorMessage(err, 'Resolve failed'), 'error')
  } finally {
    acting.value = false
  }
}

async function toggleStar() {
  if (!ticket.value || starring.value) return
  const next = !ticket.value.isStarred
  starring.value = true
  ticket.value.isStarred = next
  try {
    await customerSupportApi.setStar(ticketId.value, next)
  } catch {
    if (ticket.value) ticket.value.isStarred = !next
    showToast(next ? 'Could not star ticket' : 'Could not remove star', 'error')
  } finally {
    starring.value = false
  }
}

async function forceClose() {
  if (!confirm('Force-close this ticket immediately (no review window)?')) return
  acting.value = true
  try {
    await customerSupportApi.close(ticketId.value)
    showToast('Ticket closed', 'success')
    await loadTicket(false, true)
  } catch (err) {
    showToast(ticketErrorMessage(err, 'Close failed'), 'error')
  } finally {
    acting.value = false
  }
}

async function setPriority(priority: SupportTicketPriority) {
  acting.value = true
  try {
    await customerSupportApi.setPriority(ticketId.value, priority)
    showToast('Priority updated', 'success')
    await loadTicket(false, true)
  } catch (err) {
    showToast(ticketErrorMessage(err, 'Priority update failed'), 'error')
  } finally {
    acting.value = false
  }
}

function onPriorityChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value as SupportTicketPriority
  void setPriority(value)
}

async function addNote() {
  if (!noteText.value.trim()) return
  acting.value = true
  try {
    await customerSupportApi.addNote(ticketId.value, noteText.value.trim())
    noteText.value = ''
    showToast('Note added', 'success')
    await loadTicket(false, true)
    detailTab.value = 'notes'
  } catch {
    showToast('Failed to add note', 'error')
  } finally {
    acting.value = false
  }
}

async function openAssign() {
  if (!canHandOff.value) {
    showToast('Hand-off is blocked while pending review or rated', 'error')
    return
  }
  assignOpen.value = true
  assignAdminId.value = ''
  await loadCsaDirectory()
}

async function submitAssign() {
  if (!assignAdminId.value) {
    showToast('Select a CSA', 'error')
    return
  }
  acting.value = true
  try {
    await customerSupportApi.assign(ticketId.value, assignAdminId.value)
    assignOpen.value = false
    showToast('Ticket handed off', 'success')
    await loadTicket(false, true)
  } catch (err) {
    showToast(ticketErrorMessage(err, 'Assign failed'), 'error')
  } finally {
    acting.value = false
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  replyFile.value = input.files?.[0] ?? null
}

// --- WebSocket live subscription ---
let unsubWs: (() => void) | null = null

function bindWs(tid: string) {
  void adminWs.connect()
  adminWs.joinSupportTicket(tid)
  unsubWs = adminWs.onFrame((frame) => {
    if (frame.t === 'SUPPORT_TICKET_MESSAGE') {
      if (frame.ticketId !== tid) return
      upsertMessage({
        id: frame.message.id,
        publicId: frame.message.publicId,
        senderType: frame.message.senderType as 'USER' | 'SUPPORT' | 'SYSTEM',
        content: frame.message.content,
        imageUrl: frame.message.imageUrl,
        isAutoReply: frame.message.isAutoReply,
        createdAt: frame.message.createdAt,
      })
    }
    if (frame.t === 'SUPPORT_TICKET_STATUS_CHANGED') {
      if (frame.ticketId !== tid) return
      // Refresh full ticket to pick up new stage/status/pendingReviewUntil
      void loadTicket(false, true)
      const statusMsg = frame.status === 'CLOSED'
        ? `Ticket closed (${frame.resolution ?? 'force-closed'})`
        : `Ticket moved to pending review (${frame.resolution})`
      showToast(statusMsg, 'info' as never)
    }
  })
}

function unbindWs(tid: string) {
  adminWs.leaveSupportTicket(tid)
  if (unsubWs) { unsubWs(); unsubWs = null }
}

onMounted(() => {
  void loadTicket()
  bindWs(ticketId.value)
})

onUnmounted(() => {
  unbindWs(ticketId.value)
})
</script>

<template>
  <div class="admin-page max-w-[1200px]">
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="admin-btn-secondary text-xs"
        @click="router.push({ path: '/admin/support', query: { tab: 'tickets' } })"
      >
        ← Back to tickets
      </button>
      <h1 class="text-xl font-semibold">Ticket detail</h1>
    </div>

    <div v-if="loading" class="py-16 text-center text-admin-muted">Loading…</div>

    <template v-else-if="ticket">
      <div class="admin-card space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="text-xl leading-none"
                :class="ticket.isStarred ? 'text-amber-400' : 'text-admin-muted hover:text-amber-400'"
                :disabled="starring"
                :title="ticket.isStarred ? 'Remove star' : 'Star this ticket'"
                @click="toggleStar"
              >
                {{ ticket.isStarred ? '★' : '☆' }}
              </button>
              <h2 class="text-lg font-semibold">{{ ticket.publicId ?? ticket.id }}</h2>
              <StatusBadge
                :status="ticket.stage === 'closed' ? 'inactive' : ticket.stage === 'pending_review' ? 'warn' : 'active'"
                :label="stageLabel(ticket.stage)"
              />
              <span class="rounded bg-admin-bg px-2 py-0.5 text-xs font-semibold text-admin-subtext">
                {{ ticket.priority }}
              </span>
              <span
                v-if="ticket.resolution"
                class="rounded bg-admin-bg px-2 py-0.5 text-xs text-admin-subtext"
              >
                {{ ticket.resolution }}
              </span>
              <span
                v-if="ticket.rating != null"
                class="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400"
              >
                ★ {{ ticket.rating }}/5
              </span>
            </div>
            <p class="mt-1 text-sm text-admin-subtext">
              {{ ticketCategoryBreadcrumb(ticket) }}
            </p>
            <p
              v-if="ticket.stage === 'pending_review' || ticket.status === 'PENDING_REVIEW'"
              class="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200"
            >
              Resolution offered — user has until
              <strong>{{ ticket.pendingReviewUntil ? format(new Date(String(ticket.pendingReviewUntil)), 'dd MMM HH:mm') : '(contest window)' }}</strong>
              to confirm-close or reply to contest.
              Hand-off is frozen until closed or reopened.
            </p>
            <p v-if="ticket.ratedAt" class="mt-1 text-xs text-admin-muted">
              Rated {{ format(new Date(ticket.ratedAt), 'dd MMM yyyy HH:mm') }}
            </p>
            <p v-if="isFrozen && ticket.stage !== 'closed'" class="mt-2 text-xs text-admin-warn">
              Frozen to assignee during pending review / after rating — hand-off disabled.
            </p>
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              v-if="isUnassigned && ticket.stage === 'open'"
              type="button"
              class="admin-btn-primary text-xs"
              :disabled="acting"
              @click="claim"
            >
              Claim
            </button>
            <button
              v-if="canResolve"
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="acting"
              title="Marks the ticket resolved immediately — no note needed"
              @click="resolveNow"
            >
              Resolve
            </button>
            <button
              v-if="canResolve"
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="acting"
              @click="resolveType = 'REJECTED'; resolveNote = ''; selectedTemplateId = ''; resolveOpen = true; loadReplyTemplates()"
            >
              Reject
            </button>
            <button
              v-if="canHandOff"
              type="button"
              class="admin-btn-secondary text-xs"
              @click="openAssign"
            >
              Hand off
            </button>
            <button
              v-if="canForceClose"
              type="button"
              class="admin-btn-danger text-xs"
              :disabled="acting"
              @click="forceClose"
            >
              Force close
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded border border-admin-border bg-admin-bg/40 p-3 text-sm">
            <p class="text-xs text-admin-subtext">User</p>
            <p class="font-medium">{{ ticket.user?.name || ticket.user?.username || '—' }}</p>
            <p class="font-mono text-xs text-admin-muted">{{ ticket.user?.publicId ?? ticket.user?.id }}</p>
            <p v-if="ticket.user?.country" class="text-xs text-admin-muted">{{ ticket.user.country }}</p>
          </div>
          <div class="rounded border border-admin-border bg-admin-bg/40 p-3 text-sm">
            <p class="text-xs text-admin-subtext">Assignee</p>
            <p class="font-medium">
              {{ ticket.assignedAdmin?.displayName || ticket.assignedAdmin?.username || 'Unassigned' }}
            </p>
          </div>
          <div class="rounded border border-admin-border bg-admin-bg/40 p-3 text-sm">
            <p class="text-xs text-admin-subtext">Priority</p>
            <select
              class="admin-input mt-1"
              :value="ticket.priority"
              :disabled="!canAct || acting"
              @change="onPriorityChange"
            >
              <option value="LOW">LOW</option>
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
        </div>

        <SupportTicketInitialSubmissionPanel :ticket="ticket" />

        <div class="flex gap-1 rounded-lg bg-admin-bg p-1 w-fit">
          <button
            type="button"
            :class="[
              'rounded-md px-3 py-1.5 text-xs font-medium',
              detailTab === 'messages' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
            ]"
            @click="detailTab = 'messages'"
          >
            Messages
          </button>
          <button
            type="button"
            :class="[
              'rounded-md px-3 py-1.5 text-xs font-medium',
              detailTab === 'notes' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
            ]"
            @click="detailTab = 'notes'"
          >
            Internal notes ({{ notes.length }})
          </button>
        </div>

        <div v-show="detailTab === 'messages'" class="space-y-3">
          <div ref="messagesEl" class="max-h-[420px] space-y-2 overflow-y-auto rounded border border-admin-border p-3">
            <div v-if="messagesHasMore" class="pb-2 text-center">
              <button
                type="button"
                class="admin-btn-secondary py-1 text-xs"
                :disabled="loadingMoreMessages"
                @click="loadOlderMessages"
              >
                {{ loadingMoreMessages ? 'Loading…' : 'Load older messages' }}
              </button>
            </div>
            <div
              v-for="m in messages"
              :key="m.id"
              :class="[
                'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                m.senderType === 'SUPPORT'
                  ? 'ml-auto bg-admin-accent/20'
                  : m.senderType === 'SYSTEM'
                    ? 'mx-auto bg-admin-bg text-center text-xs text-admin-muted'
                    : 'bg-admin-bg',
              ]"
            >
              <p class="mb-0.5 text-[10px] uppercase text-admin-muted">{{ m.senderType }}</p>
              <p class="whitespace-pre-wrap">{{ m.content }}</p>
              <img
                v-if="m.imageUrl"
                :src="m.imageUrl"
                alt="Attachment"
                class="mt-2 max-h-40 rounded border border-admin-border"
              />
              <p class="mt-1 text-[10px] text-admin-muted">
                {{ format(new Date(m.createdAt), 'dd MMM yyyy HH:mm') }}
              </p>
            </div>
            <p v-if="!messages.length" class="py-8 text-center text-admin-muted">No messages</p>
          </div>

          <div v-if="canReply" class="space-y-2">
            <p v-if="ticket.stage === 'closed'" class="text-xs text-admin-muted">
              This ticket is closed — your message still reaches the user and the ticket stays closed.
            </p>
            <p v-else class="text-xs text-admin-muted">
              Sending a reply marks this ticket resolved and starts the user's review window.
            </p>
            <textarea
              v-model="replyText"
              rows="3"
              class="admin-input resize-none"
              placeholder="Write a reply to the user…"
              :disabled="acting"
            />
            <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input type="file" accept="image/*" class="min-w-0 text-xs text-admin-subtext" @change="onFileChange" />
              <span v-if="replyFile" class="truncate text-xs text-admin-muted">{{ replyFile.name }}</span>
              <button
                type="button"
                class="admin-btn-primary w-full sm:ml-auto sm:w-auto"
                :disabled="acting"
                @click="sendReply"
              >
                {{ acting ? 'Sending…' : 'Send reply' }}
              </button>
            </div>
          </div>
          <p v-else-if="isUnassigned && ticket.stage === 'open'" class="text-xs text-admin-warn">
            Claim this ticket before replying.
          </p>
          <p v-else class="text-xs text-admin-warn">
            This ticket is assigned to another agent — actions are disabled.
          </p>
        </div>

        <div v-show="detailTab === 'notes'" class="space-y-3">
          <div class="space-y-2 rounded border border-admin-border p-3">
            <div
              v-for="n in notes"
              :key="n.id"
              class="rounded border border-admin-border/60 bg-admin-bg/40 px-3 py-2 text-sm"
            >
              <p class="whitespace-pre-wrap">{{ n.content }}</p>
              <p class="mt-1 text-[10px] text-admin-muted">
                {{ n.admin?.displayName || n.admin?.username || 'CSA' }} ·
                {{ format(new Date(n.createdAt), 'dd MMM yyyy HH:mm') }}
              </p>
            </div>
            <p v-if="!notes.length" class="py-6 text-center text-admin-muted">No internal notes</p>
          </div>
          <div v-if="canReply || auth.isSuperAdmin" class="admin-search-row">
            <input v-model="noteText" class="admin-input min-w-0 flex-1" placeholder="Add internal note…" />
            <button type="button" class="admin-btn-secondary w-full sm:w-auto" :disabled="acting" @click="addNote">
              Add
            </button>
          </div>
        </div>
      </div>
    </template>

    <BaseDialog :open="resolveOpen" :title="resolveType === 'RESOLVED' ? 'Resolve ticket' : 'Reject ticket'" @close="resolveOpen = false">
      <template #body>
        <p class="mb-3 text-sm text-admin-subtext">
          Posts your reason into the user chat and moves the ticket to pending review.
          The user will have the configured contest window to confirm-close or reply to contest.
        </p>
        <div v-if="replyTemplates.length || loadingTemplates" class="mb-3">
          <label class="mb-1 block text-xs text-admin-subtext">Use template (optional)</label>
          <select
            v-model="selectedTemplateId"
            class="admin-input"
            :disabled="loadingTemplates"
            @change="applyTemplate"
          >
            <option value="">{{ loadingTemplates ? 'Loading…' : 'Select a template…' }}</option>
            <option v-for="t in replyTemplates" :key="t.id" :value="t.id">{{ t.title }}</option>
          </select>
        </div>
        <textarea
          v-model="resolveNote"
          rows="3"
          class="admin-input resize-none"
          placeholder="Public reason shown to the user (optional)…"
        />
        <p v-if="!resolveNote.trim()" class="mt-1 text-xs text-admin-muted">
          Optional — a generic notice is posted when left empty.
        </p>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="resolveOpen = false">Cancel</button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting"
          @click="submitResolve"
        >
          Confirm
        </button>
      </template>
    </BaseDialog>

    <BaseDialog :open="assignOpen" title="Hand off ticket" @close="assignOpen = false">
      <template #body>
        <div class="space-y-2">
          <label class="text-xs text-admin-subtext">Assign to CSA</label>
          <select v-model="assignAdminId" class="admin-input" :disabled="loadingCsas">
            <option value="">{{ loadingCsas ? 'Loading CSAs…' : 'Select…' }}</option>
            <option v-for="c in assignChoices" :key="c.id" :value="c.id">{{ csaLabel(c) }}</option>
          </select>
          <p v-if="!loadingCsas && assignChoices.length === 0" class="text-xs text-admin-muted">
            No other active CSAs to hand off to.
          </p>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="assignOpen = false">Cancel</button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting || loadingCsas || !assignAdminId"
          @click="submitAssign"
        >
          Assign
        </button>
      </template>
    </BaseDialog>
  </div>
</template>
