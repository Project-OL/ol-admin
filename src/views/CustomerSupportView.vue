<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { format } from 'date-fns'
import { useRoute, useRouter } from 'vue-router'
import { customerSupportApi } from '@/api/customerSupport'
import { useAuthStore } from '@/stores/auth'
import { useSupportNotificationsStore } from '@/stores/supportNotifications'
import type {
  AdminStatus,
  CsaAdmin,
  CsaOverview,
  CsaPerformance,
  FailedLoginAttempt,
  ReportReason,
  ReportStatus,
  SupportReport,
  SupportTicketListItem,
  SupportTicketPriority,
  SupportTicketStage,
  SupportTicketStatus,
} from '@/types/customerSupport'
import { REPORT_REASON_OPTIONS } from '@/types/customerSupport'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'
import AssignCsaViewsDialog from '@/components/support/AssignCsaViewsDialog.vue'
import CsaIpWhitelistDialog from '@/components/support/CsaIpWhitelistDialog.vue'
import ResetPasswordDialog from '@/components/shared/ResetPasswordDialog.vue'
import TemporaryPasswordDialog from '@/components/shared/TemporaryPasswordDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import { adminAuthApi } from '@/api/adminAuth'
import { formatNumber } from '@/utils/format'
import { ticketCategoryBreadcrumb, ticketOpeningPreview, resolveInitialSubmission } from '@/utils/supportTicket'
import { showToast } from '@/utils/toast'
import axios from 'axios'
import { useLiveModerationActions } from '@/composables/useLiveModerationActions'
import { useCsaDirectory } from '@/composables/useCsaDirectory'

const router = useRouter()
const route = useRoute()
const moderation = useLiveModerationActions()
const auth = useAuthStore()
const notifStore = useSupportNotificationsStore()

const isSuperAdmin = computed(() => auth.isSuperAdmin)
const isModeratorOnly = computed(() => auth.role === 'MODERATOR')
const canWorkTickets = computed(() => auth.isSuperAdmin || auth.isCustomerSupport)
const defaultTab = computed(() => {
  if (isSuperAdmin.value) return 'agents' as const
  if (isModeratorOnly.value) return 'reports' as const
  return 'tickets' as const
})
const tab = ref<'agents' | 'tickets' | 'reports'>(defaultTab.value)

watch(
  () => auth.role,
  () => {
    if (!isSuperAdmin.value && tab.value === 'agents') {
      tab.value = isModeratorOnly.value ? 'reports' : 'tickets'
    }
    if (isModeratorOnly.value && tab.value === 'tickets') tab.value = 'reports'
  },
)

// --- Agents (SUPER_ADMIN) ---
const overview = ref<CsaOverview | null>(null)
const csas = ref<CsaAdmin[]>([])
const csasTotal = ref(0)
const csasPage = ref(1)
const loadingCsas = ref(false)
const csaFilters = reactive({
  status: '' as '' | AdminStatus,
  country: '',
  search: '',
})
const createCsaOpen = ref(false)
const editCsa = ref<CsaAdmin | null>(null)
const viewsCsa = ref<CsaAdmin | null>(null)
const acting = ref(false)
const passwordTarget = ref<CsaAdmin | null>(null)
const showSetPassword = ref(false)
const autoResetOpen = ref(false)
const autoResetting = ref(false)
const settingPassword = ref(false)
const tempPassword = ref('')
const showTempPassword = ref(false)
const pendingSelfLogout = ref(false)
const failedLoginsOpen = ref(false)
const failedLoginsTab = ref<'attempts' | 'accounts'>('attempts')
const failedLogins = ref<CsaAdmin[]>([])
const failedLoginsTotal = ref(0)
const failedLoginsPage = ref(1)
const loadingFailedLogins = ref(false)
const failedLoginHours = ref(24)
const failedAttempts = ref<FailedLoginAttempt[]>([])
const failedAttemptsTotal = ref(0)
const failedAttemptsPage = ref(1)
const loadingFailedAttempts = ref(false)
const csaTicketsOpen = ref(false)
const csaTicketsTarget = ref<CsaAdmin | null>(null)
const csaTickets = ref<SupportTicketListItem[]>([])
const csaTicketsPage = ref(1)
const csaTicketsTotal = ref(0)
const csaTicketsAvg = ref<number | null>(null)
const csaTicketsRatingCount = ref(0)
const loadingCsaTickets = ref(false)
const csaTicketsRatedOnly = ref(false)
const csaForm = reactive({
  name: '',
  username: '',
  email: '',
  password: '',
  phone: '',
  phoneCountryCode: '+91',
  gender: '' as '' | 'male' | 'female' | 'other',
  country: '',
  allowedIps: [] as string[],
})
const csaFormErrors = reactive({
  name: '',
  username: '',
  email: '',
  password: '',
  phone: '',
  phoneCountryCode: '',
  country: '',
  allowedIps: '',
})
const createIpDraft = ref('')
const ipWhitelistCsa = ref<CsaAdmin | null>(null)

// --- Tickets ---
const tickets = ref<SupportTicketListItem[]>([])
const ticketsTotal = ref(0)
const ticketsPage = ref(1)
const loadingTickets = ref(false)
const myStats = ref<CsaPerformance | null>(null)
const ticketQueue = ref<'me' | 'unassigned' | 'all' | 'csa'>('me')
const ticketAssignedCsaId = ref('')
const {
  csas: csaDirectory,
  loading: loadingCsaDirectory,
  load: loadCsaDirectory,
  csaLabel,
} = useCsaDirectory()
const ticketFilters = reactive({
  status: '' as '' | SupportTicketStatus,
  priority: '' as '' | SupportTicketPriority,
  /** '' | 'min:N' | 'max:N' — days since CSA resolve/reject (resolvedAt). */
  reviewAge: '',
})

// --- Reports ---
const reports = ref<SupportReport[]>([])
const reportsTotal = ref(0)
const reportsPage = ref(1)
const loadingReports = ref(false)
const reportFilters = reactive({
  status: 'PENDING' as '' | ReportStatus,
  context: '' as '' | 'CHAT' | 'LIVE',
  reason: '' as '' | ReportReason,
  reportedUserId: '',
})
const selectedReport = ref<SupportReport | null>(null)
const reportNote = ref('')
const reportActing = ref(false)

// --- Column sorting (client-side, current page only) ---
const PRIORITY_RANK: Record<string, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 }

const {
  sortKey: csaSortKey,
  sortDir: csaSortDir,
  sortedRows: sortedCsas,
  toggleSort: toggleCsaSort,
} = useSortableRows(csas, (csa, key) => {
  switch (key) {
    case 'name':
      return csa.name?.toLowerCase() ?? ''
    case 'email':
      return csa.email?.toLowerCase() ?? ''
    case 'country':
      return csa.country?.toLowerCase() ?? ''
    case 'openTicketCount':
      return csa.openTicketCount ?? 0
    case 'closedTicketCount':
      return csa.closedTicketCount ?? 0
    case 'avgRating':
      return csa.avgRating ?? -1
    case 'status':
      return csa.status ?? ''
    case 'lastLoginAt':
      return csa.lastLoginAt ? new Date(csa.lastLoginAt).getTime() : 0
    default:
      return undefined
  }
})

const {
  sortKey: ticketSortKey,
  sortDir: ticketSortDir,
  sortedRows: sortedTickets,
  toggleSort: toggleTicketSort,
} = useSortableRows(tickets, (t, key) => {
  switch (key) {
    case 'publicId':
      return t.publicId ?? t.id
    case 'user':
      return (t.user?.name || t.user?.username || '').toLowerCase()
    case 'priority':
      return PRIORITY_RANK[t.priority] ?? -1
    case 'stage':
      return t.stage ?? ''
    case 'rating':
      return t.rating ?? -1
    case 'daysSinceReviewed':
      return t.daysSinceReviewed ?? -1
    case 'updatedAt':
      return t.updatedAt ? new Date(t.updatedAt).getTime() : 0
    default:
      return undefined
  }
})

