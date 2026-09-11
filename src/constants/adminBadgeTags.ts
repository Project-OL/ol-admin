/**
 * Manual profile/live-card badge tags operators can assign.
 * Derived tags (agency, coinseller, gift collection, VIP/SVIP, RICH…) are
 * computed by ol-node and must not be set via this control.
 */
export const MANUAL_ADMIN_BADGE_OPTIONS = [
  { value: 'celebrity host', label: 'Celebrity host' },
  { value: 'royal host', label: 'Royal host' },
  { value: 'star host', label: 'Star host' },
  { value: 'admin', label: 'Admin' },
] as const

export type ManualAdminBadgeValue = (typeof MANUAL_ADMIN_BADGE_OPTIONS)[number]['value']

/** Normalize the same way ol_app badge matching does (spaces/underscores ignored). */
export function normalizeAdminTagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/[_\s]+/g, '')
}

const MANUAL_BY_KEY = new Map(
  MANUAL_ADMIN_BADGE_OPTIONS.map((opt) => [normalizeAdminTagKey(opt.value), opt.value]),
)

/** Aliases Flutter accepts for the same badge (map onto canonical value). */
const MANUAL_ALIAS_KEYS = new Map<string, ManualAdminBadgeValue>([
  ['celebrityhost', 'celebrity host'],
  ['royalhost', 'royal host'],
  ['starhost', 'star host'],
  ['admin', 'admin'],
])

export function matchManualBadge(tag: string): ManualAdminBadgeValue | null {
  const key = normalizeAdminTagKey(tag)
  return MANUAL_BY_KEY.get(key) ?? MANUAL_ALIAS_KEYS.get(key) ?? null
}

export function isManualBadgeTag(tag: string): boolean {
  return matchManualBadge(tag) != null
}

/**
 * Tags that are (or were) auto-derived / should not be operator-edited.
 * Includes common aliases so typos of auto tags are stripped on save.
 */
export function isAutoDerivedAdminTag(tag: string): boolean {
  const key = normalizeAdminTagKey(tag)
  if (key.startsWith('rich')) return true
  return (
    key === 'agency' ||
    key === 'applyagency' ||
    key === 'coinseller' ||
    key === 'giftcollection' ||
    key === 'vip' ||
    key === 'vipdiamond' ||
    key === 'svip' ||
    key === 'diamondvip'
  )
}

/**
 * Collapse stored tags to canonical manual badges (+ keep unknown custom tags).
 * Drops auto-derived labels so they are not re-persisted from this form.
 */
export function sanitizeStoredAdminTags(tags: string[]): string[] {
  const selected = new Set<ManualAdminBadgeValue>()
  const preserved: string[] = []
  for (const raw of tags) {
    const manual = matchManualBadge(raw)
    if (manual) {
      selected.add(manual)
      continue
    }
    if (isAutoDerivedAdminTag(raw)) continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    preserved.push(trimmed)
  }
  const orderedManual = MANUAL_ADMIN_BADGE_OPTIONS.map((o) => o.value).filter((v) =>
    selected.has(v),
  )
  return [...orderedManual, ...preserved]
}

export function toggleManualBadge(tags: string[], value: ManualAdminBadgeValue): string[] {
  const sanitized = sanitizeStoredAdminTags(tags)
  const has = sanitized.some((t) => matchManualBadge(t) === value)
  if (has) {
    return sanitized.filter((t) => matchManualBadge(t) !== value)
  }
  return sanitizeStoredAdminTags([...sanitized, value])
}

export function selectedManualBadgeValues(tags: string[]): ManualAdminBadgeValue[] {
  return sanitizeStoredAdminTags(tags)
    .map((t) => matchManualBadge(t))
    .filter((v): v is ManualAdminBadgeValue => v != null)
}

export function manualBadgeSummary(tags: string[]): string {
  const selected = selectedManualBadgeValues(tags)
  if (!selected.length) return 'Select badges…'
  const labels = MANUAL_ADMIN_BADGE_OPTIONS.filter((o) => selected.includes(o.value)).map(
    (o) => o.label,
  )
  return labels.join(', ')
}
