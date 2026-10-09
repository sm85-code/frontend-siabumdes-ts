import { useEffect, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, HeartHandshake, TrendingUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import api, { fmtRp, parseMoney } from '@/api/client'
import AppearancePopover from '@/components/AppearancePopover'
import Spinner from '@/components/Spinner'
import WallpaperLayer from '@/components/WallpaperLayer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { TypographyH3 } from '@/components/ui/typography'

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ags',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const

const TREND_CHART_CONFIG = {
  pendapatan: { label: 'Pendapatan', color: 'var(--chart-2)' },
  beban: { label: 'Beban', color: 'var(--chart-1)' },
} satisfies ChartConfig

type PublicTrendPoint = {
  month: string
  pendapatan: number | string
  beban: number | string
}

type PublicSummary = {
  year?: number
  total_pendapatan?: number | string
  total_beban?: number | string
  laba_bersih?: number | string
  pades_estimasi?: number | string
  trend?: PublicTrendPoint[]
}

type TrendRow = {
  label: string
  pendapatan: number
  beban: number
}

/** Public transparency landing — matches live frontend-siabumdes Landing.jsx. */
export default function LandingPage() {
  const [data, setData] = useState<PublicSummary | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<PublicSummary>('/public/summary')
      .then((r) => setData(r.data))
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'Gagal memuat data'
        setErr(message)
      })
  }, [])

  const year = data?.year || new Date().getFullYear()
  const trend: TrendRow[] = (data?.trend || []).map((t) => ({
    label: MONTH_LABELS[Number(t.month.slice(5, 7)) - 1] || t.month,
    pendapatan: parseMoney(t.pendapatan),
    beban: parseMoney(t.beban),
  }))

  return (
    <div className="auth-bg min-h-screen" data-testid="landing-page">
      <WallpaperLayer />
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/logo-transparent.png"
            alt="Logo BUMDes"
            data-testid="landing-logo"
            className="h-11 w-11 shrink-0 object-contain"
          />
          <div className="min-w-0 leading-tight">
            <div className="font-heading text-[1.05rem] font-semibold tracking-tight">BUMDes Karya Raharja</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Desa Wonoharjo - Kec. Pangandaran
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AppearancePopover iconOnly triggerClassName="shrink-0" align="end" />
          <Button asChild variant="outline" className="text-sm">
            <Link to="/login" data-testid="landing-login-top">
              Masuk <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 pt-10 pb-6 text-center">
        <p
          className="mb-5 inline-block rounded-full px-4 py-1.5 text-xs tracking-[0.14em] uppercase"
          style={{ background: 'var(--primary-light)', color: 'var(--text-secondary)' }}
        >
          Papan Kinerja · BUMDes · Tahun {year}
        </p>
        <h1 className="modern-brand-title text-3xl font-bold sm:text-5xl">
          SIA BUMDes <span style={{ color: 'var(--chart-3)' }}>Karya Raharja</span>
        </h1>
        <p className="mt-4 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
          Sistem Informasi Akuntansi & Transparansi Keuangan Terintegrasi.
          <br />
          Berdaya dari Desa, Berkontribusi untuk Wonoharjo.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-6" data-testid="landing-stats">
        {err && (
          <p className="text-center text-sm" style={{ color: 'var(--status-error)' }}>
            Gagal memuat data ringkasan.
          </p>
        )}
        {!data && !err && (
          <div className="flex justify-center">
            <Spinner />
          </div>
        )}
        {data && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="Total Pendapatan"
              value={fmtRp(data.total_pendapatan)}
              testId="stat-pendapatan"
            />
            <StatCard
              icon={TrendingUp}
              label="Total Beban"
              value={fmtRp(data.total_beban)}
              testId="stat-beban"
            />
            <StatCard
              icon={Building2}
              label="Laba Bersih"
              value={fmtRp(data.laba_bersih)}
              testId="stat-laba"
            />
            <StatCard
              icon={HeartHandshake}
              label="Kontribusi PADes (est.)"
              value={fmtRp(data.pades_estimasi)}
              testId="stat-pades"
            />
          </div>
        )}
      </section>

      {data && trend.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 pb-8">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-heading mb-1 text-lg font-semibold tracking-tight">Tren Pendapatan & Beban {year}</h3>
              <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                Diperbarui langsung dari transaksi resmi.
              </p>
              <ChartContainer
                config={TREND_CHART_CONFIG}
                className="aspect-auto w-full"
                style={{ height: 220 }}
              >
                <LineChart data={trend} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--legacy-border, #E3E8E6)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1_000_000
                        ? `${Math.round(v / 1_000_000)}jt`
                        : v >= 1000
                          ? `${Math.round(v / 1000)}rb`
                          : String(v)
                    }
                    width={44}
                  />
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
                    dot={{ r: 3, fill: 'var(--color-pendapatan)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="beban"
                    name="Beban"
                    stroke="var(--color-beban)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--color-beban)' }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="mx-auto max-w-5xl px-5 pb-12">
        <Card>
          <CardContent className="pt-6">
            <TypographyH3 className="mb-4 text-2xl">
              Akuntabilitas Real-Time Melalui Inovasi Digital
            </TypographyH3>
            <blockquote
              data-testid="narasi-komitmen"
              className="mb-6"
            >
              <div
                className="font-body text-sm leading-relaxed text-justify space-y-3"
                style={{ color: 'var(--text-secondary)' }}
              >
              <p>
                SIA BUMDes Karya Raharja adalah wujud nyata komitmen BUMDes Karya Raharja Desa
                Wonoharjo dalam menerapkan tata kelola keuangan yang transparan, akuntable, dan
                profesional dengan berpedoman pada Kepmendesa PDTT No. 136 Tahun 2022.
              </p>
              <p>
                Data yang ditampilkan di atas adalah data yang diperoleh secara <em>real-time</em>{' '}
                dari hasil pencatatan transaksi aktivitas usaha BUMDes.
              </p>
              <p>
                Kehadiran platform ini memastikan setiap rupiah pendapatan dioptimalkan untuk
                meminimalkan beban, memaksimalkan laba bersih, dan memperbesar kontribusi PADes demi
                pembangunan desa yang berkelanjutan.
              </p>
              </div>
            </blockquote>
            <Button asChild>
              <Link to="/login" data-testid="landing-login-bottom">
                Masuk ke Dasbor <ArrowRight size={16} />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer
        className="mx-auto max-w-5xl px-5 pb-8 text-center text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        © {new Date().getFullYear()} BUMDes Karya Raharja Wonoharjo. All Rights Reserved.
      </footer>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: ComponentType<{ size?: number; color?: string; className?: string }>
  label: string
  value: string
  testId: string
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="pt-6">
        <div
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'var(--primary-light)' }}
        >
          <Icon size={18} color="var(--primary-dark)" />
        </div>
        <div
          className="text-xs font-semibold tracking-[0.1em] uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </div>
        <div className="modern-brand-title mt-1 text-xl font-bold leading-tight break-words tabular-nums sm:text-2xl">{value}</div>
      </CardContent>
    </Card>
  )
}