const {
  sortKey: reportSortKey,
  sortDir: reportSortDir,
  sortedRows: sortedReports,
  toggleSort: toggleReportSort,
} = useSortableRows(reports, (r, key) => {
  switch (key) {
    case 'id':
      return r.id
    case 'reporter':
      return (r.reporter?.name || r.reporter?.username || '').toLowerCase()
    case 'reported':
      return (r.reportedUser?.name || r.reportedUser?.username || '').toLowerCase()
    case 'host':
      return (r.hostUser?.name || r.hostUser?.username || '').toLowerCase()
    case 'reason':
      return r.reason ?? ''
    case 'status':
      return r.status ?? ''
    case 'createdAt':
      return r.createdAt ? new Date(r.createdAt).getTime() : 0
    default:
      return undefined
  }
})

function resetCsaForm() {
  csaForm.name = ''
  csaForm.username = ''
  csaForm.email = ''
  csaForm.password = ''
  csaForm.phone = ''
  csaForm.phoneCountryCode = '+91'
  csaForm.gender = ''
  csaForm.country = ''
  csaForm.allowedIps = []
  createIpDraft.value = ''
  Object.keys(csaFormErrors).forEach((k) => {
    csaFormErrors[k as keyof typeof csaFormErrors] = ''
  })
}

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/
const IPV6_RE = /^[0-9a-fA-F:.]{2,45}$/

function isValidIpAddress(raw: string) {
  const ip = raw.trim()
  if (!ip) return false
  if (IPV4_RE.test(ip)) return true
  return ip.includes(':') && IPV6_RE.test(ip)
}

function addCreateIpChip() {
  const ip = createIpDraft.value.trim()
  csaFormErrors.allowedIps = ''
  if (!ip) return
  if (!isValidIpAddress(ip)) {
    csaFormErrors.allowedIps = 'Enter a valid IPv4 or IPv6 address'
    return
  }
  if (csaForm.allowedIps.includes(ip)) {
    csaFormErrors.allowedIps = 'IP already added'
    return
  }
  if (csaForm.allowedIps.length >= 20) {
    csaFormErrors.allowedIps = 'Maximum 20 IPs'
    return
  }
  csaForm.allowedIps.push(ip)
  createIpDraft.value = ''
}

function removeCreateIpChip(ip: string) {
  csaForm.allowedIps = csaForm.allowedIps.filter((x) => x !== ip)
}

function validateCsaForm(isEdit: boolean): boolean {
  Object.keys(csaFormErrors).forEach((k) => {
    csaFormErrors[k as keyof typeof csaFormErrors] = ''
  })
  let ok = true
  if (!csaForm.name.trim() || csaForm.name.trim().length < 2) {
    csaFormErrors.name = 'Name is required (min 2 chars)'
    ok = false
  }
  if (!csaForm.username.trim() || !/^[a-zA-Z0-9._-]{3,50}$/.test(csaForm.username.trim())) {
    csaFormErrors.username = 'Username: 3–50 chars, letters/digits/._-'
    ok = false
  }
  if (!isEdit) {
    if (!csaForm.email.trim() || !csaForm.email.includes('@')) {
      csaFormErrors.email = 'Valid email is required'
      ok = false
    }
    if (!csaForm.password || csaForm.password.length < 12) {
      csaFormErrors.password = 'Password must be at least 12 characters'
      ok = false
    }
  }
  if (!csaForm.phone.trim() || csaForm.phone.trim().length < 4) {
    csaFormErrors.phone = 'Phone is required'
    ok = false
  }
  if (!csaForm.phoneCountryCode.trim()) {
    csaFormErrors.phoneCountryCode = 'Country code is required'
    ok = false
  }
  if (!csaForm.country.trim() || csaForm.country.trim().length < 2) {
    csaFormErrors.country = 'Country is required (drives ticket routing)'
    ok = false
  }
  return ok
}

async function loadOverview() {
  if (!isSuperAdmin.value) return
  try {
    const { data } = await customerSupportApi.getCsaOverview()
    overview.value = data
  } catch {
    /* interceptor */
  }
}

async function loadCsas(page = 1) {
  if (!isSuperAdmin.value) return
  loadingCsas.value = true
  csasPage.value = page
  try {
    const { data } = await customerSupportApi.listCsas({
      page,
      limit: 20,
      status: csaFilters.status || undefined,
      country: csaFilters.country.trim() || undefined,
      search: csaFilters.search.trim() || undefined,
    })
    csas.value = data.csas ?? []
    csasTotal.value = data.total ?? 0
  } finally {
    loadingCsas.value = false
  }
}

function openCreateCsa() {
  resetCsaForm()
  createCsaOpen.value = true
}

function openAssignViews(csa: CsaAdmin) {
  viewsCsa.value = csa
}

function openEditCsa(csa: CsaAdmin) {
  editCsa.value = csa
  csaForm.name = csa.name
  csaForm.username = csa.username ?? ''
  csaForm.email = csa.email
  csaForm.password = ''
  csaForm.phone = csa.phone ?? ''
  csaForm.phoneCountryCode = csa.phoneCountryCode ?? '+91'
  csaForm.gender = (csa.gender as typeof csaForm.gender) || ''
  csaForm.country = csa.country ?? ''
  Object.keys(csaFormErrors).forEach((k) => {
    csaFormErrors[k as keyof typeof csaFormErrors] = ''
  })
}

async function submitCreateCsa() {
  if (!validateCsaForm(false)) {
    showToast('Fix validation errors', 'error')
    return
  }
  if (csaForm.allowedIps.length === 0) {
    const ok = confirm(
      'Without at least one IP, this agent cannot log in. Create anyway and add IPs later?',
    )
    if (!ok) return
  }
  acting.value = true
  try {
    const { data } = await customerSupportApi.createCsa({
      name: csaForm.name.trim(),
      username: csaForm.username.trim(),
      email: csaForm.email.trim(),
      password: csaForm.password,
      phone: csaForm.phone.trim(),
      phoneCountryCode: csaForm.phoneCountryCode.trim(),
      gender: csaForm.gender || undefined,
      country: csaForm.country.trim(),
      allowedIps: csaForm.allowedIps.length ? [...csaForm.allowedIps] : undefined,
    })
    showToast('Customer support agent created', 'success')
    createCsaOpen.value = false
    await Promise.all([loadCsas(1), loadOverview()])
    if (data.csa) {
      ipWhitelistCsa.value = data.csa
    }
  } catch {
    showToast('Failed to create CSA', 'error')
  } finally {
    acting.value = false
  }
}

async function submitEditCsa() {
  if (!editCsa.value) return
  if (!validateCsaForm(true)) {
    showToast('Fix validation errors', 'error')
    return
  }
  acting.value = true
  try {
    await customerSupportApi.updateCsa(editCsa.value.id, {
      name: csaForm.name.trim(),
      username: csaForm.username.trim(),
      phone: csaForm.phone.trim(),
      phoneCountryCode: csaForm.phoneCountryCode.trim(),
      gender: csaForm.gender || null,
      country: csaForm.country.trim(),
    })
    showToast('CSA updated', 'success')
    editCsa.value = null
    await loadCsas(csasPage.value)
  } catch {
    showToast('Failed to update CSA', 'error')
  } finally {
    acting.value = false
  }
}

async function setCsaStatus(csa: CsaAdmin, status: AdminStatus) {
  acting.value = true
  try {
    const { data } = await customerSupportApi.setCsaStatus(csa.id, status)
    const re = data.csa.reassignment
    if (re) {
      showToast(
        `Status → ${status}. Reassigned ${re.reassigned}, unassigned ${re.unassigned}`,
        re.unassigned > 0 ? 'error' : 'success',
      )
    } else {
      showToast(`CSA ${status.toLowerCase()}`, 'success')
    }
    await Promise.all([loadCsas(csasPage.value), loadOverview()])
  } finally {
    acting.value = false
  }
}

function openSetPassword(csa: CsaAdmin) {
  passwordTarget.value = csa
  showSetPassword.value = true
}

function openAutoReset(csa: CsaAdmin) {
  passwordTarget.value = csa
  autoResetOpen.value = true
}

async function afterAdminPasswordReset(adminId: string, temporary?: string) {
  const isSelf = auth.admin?.id === adminId
  if (temporary) {
    tempPassword.value = temporary
    showTempPassword.value = true
    if (isSelf) pendingSelfLogout.value = true
    return
  }
  showToast('Password updated; sessions revoked', 'success')
  if (isSelf) {
    showToast('Your sessions were revoked — sign in again', 'error')
    await auth.logout()
    await router.push({ name: 'login' })
  }
}

