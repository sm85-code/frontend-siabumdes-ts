import api, { API, type MoneyInput } from '@/api/client'
import type { DashboardData, LedgerData } from '@/types'

export interface DashboardParams {
  startDate: string
  endDate: string
  granularity: string
}

export async function fetchDashboard(params: DashboardParams): Promise<DashboardData> {
  const r = await api.get<DashboardData>('/reports/dashboard', {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      granularity: params.granularity,
    },
  })
  return r.data
}

export async function fetchReport(
  key: string,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  const r = await api.get(`/reports/${key}`, { params })
  return r.data
}

export async function fetchLedger(params: {
  accountCode: string
  startDate: string
  endDate: string
  unitUsahaId?: string | null
}): Promise<LedgerData> {
  const r = await api.get<LedgerData>('/reports/ledger', {
    params: {
      account_code: params.accountCode,
      start_date: params.startDate,
      end_date: params.endDate,
      unit_usaha_id: params.unitUsahaId || undefined,
    },
  })
  return r.data
}

export async function downloadReportFile(
  path: string,
  params: Record<string, string | undefined>,
  filename: string,
) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v)
  }
  const res = await fetch(`${API}${path}?${qs}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Gagal mengunduh file')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function fetchClosedPeriods(): Promise<
  { period: string; group: string; closed_at?: string }[]
> {
  const r = await api.get('/reports/closed-periods')
  return r.data ?? []
}

export async function closePeriod(period: string, group: string) {
  const r = await api.post<{ entries: number; laba_bersih: MoneyInput }>('/reports/close-period', {
    period,
    group,
  })
  return r.data
}

export async function reopenPeriod(period: string, group: string) {
  await api.delete('/reports/close-period', { params: { period, group } })
}

export async function fetchLockedPeriods(): Promise<
  { period: string; group: string; locked_at?: string }[]
> {
  const r = await api.get('/reports/locked-periods')
  return r.data ?? []
}

export async function lockPeriod(period: string, group: string) {
  await api.post('/reports/lock-period', { period, group })
}

export async function unlockPeriod(period: string, group: string) {
  await api.delete('/reports/lock-period', { params: { period, group } })
}

export interface BagiHasilTransferResult {
  period: string
  group: string
  date: string
  total: MoneyInput
  items: { label: string; amount: MoneyInput }[]
}

export interface BagiHasilTransferRow {
  period: string
  group: string
  date: string
  total: MoneyInput
  entries: number
}

export async function transferBagiHasil(period: string, group: string) {
  const r = await api.post<BagiHasilTransferResult>('/reports/bagi-hasil-transfer', { period, group })
  return r.data
}

export async function fetchBagiHasilTransfers(): Promise<BagiHasilTransferRow[]> {
  const r = await api.get('/reports/bagi-hasil-transfers')
  return r.data ?? []
}

export async function cancelBagiHasilTransfer(period: string, group: string) {
  await api.delete('/reports/bagi-hasil-transfer', { params: { period, group } })
}
