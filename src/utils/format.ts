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

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
