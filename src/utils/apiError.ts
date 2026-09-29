import axios from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Skip the global error toast for this request: background polling, optional lookups
     * that are expected to 404, or callers that render the error inline themselves.
     */
    skipErrorToast?: boolean
  }
}

type ErrorBody = { message?: unknown; error?: unknown; code?: unknown } | string | undefined

/** A Zod error that reached the default handler arrives as its JSON issue list; keep the first. */
function firstZodIssue(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('[')) return null
  try {
    const issues = JSON.parse(trimmed) as Array<{ message?: string; path?: unknown[] }>
    const first = issues[0]
    if (!first?.message) return null
    const field = Array.isArray(first.path) && first.path.length ? `${first.path.join('.')}: ` : ''
    return `${field}${first.message}`
  } catch {
    return null
  }
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  return firstZodIssue(text) ?? text
}

/**
 * Human-readable message for a failed request. Both backends reply with
 * `{ statusCode, code, error, message }`, where `message` is the text meant for people.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error && err.message ? err.message : fallback
  }
  if (!err.response) {
    if (err.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
    return 'Network error: could not reach the server.'
  }
  const body = err.response.data as ErrorBody
  if (typeof body === 'string') return clean(body) ?? fallback
  return (
    clean(body?.message) ??
    clean(body?.error) ??
    `Request failed (${err.response.status})`
  )
}

export function apiErrorCode(err: unknown): string | undefined {
  if (!axios.isAxiosError(err)) return undefined
  const code = (err.response?.data as { code?: unknown } | undefined)?.code
  return typeof code === 'string' ? code : undefined
}
