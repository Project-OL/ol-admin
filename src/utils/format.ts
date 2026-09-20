const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('en-IN')

export function formatINR(value: number): string {
  return inrFormatter.format(value)
}

export function formatCoins(value: number): string {
  return `${numberFormatter.format(value)}`
}

export function formatPoints(value: number): string {
  return `${numberFormatter.format(value)}`
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

const LOCAL_CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  NPR: 'रू',
}

/** Host local FX display (admin-managed country rates). */
export function formatLocalMoney(
  amount: string | number | null | undefined,
  code?: string | null,
): string {
  if (amount == null || amount === '') return '—'
  const upper = (code ?? 'INR').toUpperCase()
  const prefix = LOCAL_CURRENCY_SYMBOL[upper] ?? `${upper} `
  return `${prefix}${amount}`
}

/** Seconds -> "Xh Ym" (or "Ym" under an hour, "0m" for 0). */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
