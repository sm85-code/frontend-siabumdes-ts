import { parseMoney } from '@/lib/money'
import type { DashboardMonthlyPoint, PeriodMode, PeriodValue } from '@/types'

export const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

export type ChartBucket = 'day' | 'week' | 'month'

export interface ChartConfig {
  granularity: 'day' | 'month'
  bucket: ChartBucket
}

export const MODE_CHART_CONFIG: Record<Exclude<PeriodMode, 'custom'>, ChartConfig> = {
  today: { granularity: 'day', bucket: 'day' },
  week: { granularity: 'day', bucket: 'day' },
  thisMonth: { granularity: 'day', bucket: 'week' },
  monthly: { granularity: 'day', bucket: 'week' },
  yearly: { granularity: 'month', bucket: 'month' },
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function chartConfigForPeriod(period: Pick<PeriodValue, 'mode' | 'startDate' | 'endDate'>): ChartConfig {
  if (period.mode !== 'custom') {
    return MODE_CHART_CONFIG[period.mode] || MODE_CHART_CONFIG.yearly
  }
  const start = parseLocalDate(period.startDate)
  const end = parseLocalDate(period.endDate)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  if (days <= 31) return { granularity: 'day', bucket: 'day' }
  if (days <= 120) return { granularity: 'day', bucket: 'week' }
  return { granularity: 'month', bucket: 'month' }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function labelize(key: string, bucket: ChartBucket): string {
  if (bucket === 'day') {
    const parts = key.split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`
    return key
  }
  if (bucket === 'month') {
    const parts = key.split('-')
    if (parts.length >= 2) {
      const m = Number(parts[1])
      return `${MONTHS[m - 1]?.slice(0, 3) || m} ${parts[0].slice(2)}`
    }
    return key
  }
  return key
}

export function bucketize(
  list: DashboardMonthlyPoint[] | null | undefined,
  targetBucket: ChartBucket,
): Array<DashboardMonthlyPoint & { month: string }> {
  if (!list || list.length === 0) return []
  if (targetBucket === 'day' || targetBucket === 'month') {
    return list.map((r) => ({
      ...r,
      month: labelize(r.month, targetBucket),
      pendapatan: parseMoney(r.pendapatan),
      beban: parseMoney(r.beban),
    }))
  }
  const map = new Map<string, { pendapatan: number; beban: number }>()
  for (const r of list) {
    const d = parseLocalDate(r.month)
    if (Number.isNaN(d.getTime())) continue
    const day = d.getDay() || 7
    const monday = new Date(d)
    monday.setDate(d.getDate() - (day - 1))
    const key = iso(monday)
    const prev = map.get(key) || { pendapatan: 0, beban: 0 }
    map.set(key, {
      pendapatan: prev.pendapatan + parseMoney(r.pendapatan),
      beban: prev.beban + parseMoney(r.beban),
    })
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => {
      const monday = parseLocalDate(k)
      return {
        month: `Minggu ${monday.getDate()}/${monday.getMonth() + 1}`,
        ...v,
      }
    })
}
