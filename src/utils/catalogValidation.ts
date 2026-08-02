export const GIFT_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/

export const GIFT_ASSET_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.svg,.gif,.json,.lottie,.riv,.mp4,.webm,image/*,video/*'

export const STORE_ASSET_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.svg,.gif,.json,.lottie,.riv,.mp4,.webm,image/*,video/*'

const GIFT_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'svg',
  'gif',
  'json',
  'lottie',
  'riv',
  'mp4',
  'webm',
])

const STORE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'svg',
  'gif',
  'json',
  'lottie',
  'riv',
  'mp4',
  'webm',
])

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function extFromFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot < 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function isAllowedCatalogAssetFile(
  file: File,
  domain: 'gift' | 'store',
): { ok: true } | { ok: false; message: string } {
  const ext = extFromFilename(file.name)
  const allowed = domain === 'gift' ? GIFT_EXTENSIONS : STORE_EXTENSIONS
  if (!ext || !allowed.has(ext)) {
    return {
      ok: false,
      message: `Unsupported file type .${ext || '(none)'}. Allowed: ${[...allowed].sort().join(', ')}`,
    }
  }
  return { ok: true }
}

export function validatePositiveInt(
  value: unknown,
  label: string,
  options?: { min?: number; max?: number },
): string | null {
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${label} must be a whole number`
  const min = options?.min ?? 1
  if (n < min) return `${label} must be at least ${min}`
  if (options?.max != null && n > options.max) return `${label} must be at most ${options.max}`
  return null
}

export function validateNonNegativeInt(value: unknown, label: string): string | null {
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${label} must be a whole number`
  if (n < 0) return `${label} must be 0 or greater`
  return null
}