async function handleSetCsaPassword(password: string) {
  const csa = passwordTarget.value
  if (!csa || settingPassword.value) return
  settingPassword.value = true
  try {
    await adminAuthApi.resetAdminPassword(csa.id, password)
    showSetPassword.value = false
    passwordTarget.value = null
    await afterAdminPasswordReset(csa.id)
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'WEAK_PASSWORD') {
        showToast('Password does not meet strength requirements', 'error')
        return
      }
      if (code === 'ADMIN_FORBIDDEN') {
        showToast('Only SUPER_ADMIN can reset admin passwords', 'error')
        return
      }
      if (code === 'ADMIN_NOT_FOUND') {
        showToast('Admin not found', 'error')
        return
      }
    }
    showToast('Failed to reset password', 'error')
  } finally {
    settingPassword.value = false
  }
}

async function handleAutoResetCsaPassword() {
  const csa = passwordTarget.value
  if (!csa || autoResetting.value) return
  autoResetting.value = true
  try {
    const { data } = await adminAuthApi.resetAdminPassword(csa.id)
    autoResetOpen.value = false
    passwordTarget.value = null
    await afterAdminPasswordReset(csa.id, data.temporaryPassword)
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as { code?: string } | undefined)?.code
      if (code === 'ADMIN_FORBIDDEN') {
        showToast('Only SUPER_ADMIN can reset admin passwords', 'error')
        return
      }
      if (code === 'ADMIN_NOT_FOUND') {
        showToast('Admin not found', 'error')
        return
      }
    }
    showToast('Failed to reset password', 'error')
  } finally {
    autoResetting.value = false
  }
}

async function closeTempPassword() {
  showTempPassword.value = false
  tempPassword.value = ''
  if (pendingSelfLogout.value) {
    pendingSelfLogout.value = false
    showToast('Your sessions were revoked — sign in again', 'error')
    await auth.logout()
    await router.push({ name: 'login' })
  }
}

