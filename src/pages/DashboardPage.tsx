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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import { fmtRp, parseMoney } from '@/api/client'
import PeriodFilter from '@/components/PeriodFilter'
import Spinner from '@/components/Spinner'
import TableShell from '@/components/TableShell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
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
  bucketize,
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
const GRID_STROKE = 'var(--legacy-border, #E4E4E7)'
const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
]

const TREND_CHART_CONFIG: ChartConfig = {
  pendapatan: { label: 'Pendapatan', color: 'var(--chart-2)' },
  beban: { label: 'Beban', color: 'var(--chart-1)' },
}

const yTickFormatter = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(1)}Jt` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}rb` : String(v)

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
      { key: 'modal-desa', label: 'Modal Desa', value: data.modal_desa == null ? null : parseMoney(data.modal_desa), icon: Building2 },
    ]
  }, [data])

  const bagiHasilKpis = useMemo<KpiItem[]>(() => (data?.bagi_hasil_bumdes ?? []).map((row) => ({
    key: `bagi-hasil-${row.key}`,
    label: `${row.label} (${row.persen}%)`,
    value: parseMoney(row.amount),
    icon: ChartPie,
  })), [data])

  const chartData = useMemo(() => {
    if (!data?.monthly) return []
    return bucketize(data.monthly, chartConfig.bucket)
  }, [data, chartConfig.bucket])

  const useBar = chartData.length <= 1
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
        <h2 id="activity-title" className="font-heading mb-3 text-lg font-semibold">Aktivitas Usaha BUMDes</h2>
        <DashboardKpiGrid items={kpis} />
      </section>

      <section aria-labelledby="financial-position-title">
        <h2 id="financial-position-title" className="font-heading mb-3 text-lg font-semibold">Posisi Keuangan BUMDes</h2>
        <DashboardKpiGrid items={posisiKpis} />
      </section>

      <section aria-labelledby="profit-sharing-title">
        <h2 id="profit-sharing-title" className="font-heading mb-1 text-lg font-semibold">Proporsi Bagi Hasil BUMDes</h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Estimasi alokasi laba bersih BUMDes pusat untuk {pLabel}, sesuai proporsi pada Profil BUMDes.
        </p>
        {bagiHasilKpis.length > 0 ? <DashboardKpiGrid items={bagiHasilKpis} desktopColumns={3} /> : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Data bagi hasil BUMDes pusat tidak tersedia pada tampilan ini.</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-2">
            <h3
              className="font-heading mb-4 text-lg font-semibold"
              data-testid="trend-title"
            >
              Pendapatan & Beban ({pLabel})
            </h3>
            {chartData.length > 0 ? (
              <ChartContainer
                config={TREND_CHART_CONFIG}
                className="aspect-auto w-full"
                style={{ height: 280 }}
              >
                {useBar ? (
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={yTickFormatter} />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="pendapatan"
                      name="Pendapatan"
                      fill="var(--color-pendapatan)"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="beban"
                      name="Beban"
                      fill="var(--color-beban)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={yTickFormatter} />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="pendapatan"
                      name="Pendapatan"
                      stroke="var(--color-pendapatan)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="beban"
                      name="Beban"
                      stroke="var(--color-beban)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                )}
              </ChartContainer>
            ) : (
              <p className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Belum ada transaksi pada periode ini.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-2">
            <h3 className="font-heading mb-1 text-lg font-semibold">Kontribusi Per Unit</h3>
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Berdasarkan laba bersih per unit (unit dengan laba positif).
            </p>
            {profitableUnits.length > 0 ? (
              <ChartContainer config={{}} className="aspect-auto w-full" style={{ height: 240 }}>
                <PieChart>
                  <Pie
                    data={profitableUnits}
                    dataKey="laba"
                    nameKey="code"
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
      </div>

      <Card className="overflow-hidden p-0">
        <div className="p-5">
          <h3
            className="font-heading flex items-center gap-2 text-lg font-semibold"
            data-testid="unit-table-title"
          >
            <Store className="size-5" style={{ color: INK }} /> Data Unit Usaha
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Periode: {pLabel}
          </p>
        </div>
        <TableShell minWidth={560}>
          <Table data-testid="unit-summary-table">
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Unit Usaha</TableHead>
                <TableHead className="text-right">Pendapatan</TableHead>
                <TableHead className="text-right">Beban</TableHead>
                <TableHead className="text-right">Laba Bersih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.unit_summaries.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Badge>{u.code}</Badge>
                  </TableCell>
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
                  <TableCell />
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
    </div>
  )
}
