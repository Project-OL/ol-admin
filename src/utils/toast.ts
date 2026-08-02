type ToastType = 'success' | 'error' | 'info'

let toastContainer: HTMLDivElement | null = null

function ensureContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className =
      'fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

export function showToast(message: string, type: ToastType = 'info'): void {
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
  }, 4000)
}
