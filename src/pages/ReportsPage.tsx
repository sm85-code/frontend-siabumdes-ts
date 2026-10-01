import {
  BookOpen,
  ChartLine,
  Coins,
  FileSpreadsheet,
  FileText,
  Lock,
  Scale,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchOrgProfile } from '@/api/admin'
import { fmtRp, getApiError, parseMoney } from '@/api/client'
import {
  closePeriod,
  downloadReportFile,
  fetchClosedPeriods,
  fetchLockedPeriods,
  fetchReport,
  lockPeriod,
  reopenPeriod,
  unlockPeriod,
} from '@/api/reports'
import { buildUnitGroupTabs } from '@/api/units'
import { useConfirm } from '@/components/ConfirmProvider'
import PeriodFilter from '@/components/PeriodFilter'
import Spinner from '@/components/Spinner'
import TableShell from '@/components/TableShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useUnitsQuery } from '@/hooks/useUnits'
import { useAuth } from '@/lib/auth'
import { notify } from '@/lib/feedback'
import type { OrgProfile, PeriodValue } from '@/types'
import ReportBody from '@/pages/reports/ReportBody'

const pad = (n: number) => String(n).padStart(2, '0')
const today = new Date()
const currentYear = today.getFullYear()
const currentMonth = today.getMonth() + 1

const REPORTS = [
  { key: 'laba-rugi', label: 'Laporan Laba Rugi', icon: ChartLine, needsRange: true },
  { key: 'perubahan-ekuitas', label: 'Laporan Perubahan Ekuitas', icon: TrendingUp, needsRange: true },
  { key: 'neraca', label: 'Laporan Posisi Keuangan (Neraca)', icon: Scale, needsRange: false },
  { key: 'arus-kas', label: 'Laporan Arus Kas', icon: Coins, needsRange: true },
  { key: 'calk', label: 'Catatan atas Laporan Keuangan (CaLK)', icon: BookOpen, needsRange: true },
] as const

