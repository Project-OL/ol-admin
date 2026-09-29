type ToastType = 'success' | 'error' | 'info'

let toastContainer: HTMLDivElement | null = null

/** Messages currently on screen, so the same text is never stacked twice. */
const visibleMessages = new Set<string>()

/**
 * When the API client has just toasted a failed request's own message, a view's catch block
 * usually follows with its own generic error toast for the same failure. Drop that one.
 */
const API_ERROR_SUPPRESS_MS = 1500
let lastApiErrorToastAt = 0

function ensureContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className =
      'fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

function render(message: string, type: ToastType): void {
  if (visibleMessages.has(message)) return
  visibleMessages.add(message)
  const container = ensureContainer()
  const el = document.createElement('div')
  const colors = {
    success: 'bg-admin-success',
    error: 'bg-admin-danger',
    info: 'bg-admin-accent',
  }
  el.className = `${colors[type]} text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in pointer-events-auto`
  el.textContent = message
  container.appendChild(el)
  setTimeout(() => {
    el.remove()
    visibleMessages.delete(message)
  }, type === 'error' ? 6000 : 4000)
}

export function showToast(message: string, type: ToastType = 'info'): void {
  if (type === 'error' && Date.now() - lastApiErrorToastAt < API_ERROR_SUPPRESS_MS) return
  render(message, type)
}

/** Used by the axios interceptors: shows the backend's own error message for a failed request. */
export function showApiErrorToast(message: string): void {
  lastApiErrorToastAt = Date.now()
  render(message, 'error')
}
