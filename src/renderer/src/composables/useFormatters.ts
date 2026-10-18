export function money(value: number): string {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function compactMoney(value: number): string {
  const amount = Math.abs(value)
  if (amount >= 10_000) return `¥ ${money(value / 10_000)} 万`
  if (amount >= 1_000) return `¥ ${money(value / 1_000)} 千`
  return `¥ ${money(value)}`
}

export function shortDate(value: string): string {
  if (!value) return '待补充'
  const [year, month, day] = value.split('-')
  return `${year}.${month}.${day}`
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