async function exportCsas() {
  try {
    const csv = await customerSupportApi.exportCsasCsv(csaFilters.status || undefined)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `csa-export-${csaFilters.status || 'all'}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Export downloaded', 'success')
  } catch {
    showToast('Export failed', 'error')
  }
}

async function loadMyStats() {
  try {
    const { data } = await customerSupportApi.myStats()
    myStats.value = data.stats
  } catch {
    /* CSA-only; SA may still call */
  }
}

function parseReviewAgeFilter(reviewAge: string): {
  minDaysSinceReviewed?: number
  maxDaysSinceReviewed?: number
} {
  if (!reviewAge) return {}
  const [kind, raw] = reviewAge.split(':')
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return {}
  if (kind === 'min') return { minDaysSinceReviewed: n }
  if (kind === 'max') return { maxDaysSinceReviewed: n }
  return {}
}

function formatAvgRating(avg: number | null | undefined, count?: number) {
  if (avg == null) return '—'
  const base = avg.toFixed(1)
  return count != null && count > 0 ? `${base} (${count})` : base
}

function formatDaysSinceReviewed(days: number | null | undefined) {
  if (days == null) return '—'
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

async function loadTickets(page = 1) {
  loadingTickets.value = true
  ticketsPage.value = page
  try {
    let assignedTo: string
    if (isSuperAdmin.value && ticketQueue.value === 'csa') {
      assignedTo = ticketAssignedCsaId.value || 'me'
    } else if (isSuperAdmin.value) {
      assignedTo = ticketQueue.value
    } else {
      assignedTo = ticketQueue.value === 'all' ? 'me' : ticketQueue.value
    }
    const reviewAge = parseReviewAgeFilter(ticketFilters.reviewAge)
    const { data } = await customerSupportApi.listTickets({
      page,
      limit: 20,
      assignedTo,
      status: ticketFilters.status || undefined,
      priority: ticketFilters.priority || undefined,
      ...reviewAge,
    })
    tickets.value = data.tickets ?? []
    ticketsTotal.value = data.pagination?.total ?? 0
  } finally {
    loadingTickets.value = false
  }
}

function csaIsLocked(csa: CsaAdmin) {
  if (typeof csa.isLocked === 'boolean') return csa.isLocked
  if (!csa.lockedUntil) return false
  return new Date(csa.lockedUntil).getTime() > Date.now()
}

function failedAttemptReasonLabel(reason: FailedLoginAttempt['reason']) {
  if (reason === 'ACCOUNT_LOCKED') return 'Account locked'
  if (reason === 'ADMIN_IP_FORBIDDEN') return 'IP not allowed'
  return 'Wrong password'
}

function csaFailWindowCount(csa: CsaAdmin) {
  return csa.failedAttemptCount24h ?? csa.failedAttemptCount ?? 0
}

async function loadFailedLogins(page = 1) {
  loadingFailedLogins.value = true
  failedLoginsPage.value = page
  try {
    const { data } = await customerSupportApi.listFailedLogins({
      withinHours: failedLoginHours.value,
      includeLocked: true,
      page,
      limit: 50,
    })
    failedLogins.value = data.accounts ?? []
    failedLoginsTotal.value = data.total ?? failedLogins.value.length
  } catch {
    failedLogins.value = []
    failedLoginsTotal.value = 0
    showToast('Failed to load failed-login roster', 'error')
  } finally {
    loadingFailedLogins.value = false
  }
}

async function loadFailedLoginAttempts(page = 1) {
  loadingFailedAttempts.value = true
  failedAttemptsPage.value = page
  try {
    const { data } = await customerSupportApi.listFailedLoginAttempts({
      withinHours: failedLoginHours.value,
      page,
      limit: 50,
    })
    failedAttempts.value = data.attempts ?? []
    failedAttemptsTotal.value = data.total ?? failedAttempts.value.length
  } catch {
    failedAttempts.value = []
    failedAttemptsTotal.value = 0
    showToast('Failed to load failed-login attempts', 'error')
  } finally {
    loadingFailedAttempts.value = false
  }
}

function openFailedLogins() {
  failedLoginsOpen.value = true
  failedLoginsTab.value = 'attempts'
  void loadFailedLoginAttempts(1)
  void loadFailedLogins(1)
}

async function openCsaTickets(csa: CsaAdmin) {
  csaTicketsTarget.value = csa
  csaTicketsRatedOnly.value = false
  csaTicketsOpen.value = true
  await loadCsaTickets(1)
}

async function loadCsaTickets(page = 1) {
  const csa = csaTicketsTarget.value
  if (!csa) return
  loadingCsaTickets.value = true
  csaTicketsPage.value = page
  try {
    const { data } = await customerSupportApi.listCsaTickets(csa.id, {
      page,
      limit: 20,
      ratedOnly: csaTicketsRatedOnly.value || undefined,
    })
    csaTickets.value = data.tickets ?? []
    csaTicketsTotal.value = data.pagination?.total ?? csaTickets.value.length
    csaTicketsAvg.value = data.avgRating
    csaTicketsRatingCount.value = data.ratingCount ?? 0
  } catch {
    csaTickets.value = []
    csaTicketsTotal.value = 0
    showToast('Failed to load CSA tickets', 'error')
  } finally {
    loadingCsaTickets.value = false
  }
}

function stageLabel(stage: SupportTicketStage) {
  const map: Record<SupportTicketStage, string> = {
    open: 'Open',
    assigned: 'In progress',
    pending_review: 'Pending review',
    closed: 'Closed',
  }
  return map[stage] ?? stage
}

function stageTone(stage: SupportTicketStage): 'active' | 'inactive' | 'warn' {
  if (stage === 'closed') return 'inactive'
  if (stage === 'pending_review') return 'warn'
  return 'active'
}

function priorityClass(p: SupportTicketPriority) {
  if (p === 'URGENT') return 'text-admin-danger'
  if (p === 'HIGH') return 'text-amber-400'
  return 'text-admin-subtext'
}

function ticketThumb(t: SupportTicketListItem) {
  return resolveInitialSubmission(t)?.imageUrl ?? null
}

function openTicket(ticket: SupportTicketListItem) {
  router.push('/admin/support/tickets/' + ticket.id)
}

async function claimTicket(ticket: SupportTicketListItem, event: Event) {
  event.stopPropagation()
  try {
    await customerSupportApi.claim(ticket.id)
    showToast('Ticket claimed', 'success')
    await loadTickets(ticketsPage.value)
  } catch {
    showToast('Could not claim ticket', 'error')
  }
}

async function loadReports(page = 1) {
  loadingReports.value = true
  reportsPage.value = page
  try {
    const { data } = await customerSupportApi.listReports({
      page,
      limit: 20,
      status: reportFilters.status || undefined,
      context: reportFilters.context || undefined,
      reason: reportFilters.reason || undefined,
      reportedUserId: reportFilters.reportedUserId.trim() || undefined,
    })
    reports.value = data.reports ?? []
    reportsTotal.value = data.pagination?.total ?? data.total ?? reports.value.length
  } finally {
    loadingReports.value = false
  }
}

async function openReport(report: SupportReport) {
  try {
    const { data } = await customerSupportApi.getReport(report.id)
    selectedReport.value = data.report
    reportNote.value = ''
  } catch {
    selectedReport.value = report
  }
}

async function reviewReport(status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED') {
  if (!selectedReport.value) return
  reportActing.value = true
  try {
    await customerSupportApi.reviewReport(selectedReport.value.id, {
      status,
      resolutionNote: reportNote.value.trim() || undefined,
    })
    showToast('Report updated', 'success')
    selectedReport.value = null
    await loadReports(reportsPage.value)
  } catch {
    showToast('Failed to update report', 'error')
  } finally {
    reportActing.value = false
  }
}

async function escalateReport() {
  if (!selectedReport.value) return
  reportActing.value = true
  try {
    const { data } = await customerSupportApi.escalateReport(selectedReport.value.id)
    showToast('Escalated to ticket ' + (data.ticket.publicId ?? data.ticket.id), 'success')
    selectedReport.value = null
    await loadReports(reportsPage.value)
    if (data.ticket.id) router.push('/admin/support/tickets/' + data.ticket.id)
  } catch {
    showToast('Escalate failed', 'error')
  } finally {
    reportActing.value = false
  }
}

watch(tab, (t) => {
  if (t === 'agents') void Promise.all([loadOverview(), loadCsas()])
  if (t === 'tickets') {
    void Promise.all([
      loadTickets(),
      loadMyStats(),
      isSuperAdmin.value ? loadCsaDirectory() : Promise.resolve(),
    ])
  }
  if (t === 'reports') void loadReports()
})

watch(
  () => [notifStore.badge.myAwaitingReply, notifStore.badge.unreadCount] as const,
  () => {
    if (tab.value === 'tickets') void loadTickets(ticketsPage.value)
  },
)

onMounted(() => {
  const q = route.query
  if (q.tab === 'reports' || q.tab === 'tickets' || q.tab === 'agents') {
    tab.value = q.tab
  } else {
    tab.value = defaultTab.value
  }
  if (typeof q.reportedUserId === 'string') reportFilters.reportedUserId = q.reportedUserId
  if (typeof q.reason === 'string') reportFilters.reason = q.reason as ReportReason
  if (typeof q.status === 'string') reportFilters.status = q.status as ReportStatus
  if (typeof q.context === 'string') reportFilters.context = q.context as 'CHAT' | 'LIVE' | ''
  if (tab.value === 'agents') void Promise.all([loadOverview(), loadCsas()])
  else if (tab.value === 'tickets') {
    void Promise.all([
      loadTickets(),
      loadMyStats(),
      isSuperAdmin.value ? loadCsaDirectory() : Promise.resolve(),
    ])
  }
  else void loadReports()
  if (typeof q.reportId === 'string' && q.reportId) {
    void openReport({ id: q.reportId } as SupportReport)
  }
})
</script>

<template>
  <div class="admin-page">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Customer Support</h1>
      <p class="mt-1 text-sm text-admin-subtext">
        {{
          isSuperAdmin
            ? 'Manage CSA agents, tickets, and user reports'
            : 'Ticket workbench and report review'
        }}
      </p>
    </div>

    <div class="admin-card">
      <div class="mb-4 flex flex-col gap-3 border-b border-admin-border pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex w-full gap-1 rounded-lg bg-admin-bg p-1 sm:w-auto">
          <button
            v-if="isSuperAdmin"
            type="button"
            :class="[
              'min-w-0 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
              tab === 'agents' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="tab = 'agents'"
          >
            Agents
          </button>
          <button
            v-if="canWorkTickets"
            type="button"
            :class="[
              'min-w-0 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
              tab === 'tickets' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="tab = 'tickets'"
          >
            Tickets
            <span
              v-if="notifStore.badge.myAwaitingReply"
              class="ml-1 rounded-full bg-admin-danger px-1.5 text-[10px] text-white"
            >
              {{ notifStore.badge.myAwaitingReply }}
            </span>
          </button>
          <button
            type="button"
            :class="[
              'min-w-0 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
              tab === 'reports' ? 'bg-admin-accent text-white' : 'text-admin-subtext hover:text-admin-text',
            ]"
            @click="tab = 'reports'"
          >
            Reports
          </button>
        </div>
        <button
          v-if="tab === 'agents'"
          type="button"
          class="admin-btn-primary w-full text-sm sm:w-auto"
          @click="openCreateCsa"
        >
          Add CSA
        </button>
      </div>

      <!-- Agents -->
      <div v-show="tab === 'agents'" class="space-y-4">
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Total</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ formatNumber(overview?.totalCsa ?? 0) }}</p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Active</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-success">
              {{ formatNumber(overview?.activeCsa ?? 0) }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Online</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ formatNumber(overview?.onlineNow ?? 0) }}</p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Suspended</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-warn">
              {{ formatNumber(overview?.suspendedCsa ?? 0) }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Disabled</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ formatNumber(overview?.disabledCsa ?? 0) }}</p>
          </div>
          <button
            type="button"
            class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-left transition-colors hover:border-admin-accent/40"
            @click="openFailedLogins"
          >
            <p class="text-xs text-admin-subtext">Failed logins 24h</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">
              {{ formatNumber(overview?.failedLoginAttempts24h ?? 0) }}
            </p>
            <p class="mt-1 text-[10px] text-admin-accent">View log →</p>
          </button>
          <button
            type="button"
            class="rounded-md border border-admin-border bg-admin-bg/40 p-3 text-left transition-colors hover:border-admin-accent/40"
            @click="openFailedLogins"
          >
            <p class="text-xs text-admin-subtext">Locked</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-danger">
              {{ formatNumber(overview?.lockedAccounts ?? 0) }}
            </p>
            <p class="mt-1 text-[10px] text-admin-accent">View roster →</p>
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          <input
            v-model="csaFilters.search"
            class="admin-input min-w-0 w-full flex-1 sm:min-w-[160px]"
            placeholder="Search name, email, username…"
            @keydown.enter="loadCsas(1)"
          />
          <select v-model="csaFilters.status" class="admin-input w-auto" @change="loadCsas(1)">
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISABLED">Disabled</option>
          </select>
          <input
            v-model="csaFilters.country"
            class="admin-input w-36"
            placeholder="Country"
            @keydown.enter="loadCsas(1)"
          />
          <button type="button" class="admin-btn-primary" :disabled="loadingCsas" @click="loadCsas(1)">
            Search
          </button>
          <button type="button" class="admin-btn-secondary" @click="exportCsas">Export CSV</button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Agent" sort-key="name" :active-key="csaSortKey" :direction="csaSortDir" @sort="toggleCsaSort" />
                <SortableTh label="Contact" sort-key="email" :active-key="csaSortKey" :direction="csaSortDir" @sort="toggleCsaSort" />
                <SortableTh label="Country" sort-key="country" :active-key="csaSortKey" :direction="csaSortDir" @sort="toggleCsaSort" />
                <SortableTh label="Open" sort-key="openTicketCount" :active-key="csaSortKey" :direction="csaSortDir" @sort="toggleCsaSort" />
                <SortableTh label="Closed" sort-key="closedTicketCount" :active-key="csaSortKey" :direction="csaSortDir" @sort="toggleCsaSort" />
                <SortableTh label="Avg rating" sort-key="avgRating" :active-key="csaSortKey" :direction="csaSortDir" @sort="toggleCsaSort" />
                <SortableTh label="Status" sort-key="status" :active-key="csaSortKey" :direction="csaSortDir" @sort="toggleCsaSort" />
                <th>Login lock</th>
                <SortableTh label="Last login" sort-key="lastLoginAt" :active-key="csaSortKey" :direction="csaSortDir" @sort="toggleCsaSort" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="csa in sortedCsas" :key="csa.id">
                <td>
                  <div class="flex items-center gap-2">
                    <span
                      class="h-2 w-2 shrink-0 rounded-full"
                      :class="csa.isOnline ? 'bg-admin-success' : 'bg-admin-muted'"
                      :title="csa.isOnline ? 'Online' : 'Offline'"
                    />
                    <div>
                      <p class="font-medium">{{ csa.name }}</p>
                      <p class="font-mono text-xs text-admin-muted">@{{ csa.username }}</p>
                    </div>
                  </div>
                </td>
                <td class="text-sm">
                  <p>{{ csa.email }}</p>
                  <p class="text-xs text-admin-muted">
                    {{ csa.phoneCountryCode }} {{ csa.phone }}
                  </p>
                </td>
                <td class="text-sm">{{ csa.country ?? '—' }}</td>
                <td class="tabular-nums">{{ csa.openTicketCount ?? 0 }}</td>
                <td class="tabular-nums">{{ csa.closedTicketCount ?? 0 }}</td>
                <td class="text-xs tabular-nums">
                  <span v-if="csa.avgRating != null" class="text-amber-400">
                    ★ {{ formatAvgRating(csa.avgRating, csa.ratingCount) }}
                  </span>
                  <span v-else class="text-admin-muted">—</span>
                </td>
                <td>
                  <StatusBadge
                    :status="csa.status === 'ACTIVE' ? 'active' : 'inactive'"
                    :label="csa.status"
                  />
                </td>
                <td class="text-xs">
                  <template v-if="csaIsLocked(csa)">
                    <span class="rounded bg-admin-danger/15 px-1.5 py-0.5 font-medium text-admin-danger">
                      Locked
                    </span>
                    <p v-if="csa.lockedUntil" class="mt-1 text-admin-muted">
                      until {{ format(new Date(csa.lockedUntil), 'dd MMM HH:mm') }}
                    </p>
                  </template>
                  <template v-else-if="csaFailWindowCount(csa) > 0">
                    <span class="text-admin-warn">{{ csaFailWindowCount(csa) }} in 24h</span>
                    <p
                      v-if="(csa.failedLoginCount ?? 0) > 0"
                      class="mt-1 text-admin-muted"
                    >
                      {{ csa.failedLoginCount }} streak
                    </p>
                  </template>
                  <template v-else-if="(csa.failedLoginCount ?? 0) > 0">
                    <span class="text-admin-warn">{{ csa.failedLoginCount }} streak</span>
                  </template>
                  <span v-else class="text-admin-muted">—</span>
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ csa.lastLoginAt ? format(new Date(csa.lastLoginAt), 'dd MMM yyyy HH:mm') : '—' }}
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <button type="button" class="admin-btn-secondary py-1 text-xs" @click="openEditCsa(csa)">
                      Edit
                    </button>
                    <button
                      type="button"
                      class="admin-btn-secondary py-1 text-xs"
                      @click="openCsaTickets(csa)"
                    >
                      Tickets
                    </button>
                    <button
                      type="button"
                      class="admin-btn-secondary py-1 text-xs"
                      @click="ipWhitelistCsa = csa"
                    >
                      IPs
                    </button>
                    <button
                      type="button"
                      class="admin-btn-secondary py-1 text-xs"
                      @click="openAssignViews(csa)"
                    >
                      Views
                    </button>
                    <button
                      type="button"
                      class="admin-btn-secondary py-1 text-xs"
                      @click="openSetPassword(csa)"
                    >
                      Set password
                    </button>
                    <button
                      type="button"
                      class="admin-btn-secondary py-1 text-xs"
                      @click="openAutoReset(csa)"
                    >
                      Gen. password
                    </button>
                    <button
                      v-if="csa.status !== 'ACTIVE'"
                      type="button"
                      class="admin-btn-primary py-1 text-xs"
                      :disabled="acting"
                      @click="setCsaStatus(csa, 'ACTIVE')"
                    >
                      Enable
                    </button>
                    <button
                      v-if="csa.status === 'ACTIVE'"
                      type="button"
                      class="admin-btn-secondary py-1 text-xs"
                      :disabled="acting"
                      @click="setCsaStatus(csa, 'SUSPENDED')"
                    >
                      Suspend
                    </button>
                    <button
                      v-if="csa.status !== 'DISABLED'"
                      type="button"
                      class="admin-btn-danger py-1 text-xs"
                      :disabled="acting"
                      @click="setCsaStatus(csa, 'DISABLED')"
                    >
                      Disable
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!csas.length && !loadingCsas">
                <td colspan="10" class="py-10 text-center text-admin-muted">No CSA agents yet</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination">
          <span>{{ csasTotal }} total</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="csasPage <= 1"
              @click="loadCsas(csasPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="csasPage * 20 >= csasTotal"
              @click="loadCsas(csasPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Tickets -->
      <div v-show="tab === 'tickets'" class="space-y-4">
        <div v-if="myStats" class="admin-stats-grid">
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">My open</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ myStats.openTickets }}</p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Awaiting reply</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-amber-400">
              {{ notifStore.badge.myAwaitingReply }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Resolved</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-admin-success">
              {{ myStats.resolvedTotal }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Rejected</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ myStats.rejectedTotal }}</p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Avg rating</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">
              {{ myStats.avgRating != null ? myStats.avgRating.toFixed(1) : '—' }}
            </p>
          </div>
          <div class="rounded-md border border-admin-border bg-admin-bg/40 p-3">
            <p class="text-xs text-admin-subtext">Resolved 30d</p>
            <p class="mt-1 text-xl font-semibold tabular-nums">{{ myStats.resolved30d }}</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <div class="flex gap-1 rounded-lg bg-admin-bg p-1">
            <button
              type="button"
              :class="[
                'rounded-md px-3 py-1.5 text-xs font-medium',
                ticketQueue === 'me' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
              ]"
              @click="ticketQueue = 'me'; loadTickets(1)"
            >
              My queue
            </button>
            <button
              type="button"
              :class="[
                'rounded-md px-3 py-1.5 text-xs font-medium',
                ticketQueue === 'unassigned' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
              ]"
              @click="ticketQueue = 'unassigned'; loadTickets(1)"
            >
              Unassigned
            </button>
            <button
              v-if="isSuperAdmin"
              type="button"
              :class="[
                'rounded-md px-3 py-1.5 text-xs font-medium',
                ticketQueue === 'all' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
              ]"
              @click="ticketQueue = 'all'; loadTickets(1)"
            >
              All
            </button>
            <button
              v-if="isSuperAdmin"
              type="button"
              :class="[
                'rounded-md px-3 py-1.5 text-xs font-medium',
                ticketQueue === 'csa' ? 'bg-admin-accent text-white' : 'text-admin-subtext',
              ]"
              @click="ticketQueue = 'csa'; loadTickets(1)"
            >
              By CSA
            </button>
          </div>
          <select
            v-if="isSuperAdmin && ticketQueue === 'csa'"
            v-model="ticketAssignedCsaId"
            class="admin-input w-auto"
            :disabled="loadingCsaDirectory"
            @change="loadTickets(1)"
          >
            <option value="">{{ loadingCsaDirectory ? 'Loading CSAs…' : 'Select CSA…' }}</option>
            <option v-for="c in csaDirectory" :key="c.id" :value="c.id">{{ csaLabel(c) }}</option>
          </select>
          <select v-model="ticketFilters.status" class="admin-input w-auto" @change="loadTickets(1)">
            <option value="">All status</option>
            <option value="OPEN">OPEN</option>
            <option value="AWAITING_REPLY">AWAITING_REPLY</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="PENDING_REVIEW">PENDING_REVIEW</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <select v-model="ticketFilters.priority" class="admin-input w-auto" @change="loadTickets(1)">
            <option value="">All priority</option>
            <option value="URGENT">URGENT</option>
            <option value="HIGH">HIGH</option>
            <option value="NORMAL">NORMAL</option>
            <option value="LOW">LOW</option>
          </select>
          <select
            v-if="isSuperAdmin"
            v-model="ticketFilters.reviewAge"
            class="admin-input w-auto"
            title="Filter by days since CSA resolve/reject"
            @change="loadTickets(1)"
          >
            <option value="">Any review age</option>
            <option value="max:1">Reviewed within 1 day</option>
            <option value="max:3">Reviewed within 3 days</option>
            <option value="max:7">Reviewed within 7 days</option>
            <option value="min:7">Reviewed 7+ days ago</option>
            <option value="min:14">Reviewed 14+ days ago</option>
            <option value="min:30">Reviewed 30+ days ago</option>
          </select>
          <button type="button" class="admin-btn-primary" :disabled="loadingTickets" @click="loadTickets(1)">
            Refresh
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Ticket" sort-key="publicId" :active-key="ticketSortKey" :direction="ticketSortDir" @sort="toggleTicketSort" />
                <SortableTh label="User" sort-key="user" :active-key="ticketSortKey" :direction="ticketSortDir" @sort="toggleTicketSort" />
                <SortableTh label="Priority" sort-key="priority" :active-key="ticketSortKey" :direction="ticketSortDir" @sort="toggleTicketSort" />
                <SortableTh label="Stage" sort-key="stage" :active-key="ticketSortKey" :direction="ticketSortDir" @sort="toggleTicketSort" />
                <SortableTh label="Rating" sort-key="rating" :active-key="ticketSortKey" :direction="ticketSortDir" @sort="toggleTicketSort" />
                <SortableTh label="Since reviewed" sort-key="daysSinceReviewed" :active-key="ticketSortKey" :direction="ticketSortDir" @sort="toggleTicketSort" />
                <SortableTh label="Updated" sort-key="updatedAt" :active-key="ticketSortKey" :direction="ticketSortDir" @sort="toggleTicketSort" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in sortedTickets"
                :key="t.id"
                class="cursor-pointer hover:bg-admin-bg/50"
                @click="openTicket(t)"
              >
                <td>
                  <div class="flex items-start gap-2">
                    <img
                      v-if="ticketThumb(t)"
                      :src="ticketThumb(t) ?? ''"
                      alt=""
                      class="mt-0.5 h-9 w-9 shrink-0 rounded border border-admin-border object-cover"
                    />
                    <div class="min-w-0">
                      <p class="font-medium">{{ t.publicId ?? t.id }}</p>
                      <p class="text-xs text-admin-muted">{{ ticketCategoryBreadcrumb(t) }}</p>
                      <p
                        v-if="ticketOpeningPreview(t)"
                        class="mt-0.5 max-w-[280px] truncate text-xs text-admin-subtext"
                      >
                        {{ ticketOpeningPreview(t) }}
                      </p>
                      <p
                        v-else-if="t.messages?.[0]?.content"
                        class="mt-0.5 max-w-[280px] truncate text-xs text-admin-subtext"
                      >
                        {{ t.messages[0].content }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="text-sm">
                  <p>{{ t.user?.name || t.user?.username || '—' }}</p>
                  <p class="font-mono text-xs text-admin-muted">{{ t.user?.publicId ?? t.user?.id }}</p>
                </td>
                <td :class="['text-xs font-semibold', priorityClass(t.priority)]">{{ t.priority }}</td>
                <td>
                  <StatusBadge :status="stageTone(t.stage)" :label="stageLabel(t.stage)" />
                </td>
                <td class="text-xs tabular-nums">
                  <span v-if="t.rating != null" class="text-amber-400">★ {{ t.rating }}</span>
                  <span v-else class="text-admin-muted">—</span>
                </td>
                <td class="text-xs whitespace-nowrap text-admin-subtext">
                  {{ formatDaysSinceReviewed(t.daysSinceReviewed) }}
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ format(new Date(t.updatedAt), 'dd MMM HH:mm') }}
                </td>
                <td>
                  <button
                    v-if="ticketQueue === 'unassigned' && t.stage === 'open'"
                    type="button"
                    class="admin-btn-primary py-1 text-xs"
                    @click="claimTicket(t, $event)"
                  >
                    Claim
                  </button>
                  <button v-else type="button" class="admin-btn-secondary py-1 text-xs" @click.stop="openTicket(t)">
                    Open
                  </button>
                </td>
              </tr>
              <tr v-if="!tickets.length && !loadingTickets">
                <td colspan="8" class="py-10 text-center text-admin-muted">No tickets in this queue</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-pagination">
          <span>{{ ticketsTotal }} total</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="ticketsPage <= 1"
              @click="loadTickets(ticketsPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="ticketsPage * 20 >= ticketsTotal"
              @click="loadTickets(ticketsPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Reports -->
      <div v-show="tab === 'reports'" class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <select v-model="reportFilters.status" class="admin-input w-auto" @change="loadReports(1)">
            <option value="">All status</option>
            <option value="PENDING">PENDING</option>
            <option value="REVIEWED">REVIEWED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
          <select v-model="reportFilters.context" class="admin-input w-auto" @change="loadReports(1)">
            <option value="">All context</option>
            <option value="CHAT">CHAT</option>
            <option value="LIVE">LIVE</option>
          </select>
          <select v-model="reportFilters.reason" class="admin-input w-auto" @change="loadReports(1)">
            <option value="">All reasons</option>
            <option v-for="r in REPORT_REASON_OPTIONS" :key="r" :value="r">{{ r }}</option>
          </select>
          <input
            v-model="reportFilters.reportedUserId"
            class="admin-input w-56"
            placeholder="Reported user UUID"
            @keyup.enter="loadReports(1)"
          />
          <button type="button" class="admin-btn-primary" :disabled="loadingReports" @click="loadReports(1)">
            Refresh
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <SortableTh label="Report" sort-key="id" :active-key="reportSortKey" :direction="reportSortDir" @sort="toggleReportSort" />
                <SortableTh label="Reporter" sort-key="reporter" :active-key="reportSortKey" :direction="reportSortDir" @sort="toggleReportSort" />
                <SortableTh label="Reported" sort-key="reported" :active-key="reportSortKey" :direction="reportSortDir" @sort="toggleReportSort" />
                <SortableTh label="Host" sort-key="host" :active-key="reportSortKey" :direction="reportSortDir" @sort="toggleReportSort" />
                <SortableTh label="Reason" sort-key="reason" :active-key="reportSortKey" :direction="reportSortDir" @sort="toggleReportSort" />
                <SortableTh label="Status" sort-key="status" :active-key="reportSortKey" :direction="reportSortDir" @sort="toggleReportSort" />
                <SortableTh label="Created" sort-key="createdAt" :active-key="reportSortKey" :direction="reportSortDir" @sort="toggleReportSort" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in sortedReports"
                :key="r.id"
                class="cursor-pointer hover:bg-admin-bg/50"
                @click="openReport(r)"
              >
                <td>
                  <p class="font-mono text-xs">{{ r.id.slice(0, 8) }}…</p>
                  <p class="text-xs text-admin-muted">{{ r.context ?? '—' }}</p>
                </td>
                <td class="text-sm">{{ r.reporter?.name || r.reporter?.username || '—' }}</td>
                <td class="text-sm">{{ r.reportedUser?.name || r.reportedUser?.username || '—' }}</td>
                <td class="text-sm">{{ r.hostUser?.name || r.hostUser?.username || '—' }}</td>
                <td class="text-xs">{{ r.reason ?? '—' }}</td>
                <td>
                  <StatusBadge
                    :status="r.status === 'PENDING' ? 'warn' : r.status === 'RESOLVED' ? 'active' : 'inactive'"
                    :label="r.status"
                  />
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ format(new Date(r.createdAt), 'dd MMM yyyy') }}
                </td>
              </tr>
              <tr v-if="!reports.length && !loadingReports">
                <td colspan="7" class="py-10 text-center text-admin-muted">No reports</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <AssignCsaViewsDialog
      :open="!!viewsCsa"
      :csa="viewsCsa"
      @close="viewsCsa = null"
    />

    <CsaIpWhitelistDialog
      :open="!!ipWhitelistCsa"
      :csa="ipWhitelistCsa"
      @close="ipWhitelistCsa = null"
    />

    <!-- Create / Edit CSA -->
    <BaseDialog
      :open="createCsaOpen || !!editCsa"
      :title="editCsa ? 'Edit CSA' : 'Add Customer Support Agent'"
      size="lg"
      @close="createCsaOpen = false; editCsa = null"
    >
      <template #body>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Name *</label>
            <input v-model="csaForm.name" class="admin-input" />
            <p v-if="csaFormErrors.name" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.name }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Username *</label>
            <input v-model="csaForm.username" class="admin-input font-mono" />
            <p v-if="csaFormErrors.username" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.username }}</p>
          </div>
          <div v-if="!editCsa">
            <label class="mb-1 block text-xs text-admin-subtext">Email *</label>
            <input v-model="csaForm.email" type="email" class="admin-input" />
            <p v-if="csaFormErrors.email" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.email }}</p>
          </div>
          <div v-if="!editCsa">
            <label class="mb-1 block text-xs text-admin-subtext">Password * (min 12)</label>
            <input v-model="csaForm.password" type="password" class="admin-input" />
            <p v-if="csaFormErrors.password" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.password }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Phone country code *</label>
            <input v-model="csaForm.phoneCountryCode" class="admin-input" placeholder="+91" />
            <p v-if="csaFormErrors.phoneCountryCode" class="mt-1 text-xs text-admin-danger">
              {{ csaFormErrors.phoneCountryCode }}
            </p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Phone *</label>
            <input v-model="csaForm.phone" class="admin-input" />
            <p v-if="csaFormErrors.phone" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.phone }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Gender</label>
            <select v-model="csaForm.gender" class="admin-input">
              <option value="">—</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Country * (routing)</label>
            <input v-model="csaForm.country" class="admin-input" placeholder="India" />
            <p v-if="csaFormErrors.country" class="mt-1 text-xs text-admin-danger">{{ csaFormErrors.country }}</p>
          </div>
        </div>

        <div v-if="!editCsa" class="mt-4 space-y-2 border-t border-admin-border pt-4">
          <label class="block text-xs font-medium text-admin-subtext">
            Allowed login IPs
            <span class="font-normal text-admin-muted">(exact IPv4/IPv6, max 20)</span>
          </label>
          <p class="text-xs text-admin-warn">
            Without at least one IP, this agent cannot log in.
          </p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              v-model="createIpDraft"
              type="text"
              class="admin-input min-w-0 flex-1 font-mono"
              placeholder="203.0.113.10"
              maxlength="45"
              @keydown.enter.prevent="addCreateIpChip"
            />
            <button type="button" class="admin-btn-secondary w-full sm:w-auto" @click="addCreateIpChip">
              Add IP
            </button>
          </div>
          <p v-if="csaFormErrors.allowedIps" class="text-xs text-admin-danger">
            {{ csaFormErrors.allowedIps }}
          </p>
          <div v-if="csaForm.allowedIps.length" class="flex flex-wrap gap-2">
            <span
              v-for="ip in csaForm.allowedIps"
              :key="ip"
              class="inline-flex items-center gap-1 rounded-md border border-admin-border bg-admin-bg/60 px-2 py-1 font-mono text-xs"
            >
              {{ ip }}
              <button
                type="button"
                class="text-admin-muted hover:text-admin-danger"
                aria-label="Remove IP"
                @click="removeCreateIpChip(ip)"
              >
                ×
              </button>
            </span>
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="createCsaOpen = false; editCsa = null">
          Cancel
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="acting"
          @click="editCsa ? submitEditCsa() : submitCreateCsa()"
        >
          {{ editCsa ? 'Save' : 'Create' }}
        </button>
      </template>
    </BaseDialog>

    <!-- Report detail -->
    <BaseDialog
      :open="!!selectedReport"
      title="Report review"
      size="lg"
      @close="selectedReport = null"
    >
      <template #body>
        <div v-if="selectedReport" class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs text-admin-subtext">Status</p>
              <p class="font-medium">{{ selectedReport.status }}</p>
            </div>
            <div>
              <p class="text-xs text-admin-subtext">Context / Reason</p>
              <p class="font-medium">{{ selectedReport.context ?? '—' }} · {{ selectedReport.reason ?? '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-admin-subtext">Reporter</p>
              <p>{{ selectedReport.reporter?.name || selectedReport.reporter?.username || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-admin-subtext">Reported user</p>
              <p>{{ selectedReport.reportedUser?.name || selectedReport.reportedUser?.username || '—' }}</p>
            </div>
          </div>
          <p v-if="selectedReport.details" class="rounded border border-admin-border bg-admin-bg/40 p-3">
            {{ selectedReport.details }}
          </p>
          <div v-if="selectedReport.liveSessionId" class="text-xs text-admin-muted">
            Live session: {{ selectedReport.liveSessionId }}
            <span v-if="selectedReport.hostUserId"> · Host: {{ selectedReport.hostUserId }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="selectedReport.reportedUser?.id"
              type="button"
              class="admin-btn-secondary py-1 text-xs"
              @click="moderation.applyMute({ userId: selectedReport.reportedUser.id, type: 'LIVE_CHAT_MUTE', reportId: selectedReport.id })"
            >
              Mute chat
            </button>
            <button
              v-if="selectedReport.reportedUser?.id"
              type="button"
              class="admin-btn-secondary py-1 text-xs"
              @click="moderation.applyMute({ userId: selectedReport.reportedUser.id, type: 'LIVE_AUDIO_MUTE', reportId: selectedReport.id })"
            >
              Mute audio
            </button>
            <button
              v-if="selectedReport.reportedUser?.id"
              type="button"
              class="admin-btn-secondary py-1 text-xs"
              @click="moderation.applyMute({ userId: selectedReport.reportedUser.id, type: 'LIVE_STREAM_START_BAN', reportId: selectedReport.id })"
            >
              Ban going live
            </button>
            <button
              v-if="selectedReport.liveSessionId"
              type="button"
              class="admin-btn-secondary py-1 text-xs"
              @click="moderation.stopLive(selectedReport.liveSessionId, 'Closed from report review')"
            >
              Close live
            </button>
          </div>
          <div v-if="selectedReport.evidenceUrls?.length" class="flex flex-wrap gap-2">
            <a
              v-for="(url, i) in selectedReport.evidenceUrls"
              :key="i"
              :href="url"
              target="_blank"
              rel="noopener"
              class="text-xs text-admin-accent underline"
            >
              Evidence {{ i + 1 }}
            </a>
          </div>
          <div>
            <label class="mb-1 block text-xs text-admin-subtext">Resolution note</label>
            <textarea v-model="reportNote" rows="3" class="admin-input resize-none" />
          </div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="selectedReport = null">Close</button>
        <button
          v-if="selectedReport?.status === 'PENDING' && (auth.isSuperAdmin || auth.isCustomerSupport)"
          type="button"
          class="admin-btn-secondary"
          :disabled="reportActing"
          @click="escalateReport"
        >
          Escalate to ticket
        </button>
        <button
          type="button"
          class="admin-btn-secondary"
          :disabled="reportActing"
          @click="reviewReport('DISMISSED')"
        >
          Dismiss
        </button>
        <button
          type="button"
          class="admin-btn-primary"
          :disabled="reportActing"
          @click="reviewReport('RESOLVED')"
        >
          Resolve
        </button>
      </template>
    </BaseDialog>

    <ResetPasswordDialog
      :open="showSetPassword"
      :min-length="12"
      @close="showSetPassword = false; passwordTarget = null"
      @confirm="handleSetCsaPassword"
    />

    <ConfirmActionDialog
      :open="autoResetOpen"
      title="Generate temporary password"
      message="This logs the CSA out of the portal everywhere. A one-time password will be shown once for you to share out-of-band."
      confirm-label="Generate password"
      variant="warn"
      @close="autoResetOpen = false; passwordTarget = null"
      @confirm="handleAutoResetCsaPassword"
    />

    <TemporaryPasswordDialog
      :open="showTempPassword"
      :password="tempPassword"
      session-hint="All portal sessions for this admin have been revoked."
      @close="closeTempPassword"
    />

    <BaseDialog
      :open="failedLoginsOpen"
      title="Failed login attempts"
      size="lg"
      @close="failedLoginsOpen = false"
    >
      <template #body>
        <p class="mb-3 text-xs text-admin-muted">
          Each failed CSA login is kept even after a later successful login. The lockout streak still resets on success.
        </p>
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <div class="flex gap-1">
            <button
              type="button"
              class="admin-btn-secondary py-1 text-xs"
              :class="failedLoginsTab === 'attempts' ? 'border-admin-accent text-admin-accent' : ''"
              @click="failedLoginsTab = 'attempts'"
            >
              Attempt log
            </button>
            <button
              type="button"
              class="admin-btn-secondary py-1 text-xs"
              :class="failedLoginsTab === 'accounts' ? 'border-admin-accent text-admin-accent' : ''"
              @click="failedLoginsTab = 'accounts'"
            >
              Accounts
            </button>
          </div>
          <label class="text-xs text-admin-subtext">Within hours</label>
          <select
            v-model.number="failedLoginHours"
            class="admin-input w-auto py-1 text-xs"
            @change="loadFailedLoginAttempts(1); loadFailedLogins(1)"
          >
            <option :value="6">6h</option>
            <option :value="24">24h</option>
            <option :value="72">72h</option>
          </select>
          <button
            type="button"
            class="admin-btn-secondary py-1 text-xs"
            :disabled="loadingFailedLogins || loadingFailedAttempts"
            @click="loadFailedLoginAttempts(failedAttemptsPage); loadFailedLogins(failedLoginsPage)"
          >
            Refresh
          </button>
        </div>

        <template v-if="failedLoginsTab === 'attempts'">
          <div class="admin-table-wrap max-h-[50vh] overflow-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>CSA</th>
                  <th>Reason</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in failedAttempts" :key="row.id">
                  <td class="whitespace-nowrap text-xs tabular-nums">
                    {{ format(new Date(row.createdAt), 'dd MMM yyyy HH:mm') }}
                  </td>
                  <td>
                    <p class="font-medium">{{ row.name }}</p>
                    <p class="text-xs text-admin-muted">{{ row.email }}</p>
                  </td>
                  <td class="text-sm">{{ failedAttemptReasonLabel(row.reason) }}</td>
                  <td class="text-xs tabular-nums">{{ row.ipAddress ?? '—' }}</td>
                </tr>
                <tr v-if="!failedAttempts.length && !loadingFailedAttempts">
                  <td colspan="4" class="py-8 text-center text-admin-muted">No failed-login attempts</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-pagination mt-3">
            <span class="text-xs">{{ failedAttemptsTotal }} total</span>
            <div class="flex gap-2">
              <button
                type="button"
                class="admin-btn-secondary text-xs"
                :disabled="failedAttemptsPage <= 1"
                @click="loadFailedLoginAttempts(failedAttemptsPage - 1)"
              >
                Previous
              </button>
              <button
                type="button"
                class="admin-btn-secondary text-xs"
                :disabled="failedAttemptsPage * 50 >= failedAttemptsTotal"
                @click="loadFailedLoginAttempts(failedAttemptsPage + 1)"
              >
                Next
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="admin-table-wrap max-h-[50vh] overflow-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>CSA</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Lock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="csa in failedLogins" :key="csa.id">
                  <td>
                    <p class="font-medium">{{ csa.name }}</p>
                    <p class="text-xs text-admin-muted">{{ csa.email }}</p>
                  </td>
                  <td>
                    <StatusBadge
                      :status="csa.status === 'ACTIVE' ? 'active' : 'inactive'"
                      :label="csa.status"
                    />
                  </td>
                  <td class="tabular-nums text-sm">
                    {{ csa.failedAttemptCount ?? csaFailWindowCount(csa) }}
                  </td>
                  <td class="text-xs">
                    <span v-if="csaIsLocked(csa)" class="text-admin-danger">
                      Locked
                      <template v-if="csa.lockedUntil">
                        until {{ format(new Date(csa.lockedUntil), 'dd MMM HH:mm') }}
                      </template>
                    </span>
                    <span v-else class="text-admin-muted">—</span>
                  </td>
                  <td>
                    <div class="flex flex-wrap gap-1">
                      <button
                        type="button"
                        class="admin-btn-secondary py-1 text-xs"
                        @click="openSetPassword(csa)"
                      >
                        Set password
                      </button>
                      <button
                        type="button"
                        class="admin-btn-secondary py-1 text-xs"
                        @click="openAutoReset(csa)"
                      >
                        Gen. password
                      </button>
                      <button
                        v-if="csa.status === 'ACTIVE'"
                        type="button"
                        class="admin-btn-secondary py-1 text-xs"
                        :disabled="acting"
                        @click="setCsaStatus(csa, 'SUSPENDED')"
                      >
                        Suspend
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!failedLogins.length && !loadingFailedLogins">
                  <td colspan="5" class="py-8 text-center text-admin-muted">No failed-login accounts</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-pagination mt-3">
            <span class="text-xs">{{ failedLoginsTotal }} total</span>
            <div class="flex gap-2">
              <button
                type="button"
                class="admin-btn-secondary text-xs"
                :disabled="failedLoginsPage <= 1"
                @click="loadFailedLogins(failedLoginsPage - 1)"
              >
                Previous
              </button>
              <button
                type="button"
                class="admin-btn-secondary text-xs"
                :disabled="failedLoginsPage * 50 >= failedLoginsTotal"
                @click="loadFailedLogins(failedLoginsPage + 1)"
              >
                Next
              </button>
            </div>
          </div>
        </template>
      </template>
      <template #footer>
        <button type="button" class="admin-btn-secondary" @click="failedLoginsOpen = false">Close</button>
      </template>
    </BaseDialog>

    <BaseDialog
      :open="csaTicketsOpen"
      :title="csaTicketsTarget ? `Tickets · ${csaTicketsTarget.name}` : 'CSA tickets'"
      size="lg"
      @close="csaTicketsOpen = false; csaTicketsTarget = null"
    >
      <template #body>
        <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <p>
            Avg rating:
            <strong class="tabular-nums">
              {{ csaTicketsAvg != null ? csaTicketsAvg.toFixed(1) : '—' }}
            </strong>
            <span class="text-admin-muted">({{ csaTicketsRatingCount }} ratings)</span>
          </p>
          <label class="flex items-center gap-1.5 text-xs text-admin-subtext">
            <input
              v-model="csaTicketsRatedOnly"
              type="checkbox"
              class="accent-admin-accent"
              @change="loadCsaTickets(1)"
            />
            Rated only
          </label>
          <button
            type="button"
            class="admin-btn-secondary py-1 text-xs"
            :disabled="loadingCsaTickets"
            @click="loadCsaTickets(csaTicketsPage)"
          >
            Refresh
          </button>
        </div>
        <div class="admin-table-wrap max-h-[50vh] overflow-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Stage</th>
                <th>Rating</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in csaTickets" :key="t.id">
                <td>
                  <p class="font-medium">{{ t.publicId ?? t.id }}</p>
                  <p class="text-xs text-admin-muted">{{ ticketCategoryBreadcrumb(t) }}</p>
                  <p class="text-xs text-admin-subtext">{{ t.user?.name || t.user?.username || '—' }}</p>
                </td>
                <td>
                  <StatusBadge :status="stageTone(t.stage)" :label="stageLabel(t.stage)" />
                </td>
                <td class="text-xs tabular-nums">
                  <span v-if="t.rating != null" class="text-amber-400">★ {{ t.rating }}</span>
                  <span v-else class="text-admin-muted">—</span>
                  <p v-if="t.ratedAt" class="text-admin-muted">
                    {{ format(new Date(t.ratedAt), 'dd MMM HH:mm') }}
                  </p>
                </td>
                <td class="text-xs whitespace-nowrap">
                  {{ format(new Date(t.updatedAt), 'dd MMM HH:mm') }}
                </td>
                <td>
                  <button
                    type="button"
                    class="admin-btn-secondary py-1 text-xs"
                    @click="openTicket(t)"
                  >
                    Open
                  </button>
                </td>
              </tr>
              <tr v-if="!csaTickets.length && !loadingCsaTickets">
                <td colspan="5" class="py-8 text-center text-admin-muted">No tickets</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="admin-pagination mt-3">
          <span class="text-xs">{{ csaTicketsTotal }} total</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="csaTicketsPage <= 1"
              @click="loadCsaTickets(csaTicketsPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="admin-btn-secondary text-xs"
              :disabled="csaTicketsPage * 20 >= csaTicketsTotal"
              @click="loadCsaTickets(csaTicketsPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </template>
      <template #footer>
        <button
          type="button"
          class="admin-btn-secondary"
          @click="csaTicketsOpen = false; csaTicketsTarget = null"
        >
          Close
        </button>
      </template>
    </BaseDialog>
  </div>
</template>
