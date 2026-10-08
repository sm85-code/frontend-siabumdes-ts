import {
  Building2,
  Calendar,
  ChartPie,
  Coins,
  Lock,
  Receipt,
  Scale,
  Store,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useMemo, useState, type ComponentType } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { fmtRp, parseMoney } from '@/api/client'
import PeriodFilter from '@/components/PeriodFilter'
import Spinner from '@/components/Spinner'
import TableShell from '@/components/TableShell'
import { Card, CardContent } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ROLE_LABELS } from '@/config/roles'
import { useDashboardQuery } from '@/hooks/useDashboard'
import { useAuth } from '@/lib/auth'
import {
  MONTHS,
  chartConfigForPeriod,
} from '@/lib/dashboardBucketing'
import type { PeriodValue } from '@/types'

const TODAY_LABEL = new Date().toLocaleDateString('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const INK = 'var(--primary-dark)'
const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
]

type KpiItem = {
  key: string
  label: string
  value: number | null
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>
  isCount?: boolean
}

function DashboardKpiGrid({ items, desktopColumns = 4 }: { items: KpiItem[]; desktopColumns?: 3 | 4 }) {
  return <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${desktopColumns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
    {items.map((k) => {
      const Icon = k.icon
      return <Card key={k.key} className="min-w-0" data-testid={`kpi-${k.key}`}>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-inset)' }}>
            <Icon className="size-4.5" style={{ color: INK }} />
          </div>
          <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>{k.label}</p>
          <p className="font-heading mt-1 text-lg font-bold tabular-nums [overflow-wrap:anywhere] sm:text-2xl">
            {k.value == null ? '—' : k.isCount ? k.value : fmtRp(k.value)}
          </p>
        </CardContent>
      </Card>
    })}
  </div>
}