export default function ReportsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const isPengelola = user?.role === 'pengelola'
  const isAdmin = user?.role === 'admin'

  const [period, setPeriod] = useState<PeriodValue>({
    mode: 'monthly',
    startDate: `${currentYear}-${pad(currentMonth)}-01`,
    endDate: `${currentYear}-${pad(currentMonth)}-${pad(new Date(currentYear, currentMonth, 0).getDate())}`,
    label: `Bulan ${currentMonth}/${currentYear}`,
  })
  const start = period.startDate
  const end = period.endDate
  const [tab, setTab] = useState<'laporan' | 'tutup-buku'>('laporan')
  const [active, setActive] = useState('laba-rugi')
  const [groupKey, setGroupKey] = useState('BUMDES')
  const unitsQ = useUnitsQuery(true)
  const units = unitsQ.data ?? []
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [bagiHasil, setBagiHasil] = useState<OrgProfile>({
    share_pengurus: 35,
    share_penasihat: 7,
    share_pengawas: 5,
    share_dana_sosial: 5,
    share_pades: 30,
    share_modal_bumdes: 18,
    share_unit_pengelola: 30,
    share_unit_bumdes: 70,
  })

  const [closeGroup, setCloseGroup] = useState('BUMDES')
  const [closeYear, setCloseYear] = useState(currentYear)
  const [closeMonth, setCloseMonth] = useState(currentMonth)
  const closePeriodKey = `${closeYear}-${pad(closeMonth)}`
  const [closedList, setClosedList] = useState<
    { period: string; group: string; laba_bersih?: number }[]
  >([])

  const [lockGroup, setLockGroup] = useState('ALL')
  const [lockPeriodKey, setLockPeriodKey] = useState(`${currentYear}-${pad(currentMonth)}`)
  const [lockedList, setLockedList] = useState<{ period: string; group: string }[]>([])

  useEffect(() => {
    fetchOrgProfile()
      .then((r) => setBagiHasil((b) => ({ ...b, ...r })))
      .catch(() => {})
  }, [])

  const loadClosed = () =>
    fetchClosedPeriods()
      .then((r) => setClosedList(r as { period: string; group: string; laba_bersih?: number }[]))
      .catch(() => {})
  const loadLocked = () =>
    fetchLockedPeriods()
      .then(setLockedList)
      .catch(() => {})
  useEffect(() => {
    if (isAdmin) {
      void loadClosed()
      void loadLocked()
    }
  }, [isAdmin])

  useEffect(() => {
    if (isPengelola && user?.unit_usaha_id && units.length) {
      const own = units.find((u) => u.id === user.unit_usaha_id)
      if (own) setGroupKey(own.code)
    }
  }, [isPengelola, user, units])

  const visibleReports =
    groupKey === 'BUMDES'
      ? [...REPORTS]
      : REPORTS.filter((r) => !['perubahan-ekuitas', 'calk'].includes(r.key))
  const cfg = visibleReports.find((r) => r.key === active) || visibleReports[0]

  useEffect(() => {
    if (groupKey !== 'BUMDES' && ['perubahan-ekuitas', 'calk'].includes(active)) {
      setActive('neraca')
      setData(null)
    }
  }, [groupKey, active])

  const groupOptions = useMemo(() => {
    const tabs = buildUnitGroupTabs(units)
    const list = tabs.map((t) => {
      if (t.key === 'BUMDES') return { code: 'BUMDES', name: 'Pusat', id: null as string | null }
      const u = units.find((unit) => unit.code === t.key)
      return { code: t.key, name: u?.name || t.key, id: u?.id || null }
    })
    return isPengelola
      ? list.filter((o) => o.code === units.find((u) => u.id === user?.unit_usaha_id)?.code)
      : list
  }, [units, isPengelola, user])

  const activeUnitId = useMemo(() => {
    if (groupKey === 'BUMDES') return null
    return units.find((u) => u.code === groupKey)?.id || null
  }, [groupKey, units])

  const load = async () => {
    setLoading(true)
    setData(null)
    try {
      if (cfg) {
        const params: Record<string, string | undefined> = cfg.needsRange
          ? { start_date: start, end_date: end }
          : { as_of_date: end }
        if (activeUnitId) params.unit_usaha_id = activeUnitId
        const r = (await fetchReport(cfg.key, params)) as Record<string, unknown>
        setData(r)
      }
    } catch (er) {
      notify(getApiError(er, 'Gagal memuat laporan'))
    } finally {
      setLoading(false)
    }
  }

  const download = async (kind: 'pdf' | 'excel' | 'word') => {
    if (!cfg) return
    const params: Record<string, string | undefined> = cfg.needsRange
      ? { start_date: start, end_date: end }
      : { as_of_date: end }
    if (activeUnitId) params.unit_usaha_id = activeUnitId
    const ext = kind === 'pdf' ? 'pdf' : kind === 'word' ? 'docx' : 'xlsx'
    try {
      await downloadReportFile(
        `/reports/${cfg.key}/${kind}`,
        params,
        `${cfg.key}_${groupKey}.${ext}`,
      )
    } catch {
      notify(`Gagal export ${kind.toUpperCase()}`)
    }
  }

  const doClose = async () => {
    if (
      !(await confirm({
        title: 'Tutup buku',
        description: `Tutup buku periode ${closePeriodKey} untuk ${closeGroup}?`,
        confirmLabel: 'Tutup buku',
        destructive: true,
      }))
    )
      return
    try {
      const r = await closePeriod(closePeriodKey, closeGroup)
      notify(
        `Berhasil ditutup. Jurnal dibuat: ${r.entries}. Laba bersih: Rp ${r.laba_bersih.toLocaleString('id-ID')}`,
      )
      void loadClosed()
    } catch (er) {
      notify(getApiError(er, 'Gagal tutup buku'))
    }
  }

  const doReopen = async (p: string, grp: string) => {
    if (
      !(await confirm({
        title: 'Batalkan tutup buku',
        description: `Batalkan tutup buku ${p} (${grp})?`,
        confirmLabel: 'Batalkan',
        destructive: true,
      }))
    )
      return
    try {
      await reopenPeriod(p, grp)
      void loadClosed()
    } catch (er) {
      notify(getApiError(er, 'Gagal batalkan'))
    }
  }

  const doLock = async () => {
    try {
      await lockPeriod(lockPeriodKey, lockGroup)
      notify(`Periode ${lockPeriodKey} (${lockGroup}) dikunci untuk non-admin.`)
      void loadLocked()
    } catch (er) {
      notify(getApiError(er, 'Gagal mengunci periode'))
    }
  }

  const doUnlock = async (p: string, grp: string) => {
    if (
      !(await confirm({
        title: 'Buka kunci periode',
        description: `Buka kunci periode ${p} (${grp})? Pengguna non-admin bisa menulis lagi.`,
        confirmLabel: 'Buka kunci',
        destructive: true,
      }))
    )
      return
    try {
      await unlockPeriod(p, grp)
      void loadLocked()
    } catch (er) {
      notify(getApiError(er, 'Gagal membuka kunci'))
    }
  }

  const labaBersih = parseMoney((data as { laba_bersih?: number | string } | null)?.laba_bersih)

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <p className="label mb-1">FINANCIAL STATEMENTS</p>
        <h1 className="font-heading page-h1 text-3xl font-bold">Laporan Keuangan</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {isPengelola
            ? 'Anda hanya dapat mengakses laporan unit usaha yang Anda kelola.'
            : isAdmin
              ? 'Dua tab: Laporan Keuangan (pilih kelompok BUMDES atau salah satu unit usaha) dan Tutup Buku.'
              : 'Laporan Keuangan — pilih kelompok BUMDES atau salah satu unit usaha.'}
        </p>
      </div>

      {isAdmin && (
        <div className="tab-strip flex flex-wrap gap-2" data-testid="reports-toplevel-tabs">
          <Button
            data-testid="tab-laporan"
            onClick={() => {
              setTab('laporan')
              setData(null)
            }}
            variant={tab === 'laporan' ? 'default' : 'outline'}
          >
            <Scale className="size-4" /> Laporan Keuangan
          </Button>
          <Button
            data-testid="tab-tutup-buku"
            onClick={() => setTab('tutup-buku')}
            variant={tab === 'tutup-buku' ? 'default' : 'outline'}
          >
            <Lock className="size-4" /> Tutup Buku
          </Button>
        </div>
      )}

      {tab === 'laporan' && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="label" htmlFor="report-group-select">
                  Kelompok
                </label>
                <Select
                  value={groupKey}
                  disabled={isPengelola}
                  onValueChange={(v) => {
                    setGroupKey(v)
                    setData(null)
                  }}
                >
                  <SelectTrigger id="report-group-select" data-testid="report-group-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groupOptions.map((o) => (
                      <SelectItem key={o.code} value={o.code}>
                        {o.code === 'BUMDES' ? 'BUMDES - Pusat' : `${o.code} - ${o.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="report-period-filter">
                  Periode
                </label>
                <PeriodFilter
                  value={period}
                  onChange={(next) => {
                    setPeriod(next)
                    setData(null)
                  }}
                  defaultMode="monthly"
                  data-testid="report-period-filter"
                  className="w-full"
                />
              </div>
              <div>
                <label className="label" htmlFor="report-type-select">
                  Jenis Laporan Keuangan
                </label>
                <Select
                  value={active}
                  onValueChange={(v) => {
                    setActive(v)
                    setData(null)
                  }}
                >
                  <SelectTrigger id="report-type-select" data-testid="report-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleReports.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                data-testid="btn-load-report"
                onClick={() => void load()}
                className="w-full sm:w-auto"
              >
                {loading ? <Spinner size={18} label="Memuat..." /> : 'Tampilkan Laporan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'laporan' && data && cfg && (
        <Card className="fade-in">
          <CardContent className="pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading text-xl font-semibold">
                {cfg.label}
                <Badge className="ml-2">{groupKey}</Badge>
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" data-testid="btn-export-pdf" onClick={() => void download('pdf')}>
                  <FileText className="size-4 text-destructive" /> Export PDF
                </Button>
                <Button
                  variant="outline"
                  data-testid="btn-export-excel"
                  onClick={() => void download('excel')}
                >
                  <FileSpreadsheet className="size-4" /> Export Excel
                </Button>
                <Button
                  variant="outline"
                  data-testid="btn-export-word"
                  onClick={() => void download('word')}
                >
                  <FileText className="size-4" /> Export Word
                </Button>
              </div>
            </div>
            <ReportBody active={active} data={data} />
            {active === 'laba-rugi' && activeUnitId && (
              <div
                className="mt-6 rounded-lg p-4"
                data-testid="bagi-hasil-info"
                style={{ background: 'var(--primary-light)', border: '1px solid var(--legacy-border)' }}
              >
                <h4 className="font-heading mb-2 font-semibold" style={{ color: 'var(--primary-dark)' }}>
                  Alokasi Bagi Hasil Unit Usaha {groupKey}:
                </h4>
                <ol className="ml-5 list-decimal space-y-1 text-sm">
                  <li>
                    Pengelola Unit ({bagiHasil.share_unit_pengelola}%) ={' '}
                    <b data-testid="share-pengelola">
                      {fmtRp(Math.round((labaBersih * Number(bagiHasil.share_unit_pengelola || 0)) / 100))}
                    </b>
                  </li>
                  <li>
                    BUMDES ({bagiHasil.share_unit_bumdes}%) ={' '}
                    <b data-testid="share-bumdes">
                      {fmtRp(Math.round((labaBersih * Number(bagiHasil.share_unit_bumdes || 0)) / 100))}
                    </b>
                  </li>
                </ol>
              </div>
            )}
            {active === 'laba-rugi' && !activeUnitId && !isPengelola && (
              <div
                className="mt-6 rounded-lg p-4"
                data-testid="alokasi-bumdes-info"
                style={{ background: 'var(--primary-light)', border: '1px solid var(--legacy-border)' }}
              >
                <h4 className="font-heading mb-2 font-semibold" style={{ color: 'var(--primary-dark)' }}>
                  Alokasi Bagi Hasil Usaha BUMDES:
                </h4>
                <ol className="ml-5 list-decimal space-y-1 text-sm">
                  {(
                    [
                      ['PADes', bagiHasil.share_pades],
                      ['Modal BUMDES', bagiHasil.share_modal_bumdes],
                      ['Penasihat', bagiHasil.share_penasihat],
                      ['Pengawas', bagiHasil.share_pengawas],
                      ['Pengurus', bagiHasil.share_pengurus],
                      ['Dana Sosial', bagiHasil.share_dana_sosial],
                    ] as const
                  ).map(([label, pct]) => (
                    <li key={label}>
                      {label} ({pct}%) ={' '}
                      <b>{fmtRp(Math.round((labaBersih * Number(pct || 0)) / 100))}</b>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'tutup-buku' && isAdmin && (
        <Card data-testid="close-period-card">
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="size-5 text-amber-500" />
              <h3 className="font-heading font-semibold">Tutup Buku</h3>
            </div>
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Generate jurnal penutup fisik untuk 1 grup 1 periode. BUMDES maupun unit usaha tutup
              buku <b>bulanan</b>.
            </p>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-5">
              <div>
                <label className="label">Kelompok</label>
                <Select value={closeGroup} onValueChange={setCloseGroup}>
                  <SelectTrigger data-testid="close-group-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUMDES">BUMDES</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.code} value={u.code}>
                        {u.code} - {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label">Periode</label>
                <Input
                  type="month"
                  data-testid="close-period-input"
                  value={`${closeYear}-${pad(closeMonth)}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-')
                    setCloseYear(Number(y))
                    setCloseMonth(Number(m))
                  }}
                />
              </div>
              <Button data-testid="btn-close-period" onClick={() => void doClose()}>
                <Lock className="size-4" /> Tutup Buku
              </Button>
            </div>
            <div className="mt-6">
              <p className="label mb-2">Periode Sudah Ditutup ({closedList.length})</p>
              <TableShell minWidth={520}>
                <Table data-testid="closed-periods-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periode</TableHead>
                      <TableHead>Kelompok</TableHead>
                      <TableHead className="num">Laba Bersih</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closedList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          Belum ada periode yang ditutup.
                        </TableCell>
                      </TableRow>
                    ) : (
                      closedList.map((c) => (
                        <TableRow key={c.period + c.group}>
                          <TableCell className="font-medium">{c.period}</TableCell>
                          <TableCell>
                            <Badge>{c.group}</Badge>
                          </TableCell>
                          <TableCell className="num">{fmtRp(c.laba_bersih || 0)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              data-testid={`reopen-${c.period}-${c.group}`}
                              onClick={() => void doReopen(c.period, c.group)}
                            >
                              Batalkan
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableShell>
            </div>
            <div className="mt-8 border-t pt-6" data-testid="lock-period-section">
              <div className="mb-3 flex items-center gap-2">
                <Lock className="size-5 text-sky-500" />
                <h3 className="font-heading font-semibold">Kunci Periode</h3>
              </div>
              <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                Pengguna non-admin tidak bisa tambah/ubah/hapus transaksi di periode yang dikunci.
                Admin masih bisa mengoreksi. Lakukan ini sebelum Tutup Buku.
              </p>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-5">
                <div>
                  <label className="label">Kelompok</label>
                  <Select value={lockGroup} onValueChange={setLockGroup}>
                    <SelectTrigger data-testid="lock-group-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Semua kelompok</SelectItem>
                      <SelectItem value="BUMDES">BUMDES</SelectItem>
                      {units.map((u) => (
                        <SelectItem key={u.code} value={u.code}>
                          {u.code} - {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="label">Periode</label>
                  <Input
                    type="month"
                    data-testid="lock-period-input"
                    value={lockPeriodKey}
                    onChange={(e) => setLockPeriodKey(e.target.value)}
                  />
                </div>
                <Button data-testid="btn-lock-period" onClick={() => void doLock()}>
                  <Lock className="size-4" /> Kunci
                </Button>
              </div>
              <div className="mt-4">
                <p className="label mb-2">Periode Dikunci ({lockedList.length})</p>
                {lockedList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada periode yang dikunci.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {lockedList.map((l) => (
                      <span
                        key={l.period + l.group}
                        className="inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-sm"
                      >
                        {l.period} <Badge>{l.group}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          data-testid={`unlock-${l.period}-${l.group}`}
                          onClick={() => void doUnlock(l.period, l.group)}
                        >
                          Buka
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