function defaultYearPeriod(): PeriodValue {
  const now = new Date()
  const y = now.getFullYear()
  return {
    mode: 'yearly',
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
    label: `Tahun ${y}`,
  }
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isPengelola = user?.role === 'pengelola'
  const [period, setPeriod] = useState<PeriodValue>(defaultYearPeriod)

  const chartConfig = useMemo(() => chartConfigForPeriod(period), [period])

  const { data, isLoading, isFetching } = useDashboardQuery({
    startDate: period.startDate,
    endDate: period.endDate,
    granularity: chartConfig.granularity,
  })

  const kpis = useMemo<KpiItem[]>(() => {
    if (!data) return []
    return [
      { key: 'pendapatan', label: 'Total Pendapatan', value: parseMoney(data.total_pendapatan), icon: TrendingUp },
      { key: 'beban', label: 'Total Beban', value: parseMoney(data.total_beban), icon: TrendingDown },
      { key: 'laba', label: 'Laba Bersih', value: parseMoney(data.laba_bersih), icon: Coins },
      {
        key: 'tx',
        label: 'Jumlah Transaksi',
        value: data.total_transactions,
        icon: Receipt,
        isCount: true,
      },
    ]
  }, [data])

  const posisiKpis = useMemo<KpiItem[]>(() => {
    if (!data) return []
    return [
      { key: 'total-aset', label: 'Total Aset', value: parseMoney(data.total_aset), icon: Building2 },
      { key: 'total-kewajiban', label: 'Total Kewajiban', value: parseMoney(data.total_kewajiban), icon: Scale },
      { key: 'total-ekuitas', label: 'Total Ekuitas', value: parseMoney(data.total_ekuitas), icon: Wallet },
      { key: 'modal-desa', label: isPengelola ? 'Modal BUMDes' : 'Modal Desa', value: data.modal_desa == null ? null : parseMoney(data.modal_desa), icon: Building2 },
    ]
  }, [data, isPengelola])

  const bagiHasilKpis = useMemo<KpiItem[]>(() => ((isPengelola ? data?.bagi_hasil_unit : data?.bagi_hasil_bumdes) ?? []).map((row) => ({
    key: `bagi-hasil-${row.key}`,
    label: `${row.label} (${row.persen}%)`,
    value: parseMoney(row.amount),
    icon: ChartPie,
  })), [data, isPengelola])

  const unitCount = data?.unit_summaries?.length ?? 0
  const profitableUnits = useMemo(
    // API sends money as strings; Recharts' Pie needs numeric values to draw slices.
    () =>
      (data?.unit_summaries ?? [])
        .map((u) => ({ ...u, laba: parseMoney(u.laba) }))
        .filter((u) => u.laba > 0),
    [data],
  )

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner column size={48} label="Memuat dashboard..." />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Tidak ada data.
      </div>
    )
  }

  const jabatan = (user?.role && ROLE_LABELS[user.role]) || 'Pengguna'
  const pLabel = period.label
  const blocked = user?.blocked_periods ?? []

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {blocked.length > 0 && (
        <Card className="fade-in" data-testid="blocked-periods-banner">
          <CardContent className="pt-2">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 size-5 shrink-0" style={{ color: INK }} />
              <div>
                <p className="font-heading font-semibold">
                  {blocked.length} periode terkunci oleh Admin
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Anda tidak dapat menambah, mengubah, atau menghapus transaksi pada:{' '}
                  <b>
                    {[...blocked]
                      .sort()
                      .map((p) => {
                        const [y, m] = p.split('-')
                        return `${MONTHS[Number(m) - 1]} ${y}`
                      })
                      .join(' · ')}
                  </b>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <p className="label mb-1">SIA BUMDes Karya Raharja</p>
        <h1
          className="font-heading page-h1 text-3xl font-bold sm:text-4xl"
          data-testid="dashboard-greeting"
        >
          Selamat datang, {jabatan}.
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ringkasan data BUMDes Karya Raharja • {TODAY_LABEL}
          {isFetching ? ' · memperbarui…' : ''}
        </p>
      </div>

      <Card data-testid="period-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="label mb-0 flex items-center gap-1">
              <Calendar className="size-3.5" style={{ color: INK }} /> Periode
            </label>
            <PeriodFilter
              value={period}
              onChange={setPeriod}
              defaultMode="yearly"
              data-testid="dashboard-period-filter"
            />
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="activity-title">
        <h2 id="activity-title" className="font-heading mb-3 text-lg font-semibold">{isPengelola ? 'Aktivitas Unit Usaha' : 'Aktivitas Usaha BUMDes'}</h2>
        <DashboardKpiGrid items={kpis} />
      </section>

      <section aria-labelledby="financial-position-title">
        <h2 id="financial-position-title" className="font-heading mb-3 text-lg font-semibold">{isPengelola ? 'Posisi Keuangan Unit Usaha' : 'Posisi Keuangan BUMDes'}</h2>
        <DashboardKpiGrid items={posisiKpis} />
      </section>

      <section aria-labelledby="profit-sharing-title">
        <h2 id="profit-sharing-title" className="font-heading mb-1 text-lg font-semibold">{isPengelola ? 'Bagi Hasil Unit Usaha' : 'Proporsi Bagi Hasil BUMDes'}</h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Estimasi alokasi laba bersih {isPengelola ? 'unit usaha Anda' : 'BUMDes pusat'} untuk {pLabel}, sesuai proporsi pada Profil BUMDes.
        </p>
        {bagiHasilKpis.length > 0 ? <DashboardKpiGrid items={bagiHasilKpis} desktopColumns={3} /> : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Data bagi hasil BUMDes pusat tidak tersedia pada tampilan ini.</p>
        )}
      </section>

      {!isPengelola && <>
        <Card>
          <CardContent className="pt-2">
            <h3 className="font-heading mb-1 text-lg font-semibold">Kontribusi Per Unit Usaha</h3>
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Berdasarkan laba bersih per unit (unit dengan laba positif).
            </p>
            {profitableUnits.length > 0 ? (
              <ChartContainer config={{}} className="aspect-auto w-full" style={{ height: 240 }}>
                <PieChart>
                  <Pie
                    data={profitableUnits}
                    dataKey="laba"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                  >
                    {profitableUnits.map((u, i) => (
                      <Cell key={u.id} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Belum ada unit dengan laba positif pada periode ini.
              </p>
            )}
          </CardContent>
        </Card>

      <Card className="overflow-hidden p-0">
        <div className="p-5">
          <h3
            className="font-heading flex items-center gap-2 text-lg font-semibold"
            data-testid="unit-table-title"
          >
            <Store className="size-5" style={{ color: INK }} /> Aktivitas Unit Usaha BUMDes
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Periode: {pLabel}
          </p>
        </div>
        <TableShell minWidth={560}>
          <Table data-testid="unit-summary-table">
            <TableHeader>
              <TableRow>
                <TableHead>Unit Usaha</TableHead>
                <TableHead className="text-right">Pendapatan</TableHead>
                <TableHead className="text-right">Beban</TableHead>
                <TableHead className="text-right">Laba Bersih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.unit_summaries.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtRp(u.pendapatan)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtRp(u.beban)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtRp(u.laba)}
                  </TableCell>
                </TableRow>
              ))}
              {unitCount > 0 && (
                <TableRow data-testid="unit-total-row">
                  <TableCell className="font-bold">
                    TOTAL {unitCount} UNIT USAHA
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {fmtRp(data.unit_summaries.reduce((s, u) => s + parseMoney(u.pendapatan), 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {fmtRp(data.unit_summaries.reduce((s, u) => s + parseMoney(u.beban), 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {fmtRp(data.unit_summaries.reduce((s, u) => s + parseMoney(u.laba), 0))}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableShell>
      </Card>
      <UnitFinancialTable title="Posisi Keuangan Unit Usaha BUMDes" rows={data.unit_summaries} columns={[
        ['total_aset', 'Total Aset'], ['total_kewajiban', 'Total Kewajiban'],
        ['total_ekuitas', 'Total Ekuitas'], ['modal_bumdes', 'Modal BUMDes'],
      ]} />
      <UnitFinancialTable title="Bagi Hasil Unit Usaha BUMDes" rows={data.unit_summaries} columns={[
        ['share_pengelola', `Pengelola (${data.unit_share_persen?.pengelola ?? 30}%)`],
        ['share_bumdes', `BUMDes (${data.unit_share_persen?.bumdes ?? 70}%)`], ['laba', 'Jumlah'],
      ]} />
      </>}
    </div>
  )
}

function UnitFinancialTable({ title, rows, columns }: {
  title: string
  rows: import('@/types').UnitSummary[]
  columns: [keyof import('@/types').UnitSummary, string][]
}) {
  return <Card className="overflow-hidden p-0">
    <h3 className="font-heading p-5 text-lg font-semibold">{title}</h3>
    <TableShell minWidth={640}><Table>
      <TableHeader><TableRow><TableHead>Nama Unit Usaha</TableHead>
        {columns.map(([key, label]) => <TableHead key={key} className="text-right">{label}</TableHead>)}
      </TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={row.id}>
        <TableCell className="font-medium">{row.name}</TableCell>
        {columns.map(([key]) => <TableCell key={key} className="text-right whitespace-nowrap tabular-nums">
          {row[key] == null ? '—' : fmtRp(row[key])}
        </TableCell>)}
      </TableRow>)}</TableBody>
    </Table></TableShell>
  </Card>
}
