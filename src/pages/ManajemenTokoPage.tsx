import { Fragment, useMemo, useState, type FormEvent } from 'react'
import HelpHint from '@/components/HelpHint'
import EmptyCellDash, { EMPTY_CELL_DASH } from '@/components/EmptyCellDash'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Database, Download, FileBarChart, Plus, Receipt, Trash2 } from 'lucide-react'
import api, { getApiError, parseMoney } from '@/api/client'
import { triggerBlobDownload } from '@/api/transactions'
import { useAuth } from '@/lib/auth'
import { useUnitsQuery } from '@/hooks/useUnits'
import { notify } from '@/lib/feedback'
import { useSort } from '@/lib/useSort'
import { useConfirm } from '@/components/ConfirmProvider'
import { TOKO_UNIT_CODE } from '@/config/roles'
import TableShell from '@/components/TableShell'
import Spinner from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DEFAULT_DATA_ROWS,
  DEFAULT_TX_ROWS,
  WEEKS,
  buildTxRows,
  buildTradeRows,
  tradeWeekLabel,
  type TradeRecord,
  currentPeriod,
  defaultWeekDate,
  isFreeWeek,
  validateEntryDate,
  emptyTxRow,
  fmtNumber,
  txTotals,
  type TokoEntry,
  type TokoItem,
  type TokoJenis,
  type TxRow,
  buildJournalRows,
  buildSkuStockRows,
  type StockMoveRec,
  weekCount,
  type JournalRec,
  kasFlowLines,
  weeklyFlowRows,
  type FlowRow,
  STOK_FLOW,
  diffNoteItems,
  type Suspect,
  type KasDetail,
  weekEnd,
  weekStart,
} from '@/lib/toko'
import PageHeader from '@/components/typography/PageHeader'
import SectionTitle from '@/components/typography/SectionTitle'

const tableClass = 'toko-table [&_th]:h-auto [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-2'
/** Lebar kolom sama untuk Pemasukan & Pengeluaran agar Minggu/Jumlah sejajar saat ditumpuk. */
const TX_TABLE_MIN_WIDTH = 980
const TX_COL = { no: 56, uraian: 200, week: 120, jumlah: 124 } as const
const headerClass = 'bg-muted [&_th]:text-foreground [&_tr:hover]:bg-transparent'
const HINT_A11Y = 'Klik untuk input'
const LOCKED_HINT = 'Tidak dapat dihapus: baris ini sudah memiliki nominal di tab Catatan Toko. Hapus isian nominalnya dulu.'
const JENIS_LABEL: Record<TokoJenis, string> = { pemasukan: 'Pemasukan', pengeluaran: 'Pengeluaran' }

/** Placeholder samar untuk sel kosong; aksesibilitas lewat aria-label/title. */
function Hint({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label || HINT_A11Y} title={HINT_A11Y}
      className="no-underline hover:text-muted-foreground">
      <EmptyCellDash />
    </button>
  )
}

type CellTarget = { item: TokoItem; week: number; entry?: TokoEntry }

export default function ManajemenTokoPage() {
  const { user } = useAuth()
  const { data: units, isLoading: unitsLoading } = useUnitsQuery(true)
  const unit = units?.find((u) => u.code === TOKO_UNIT_CODE)
  const allowed = user?.role !== 'pengelola' || (!!unit && user.unit_usaha_id === unit.id)
  const [tab, setTab] = useState<'transaksi' | 'data' | 'otomatis' | 'labarugi'>('transaksi')
  const [period, setPeriod] = useState(currentPeriod)
  const [cell, setCell] = useState<CellTarget | null>(null)
  const queryClient = useQueryClient()

  const itemsQuery = useQuery({
    queryKey: ['toko', 'items'],
    enabled: allowed,
    queryFn: async () => (await api.get<TokoItem[]>('/v1/toko/items')).data,
  })
  const entriesQuery = useQuery({
    queryKey: ['toko', 'entries', period],
    enabled: allowed,
    queryFn: async () => (await api.get<TokoEntry[]>('/v1/toko/entries', { params: { period } })).data,
  })
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['toko'] }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  ])

  if (user?.role === 'pengelola' && unitsLoading) return <Spinner label="Memeriksa akses unit..." />
  if (!allowed) return <p role="alert">Manajemen Toko hanya untuk pengelola unit 5.</p>
  const error = itemsQuery.error || entriesQuery.error

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <p className="label mb-1">Unit Usaha UU05 : Karya Raharja Store (KRS)</p>
        <PageHeader title={<>Manajemen Toko</>} hintLabel="Tentang Manajemen Toko" hint={<><p>Uraian diambil dari tab Data (tabel Uraian Pemasukan / Uraian Pengeluaran). Klik sel Minggu untuk mengisi tanggal dan nominal.</p><p>Setiap nominal otomatis tercatat sebagai transaksi Unit 5; bukti diunggah dari halaman Transaksi.</p></>} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="toko-period">Periode</Label>
        <Input id="toko-period" type="month" className="w-44" value={period}
          onChange={(e) => e.target.value && setPeriod(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tab Manajemen Toko">
        {([{ id: 'transaksi', label: 'Catatan Toko', icon: ClipboardList }, { id: 'otomatis', label: 'Catatan Gudang', icon: Receipt }, { id: 'labarugi', label: 'Laporan', icon: FileBarChart }, { id: 'data', label: 'Data', icon: Database }] as const).map((t) => {
          const Icon = t.icon
          return (
            <Button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`toko-panel-${t.id}`}
              id={`toko-tab-${t.id}`} variant={tab === t.id ? 'default' : 'outline'} size="sm" onClick={() => setTab(t.id)}>
              <Icon size={16} />{t.label}
            </Button>
          )
        })}
      </div>
      {error ? (
        <div role="alert" className="space-y-2"><p>{getApiError(error)}</p><Button onClick={() => void refresh()}>Coba lagi</Button></div>
      ) : itemsQuery.isLoading ? <Spinner label="Memuat data toko..." /> : (
        <>
          <section hidden={tab !== 'transaksi'} role="tabpanel" id="toko-panel-transaksi" aria-labelledby="toko-tab-transaksi" className="min-w-0 space-y-6">
            {(['pemasukan', 'pengeluaran'] as const).map((jenis) => (
              <TxTable key={jenis} jenis={jenis} items={items} entries={entries}
                onCell={setCell} onEmptyUraian={() => { setTab('data'); notify('Isi Nama Baris di tab Data untuk menambah uraian.') }} />
            ))}
            {tab === 'transaksi' && <JournalSection period={period} />}
          </section>
          <section hidden={tab !== 'otomatis'} role="tabpanel" id="toko-panel-otomatis" aria-labelledby="toko-tab-otomatis" className="min-w-0 space-y-6">
            {tab === 'otomatis' && <AutoTables period={period} />}
          </section>
          <section hidden={tab !== 'labarugi'} role="tabpanel" id="toko-panel-labarugi" aria-labelledby="toko-tab-labarugi" className="min-w-0 space-y-6">
            {tab === 'labarugi' && <LabaRugi period={period} />}
          </section>
          <section hidden={tab !== 'data'} role="tabpanel" id="toko-panel-data" aria-labelledby="toko-tab-data" className="min-w-0 space-y-3">
            <HelpHint label="Tentang tab Data">Isi Nama Baris di tabel Uraian Pemasukan atau Uraian Pengeluaran; baris otomatis tampil sebagai Uraian di tabel Pemasukan/Pengeluaran Catatan Toko.</HelpHint>
            {(['pemasukan', 'pengeluaran'] as const).map((jenis) => (
              <DataTable key={jenis} jenis={jenis} items={items.filter((it) => it.jenis === jenis)} onChanged={refresh} />
            ))}
          </section>
        </>
      )}
      {cell && <EntryDialog target={cell} period={period} onClose={() => setCell(null)} onSaved={async () => { setCell(null); await refresh() }} />}
    </div>
  )
}

const INV = '/v1/uu05_inventory'
type SaleRec = { id: string; customer_name: string | null; total_amount: string; created_at: string | null; transaction_date?: string | null }
type PurchaseRec = { id: string; vendor_name: string | null; payment_method: string; total_amount: string; created_at: string | null; transaction_date?: string | null }

function useTradeRows(period: string) {
  const sales = useQuery({ queryKey: ['toko', 'auto-sales'], queryFn: async () => (await api.get<SaleRec[]>(`${INV}/sales`, { params: { limit: 500 } })).data })
  const purchases = useQuery({ queryKey: ['toko', 'auto-purchases'], queryFn: async () => (await api.get<PurchaseRec[]>(`${INV}/purchases`, { params: { limit: 500 } })).data })
  const inRows = useMemo(() => buildTradeRows((sales.data ?? []).map((s): TradeRecord => ({ ...s, name: s.customer_name })), period), [sales.data, period])
  const outRows = useMemo(() => buildTradeRows((purchases.data ?? []).filter((p) => p.payment_method !== 'modal_awal')
    .map((p): TradeRecord => ({ ...p, name: p.vendor_name })), period), [purchases.data, period])
  return { sales, purchases, inRows, outRows }
}

function useJournal(period: string) {
  return useQuery({
    queryKey: ['toko', 'journal', period],
    queryFn: async () => (await api.get<JournalRec[]>('/v1/toko/journal', { params: { period } })).data,
  })
}

function JournalSection({ period }: { period: string }) {
  return (
    <>
      <JournalTable period={period} title="Pemasukan dari menu Transaksi" keep={(r) => r.jenis === 'pemasukan'} />
      <JournalTable period={period} title="Pengeluaran dari menu Transaksi" keep={(r) => r.jenis === 'pengeluaran'} />
      <JournalSkipped period={period} />
    </>
  )
}

function JournalSkipped({ period }: { period: string }) {
  const q = useJournal(period)
  const skipped = (q.data ?? []).filter((r) => !r.counted)
  if (!skipped.length) return null
  return (
    <p className="text-sm text-muted-foreground">
      {skipped.length} transaksi Unit 5 dari menu Transaksi tidak dihitung karena akunnya bukan Kas, Piutang, Utang, Persediaan, Pendapatan, atau Beban:{' '}
      {skipped.map((r) => r.keterangan || `${r.debit.name} / ${r.credit.name}`).join('; ')}.
    </p>
  )
}

/** Tabel baca-saja transaksi manual menu Transaksi (Unit 5); ubah/hapus dari halaman Transaksi. */
function JournalTable({ period, title, keep }: { period: string; title: string; keep: (r: JournalRec) => boolean }) {
  const q = useJournal(period)
  const rows = useMemo(() => buildJournalRows(q.data ?? [], period, keep), [q.data, period, keep])
  if (q.error) return <p role="alert">{getApiError(q.error)}</p>
  if (q.isLoading || !rows.length) return null
  const keys = ['w1', 'w2', 'w3', 'w4', 'w5', 'jumlah'] as const
  const tot = txTotals(rows)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <SectionTitle>{title}</SectionTitle>
        <HelpHint label={`Tentang ${title}`}>Transaksi Unit 5 yang dicatat langsung di menu Transaksi (bukan dari Catatan Toko atau stok). Ubah atau hapus dari halaman Transaksi.</HelpHint>
      </div>
      <Card className="overflow-hidden p-0"><TableShell minWidth={TX_TABLE_MIN_WIDTH} label={title}><Table className={`${tableClass} table-fixed`}>
        <colgroup>
          <col style={{ width: TX_COL.no }} />
          <col style={{ width: TX_COL.uraian }} />
          {WEEKS.map((w) => <col key={w} style={{ width: TX_COL.week }} />)}
          <col style={{ width: TX_COL.jumlah }} />
        </colgroup>
        <TableHeader className={headerClass}><TableRow>
          <TableHead>No.</TableHead>
          <TableHead className="col-name">Uraian</TableHead>
          {WEEKS.map((w) => <TableHead key={w} className="text-right whitespace-nowrap tabular-nums">Minggu ke-{w}</TableHead>)}
          <TableHead className="text-right whitespace-nowrap tabular-nums">Jumlah</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.key}>
              <TableCell>{i + 1}</TableCell>
              <TableCell className="min-w-0 whitespace-normal break-words" title={`${r.uraian} (dari menu Transaksi)`}>{r.uraian} <span className="text-xs text-muted-foreground">(Transaksi)</span></TableCell>
              {keys.map((k) => <TableCell key={k} className="text-right whitespace-nowrap tabular-nums">{r[k] != null && r[k] !== 0 ? fmtNumber(r[k] as number) : <EmptyCellDash />}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t bg-muted/50 font-semibold"><TableRow>
          <TableCell colSpan={2}>Jumlah</TableCell>
          {keys.map((k) => <TableCell key={k} className="text-right whitespace-nowrap tabular-nums">{fmtNumber(tot[k])}</TableCell>)}
        </TableRow></tfoot>
      </Table></TableShell></Card>
    </div>
  )
}

type WeekVals = { w1: number; w2: number; w3: number; w4: number; w5: number; jumlah: number }

type GlPos = {
  date: string; kas: string; stok: string; piutang: string; piutang_lainnya: string; utang: string; modal: string
  laba_lalu: string; laba_berjalan: string; kas_detail?: KasDetail; stok_detail?: Record<string, string>
  pembanding?: Record<string, string>; manual_suspects?: Record<string, Suspect[]>
}
type GlResp = {
  period: string; laba_rugi: Record<string, Record<string, string>>; positions: GlPos[]
  kas_opening?: { date: string; ditetapkan: string; gl: string }; stok_manajemen?: string
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtTgl = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

/** Laporan dari menu Transaksi: Laba Rugi mingguan + posisi Neraca akhir tiap minggu (Minggu). */
function useGl(period: string) {
  const ends = useMemo(() => WEEKS.map((w) => weekEnd(period, w)), [period])
  return useQuery({
    queryKey: ['toko', 'gl', period, ends],
    queryFn: async () => (await api.get<GlResp>('/v1/toko/gl', { params: { period, dates: ends }, paramsSerializer: { indexes: null } })).data,
  })
}

/** Minggu yang sudah sampai hari Sabtu-nya (Sabtu <= hari ini, waktu lokal). */
function saturdayWeeks(period: string): Set<string> {
  const today = isoDate(new Date())
  const set = new Set<string>()
  WEEKS.forEach((w) => {
    const [y, m, d] = weekEnd(period, w).split('-').map(Number)
    if (isoDate(new Date(y, m - 1, d - 1)) <= today) set.add(`w${w}`)
  })
  return set
}

/** Minggu yang sudah dimulai (Senin <= hari ini) dan ada di periode. */
function startedWeeks(period: string): Set<string> {
  const today = isoDate(new Date())
  const set = new Set<string>()
  WEEKS.forEach((w) => {
    if (!isFreeWeek(period, w) && weekStart(period, w) <= today) set.add(`w${w}`)
  })
  if (set.size) set.add('jumlah')
  return set
}

function LabaRugi({ period }: { period: string }) {
  const q = useGl(period)
  if (q.error) return <p role="alert">{getApiError(q.error)}</p>
  if (q.isLoading || !q.data) return <Spinner label="Memuat laporan..." />
  const keys = ['w1', 'w2', 'w3', 'w4', 'w5', 'jumlah'] as const
  const row = (name: string): WeekVals => Object.fromEntries(keys.map((k) => [k, parseMoney(q.data.laba_rugi[name]?.[k] ?? '0')])) as WeekVals
  const add = (...vs: WeekVals[]): WeekVals => Object.fromEntries(keys.map((k) => [k, vs.reduce((t, v) => t + v[k], 0)])) as WeekVals
  const saldo = row('saldo'), jual = row('jual'), lain = row('lain'), trxIn = row('trx_in')
  const umum = row('umum'), hpp = row('hpp'), internal = row('internal'), trxOut = row('trx_out')
  const totalIn = add(saldo, jual, lain, trxIn)
  const totalOut = add(umum, hpp, internal, trxOut)
  const laba = Object.fromEntries(keys.map((k) => [k, totalIn[k] - totalOut[k]])) as WeekVals
  type Line = { no?: number; label: string; v: WeekVals; strong?: boolean }
  const lines: Line[] = [
    { no: 1, label: 'Pemasukan Toko', v: saldo },
    { no: 2, label: 'Pemasukan Penjualan Stok', v: jual },
    { no: 3, label: 'Pemasukan Lainnya', v: lain },
    { no: 4, label: 'Pemasukan dari menu Transaksi', v: trxIn },
    { label: 'TOTAL PEMASUKAN', v: totalIn, strong: true },
    { no: 5, label: 'Pengeluaran Umum', v: umum },
    { no: 6, label: 'HPP Penjualan', v: hpp },
    { no: 7, label: 'Penjualan Internal', v: internal },
    { no: 8, label: 'Pengeluaran dari menu Transaksi', v: trxOut },
    { label: 'TOTAL PENGELUARAN', v: totalOut, strong: true },
  ]
  const money = (n: number) => (n < 0 ? `(${fmtNumber(-n)})` : fmtNumber(n))
  // Kolom minggu Laba Rugi tampil mulai hari Sabtu minggu itu, atau lebih awal bila sudah berisi.
  const hasData = (k: string) => lines.some((l) => l.v[k as keyof WeekVals] !== 0)
  const started = new Set<string>([...saturdayWeeks(period), ...WEEKS.map((w) => `w${w}`).filter(hasData)])
  if (started.size) started.add('jumlah')
  return (
    <div className="space-y-2">
      <ArusSection period={period} />
      <div className="flex items-center gap-1 pt-4">
        <SectionTitle>Laporan Laba Rugi</SectionTitle>
        <HelpHint label="Tentang Laporan Laba Rugi">Dari jurnal Unit 5 di menu Transaksi (otomatis dari Catatan Toko dan Manajemen Gudang, serta transaksi manual) yang memakai akun Pendapatan, Beban, atau HPP; per minggu Senin–Sabtu. Jurnal penutup, bagi hasil, dan imbal hasil tidak dihitung. Negatif: merah dalam kurung.</HelpHint>
      </div>
      <Card className="overflow-hidden p-0"><TableShell minWidth={TX_TABLE_MIN_WIDTH} label="Tabel Laporan Laba Rugi"><Table className={`${tableClass} table-fixed`}>
        <colgroup>
          <col style={{ width: TX_COL.no }} />
          <col style={{ width: TX_COL.uraian }} />
          {WEEKS.map((w) => <col key={w} style={{ width: TX_COL.week }} />)}
          <col style={{ width: TX_COL.jumlah }} />
        </colgroup>
        <TableHeader className={headerClass}><TableRow>
          <TableHead>No.</TableHead>
          <TableHead className="col-name">Uraian</TableHead>
          {WEEKS.map((w) => <TableHead key={w} className="text-right whitespace-nowrap tabular-nums">Minggu ke-{w}</TableHead>)}
          <TableHead className="text-right whitespace-nowrap tabular-nums">Jumlah</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {lines.map((l) => (
            <TableRow key={l.label} className={l.strong ? 'border-t bg-muted/50 font-semibold' : undefined}>
              <TableCell>{l.no ?? ''}</TableCell>
              <TableCell className="min-w-0 whitespace-normal break-words" title={l.label}>{l.label}</TableCell>
              {keys.map((k) => (
                <TableCell key={k} className={`text-right whitespace-nowrap tabular-nums${l.v[k] < 0 ? ' text-destructive' : ''}`}>{started.has(k) ? money(l.v[k]) : <EmptyCellDash />}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t bg-muted/50 font-semibold"><TableRow>
          <TableCell colSpan={2}>LABA/RUGI BERSIH</TableCell>
          {keys.map((k) => (
            <TableCell key={k} className={`text-right whitespace-nowrap tabular-nums${laba[k] < 0 ? ' text-destructive' : ''}`}>{started.has(k) ? money(laba[k]) : <EmptyCellDash />}</TableCell>
          ))}
        </TableRow></tfoot>
      </Table></TableShell></Card>
      <Neraca period={period} />
    </div>
  )
}

function Neraca({ period }: { period: string }) {
  const q = useGl(period)
  const started = useMemo(() => startedWeeks(period), [period])
  const lastKey = (['w5', 'w4', 'w3', 'w2', 'w1'] as const).find((k) => started.has(k)) ?? 'w5'
  if (q.error) return <p role="alert">{getApiError(q.error)}</p>
  if (q.isLoading || !q.data) return <Spinner label="Memuat neraca..." />
  const pos = q.data.positions
  const keys = ['w1', 'w2', 'w3', 'w4', 'w5'] as const
  const blank = (): WeekVals => ({ w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, jumlah: 0 })
  const kas = blank(), stokV = blank(), piutang = blank(), piutangLain = blank(), utang = blank(), lalu = blank(), lr = blank(), modal = blank()
  keys.forEach((k, i) => {
    const p = pos[i]
    if (!p) return
    kas[k] = parseMoney(p.kas)
    stokV[k] = parseMoney(p.stok)
    piutang[k] = parseMoney(p.piutang)
    piutangLain[k] = parseMoney(p.piutang_lainnya)
    utang[k] = parseMoney(p.utang)
    modal[k] = parseMoney(p.modal)
    lalu[k] = parseMoney(p.laba_lalu)
    lr[k] = parseMoney(p.laba_berjalan)
  })
  // Posisi neraca: Jumlah = posisi akhir minggu terakhir.
  for (const v of [kas, stokV, piutang, piutangLain, utang, lalu, lr, modal]) v.jumlah = v[lastKey]
  const all = ['w1', 'w2', 'w3', 'w4', 'w5', 'jumlah'] as const
  const sum = (...vs: WeekVals[]): WeekVals => Object.fromEntries(all.map((k) => [k, vs.reduce((t, v) => t + v[k], 0)])) as WeekVals
  const totalAset = sum(kas, stokV, piutang, piutangLain)
  const totalUtang = sum(utang)
  const totalEkuitas = sum(modal, lalu, lr)
  const totalPasiva = sum(totalUtang, totalEkuitas)
  type Line = { no?: number; label: string; v?: WeekVals; kind?: 'head' | 'total'; warn?: boolean }
  const lines: Line[] = [
    { label: 'ASET', kind: 'head' },
    { no: 1, label: 'Kas / Bank', v: kas, warn: true },
    { no: 2, label: 'Stok Barang', v: stokV },
    { no: 3, label: 'Piutang Usaha', v: piutang },
    { no: 4, label: 'Piutang Lainnya', v: piutangLain },
    { label: 'TOTAL ASET', v: totalAset, kind: 'total' },
    { label: 'KEWAJIBAN/UTANG', kind: 'head' },
    { no: 5, label: 'Utang Usaha', v: utang },
    { label: 'TOTAL KEWAJIBAN/UTANG', v: totalUtang, kind: 'total' },
    { label: 'EKUITAS', kind: 'head' },
    { no: 6, label: 'Modal BUMDes', v: modal },
    { no: 7, label: 'Laba/Rugi Periode Lalu', v: lalu },
    { no: 8, label: 'Laba/Rugi Periode Berjalan', v: lr },
    { label: 'TOTAL EKUITAS', v: totalEkuitas, kind: 'total' },
  ]
  const money = (n: number) => (n < 0 ? `(${fmtNumber(-n)})` : fmtNumber(n))
  const cell = (n: number) => <span className={n < 0 ? 'text-destructive' : undefined}>{money(n)}</span>
  const last = pos[keys.indexOf(lastKey as typeof keys[number])]
  return (
    <div className="space-y-2 pt-4">
      <div className="flex items-center gap-1">
        <SectionTitle>Neraca</SectionTitle>
        <HelpHint label="Tentang Neraca">Saldo akun Unit 5 di menu Transaksi (termasuk jurnal otomatis) per akhir tiap minggu; Jumlah = posisi minggu terakhir yang sudah berjalan. Minggu tampil sejak hari Senin-nya, apa adanya walau belum seimbang. Kas/Bank = saldo awal Rp 2.124.500 per 30 Sep 2026 + pergerakan Kas sejak 1 Okt 2026. Laba/Rugi Periode Lalu = akun Pendapatan/Beban/HPP sejak 1 Okt 2026 (saldo awal laba ditahan per 30 Sep 2026 = 0) s.d. sebelum Minggu ke-1 bulan ini, dikurangi bagi hasil yang dibayar; Periode Berjalan = sejak Minggu ke-1. Kas ditandai merah: perlu diverifikasi dengan saldo kas riil.</HelpHint>
      </div>
      <Card className="overflow-hidden p-0"><TableShell minWidth={TX_TABLE_MIN_WIDTH} label="Tabel Neraca"><Table className={`${tableClass} table-fixed`}>
        <colgroup>
          <col style={{ width: TX_COL.no }} />
          <col style={{ width: TX_COL.uraian }} />
          {WEEKS.map((w) => <col key={w} style={{ width: TX_COL.week }} />)}
          <col style={{ width: TX_COL.jumlah }} />
        </colgroup>
        <TableHeader className={headerClass}><TableRow>
          <TableHead>No.</TableHead>
          <TableHead className="col-name">Uraian</TableHead>
          {WEEKS.map((w) => <TableHead key={w} className="text-right whitespace-nowrap tabular-nums">Minggu ke-{w}</TableHead>)}
          <TableHead className="text-right whitespace-nowrap tabular-nums">Jumlah</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {lines.map((l) => (
            <TableRow key={l.label} className={l.kind === 'total' ? 'border-t bg-muted/50 font-semibold' : l.kind === 'head' ? 'font-semibold' : undefined}>
              <TableCell>{l.no ?? ''}</TableCell>
              <TableCell className="min-w-0 whitespace-normal break-words" title={l.warn ? `${l.label} (perlu diverifikasi dengan saldo kas riil)` : l.label}><span className={l.warn ? 'text-destructive' : undefined}>{l.label}</span></TableCell>
              {all.map((k) => (
                <TableCell key={k} className="text-right whitespace-nowrap tabular-nums">
                  {l.kind === 'head' ? '' : l.v && started.has(k) ? (l.warn ? <span className="font-semibold text-destructive">{money(l.v[k])}</span> : cell(l.v[k])) : <EmptyCellDash />}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t bg-muted/50 font-semibold"><TableRow>
          <TableCell colSpan={2} className="whitespace-normal break-words">TOTAL KEWAJIBAN/UTANG + EKUITAS</TableCell>
          {all.map((k) => <TableCell key={k} className="text-right whitespace-nowrap tabular-nums">{started.has(k) ? cell(totalPasiva[k]) : <EmptyCellDash />}</TableCell>)}
        </TableRow>
        <TableRow className="bg-card font-normal hover:bg-card">
          <TableCell colSpan={2} className="font-semibold">Status Neraca</TableCell>
          {all.map((k) => {
            if (!started.has(k)) return <TableCell key={k} />
            const ok = Math.abs(totalAset[k] - totalPasiva[k]) < 0.5
            return <TableCell key={k} className={`tabular-nums text-right whitespace-nowrap font-semibold ${ok ? 'text-emerald-600' : 'text-destructive'}`}>{ok ? 'Seimbang' : 'Tidak Seimbang'}</TableCell>
          })}
        </TableRow></tfoot>
      </Table></TableShell></Card>
      {started.size > 0 && <DiffNote pos={last} />}
    </div>
  )
}

/** Laporan Arus Kas & Arus Stok (di atas Laporan Laba Rugi). */
function ArusSection({ period }: { period: string }) {
  const q = useGl(period)
  const started = useMemo(() => startedWeeks(period), [period])
  if (!q.data || !started.size) return null
  const keys = ['w1', 'w2', 'w3', 'w4', 'w5'] as const
  const pos = keys.map((k, i) => (started.has(k) ? q.data.positions[i] : undefined))
  const last = [...pos].reverse().find(Boolean)
  return (
    <div className="space-y-4">
      <KasNote pos={pos} opening={q.data.kas_opening} />
      <StokNote pos={pos} last={last} />
    </div>
  )
}

/** Tabel mingguan laporan arus (gaya sama dengan tabel mingguan lain). */
function WeeklyNoteTable({ label, rows }: { label: string; rows: FlowRow[] }) {
  const money = (n: number) => (n < 0 ? `(${fmtNumber(-Math.round(n))})` : fmtNumber(Math.round(n)))
  return (
    <Card className="overflow-hidden p-0"><TableShell minWidth={TX_TABLE_MIN_WIDTH} label={label}><Table className={`${tableClass} table-fixed`}>
      <colgroup>
        <col style={{ width: TX_COL.no }} />
        <col style={{ width: TX_COL.uraian }} />
        {WEEKS.map((w) => <col key={w} style={{ width: TX_COL.week }} />)}
        <col style={{ width: TX_COL.jumlah }} />
      </colgroup>
      <TableHeader className={headerClass}><TableRow>
        <TableHead>No.</TableHead>
        <TableHead className="col-name">Uraian</TableHead>
        {WEEKS.map((w) => <TableHead key={w} className="text-right whitespace-nowrap tabular-nums">Minggu ke-{w}</TableHead>)}
        <TableHead className="text-right whitespace-nowrap tabular-nums">Jumlah</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={`${i}-${r.label}`} className={r.kind === 'saldo' ? 'bg-muted/50 font-semibold' : r.kind === 'subtotal' ? 'border-t font-semibold' : r.kind === 'head' ? 'font-semibold' : undefined}>
            <TableCell>{r.kind === 'detail' ? rows.slice(0, i + 1).filter((x) => x.kind === 'detail').length : ''}</TableCell>
            <TableCell className="min-w-0 whitespace-normal break-words" title={r.label}>{r.label}</TableCell>
            {[...r.w, r.jumlah].map((v, k) => (
              <TableCell key={k} className={`text-right whitespace-nowrap tabular-nums${v != null && v < 0 ? ' text-destructive' : ''}`}>{v == null ? (r.kind === 'head' ? '' : <EmptyCellDash />) : money(v)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table></TableShell></Card>
  )
}

/** Catatan di bawah Neraca: pergerakan Kas (jurnal menu Transaksi) per minggu; Jumlah = s.d. minggu terakhir yang tampil. */
function KasNote({ pos, opening }: { pos: (GlPos | undefined)[]; opening?: GlResp['kas_opening'] }) {
  const rows = weeklyFlowRows(pos.map((p) => p?.kas_detail), 'kas_awal', 'kas_akhir',
    { awal: 'Kas Awal', masuk: 'Kas Masuk', keluar: 'Kas Keluar', akhir: 'Kas Akhir' }, kasFlowLines(pos.map((p) => p?.kas_detail)))
  if (!rows.length) return null
  const gl = opening ? parseMoney(opening.gl) : 0
  const set = opening ? parseMoney(opening.ditetapkan) : 0
  const rp = (n: number) => (n < 0 ? `(Rp ${fmtNumber(Math.round(-n))})` : `Rp ${fmtNumber(Math.round(n))}`)
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <SectionTitle>Laporan Arus Kas</SectionTitle>
      <WeeklyNoteTable label="Tabel Laporan Arus Kas" rows={rows} />
      {opening && <p className="tabular-nums break-words">Kas di Neraca = saldo awal {rp(set)} per {fmtTgl(opening.date)} + pergerakan akun Kas/Bank Unit 5 di menu Transaksi sejak 1 Okt 2026 (transaksi Kas bertanggal sebelumnya tidak dihitung). Sebagai informasi, saldo Kas menu Transaksi per {fmtTgl(opening.date)}: {rp(gl)}.</p>}
    </div>
  )
}

/** Catatan pergerakan akun Persediaan per minggu; stok akhir = Stok di Neraca, dibandingkan dengan Manajemen Gudang. */
function StokNote({ pos, last }: { pos: (GlPos | undefined)[]; last?: GlPos }) {
  const rows = weeklyFlowRows(pos.map((p) => p?.stok_detail), 'stok_awal', 'stok_akhir',
    { awal: 'Stok Awal', masuk: 'Stok Masuk', keluar: 'Stok Keluar', akhir: 'Stok Akhir' }, STOK_FLOW)
  if (!rows.length || !last?.stok_detail) return null
  const mgmt = last.pembanding?.stok
  const akhir = parseMoney(last.stok_detail.stok_akhir)
  const diff = mgmt != null && Math.abs(akhir - parseMoney(mgmt)) >= 1
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <SectionTitle>Laporan Arus Stok</SectionTitle>
      <WeeklyNoteTable label="Tabel Laporan Arus Stok" rows={rows} />
      {mgmt != null && <p className="tabular-nums break-words">Nilai Persediaan Manajemen Gudang per {fmtTgl(last.date)}: Rp {fmtNumber(Math.round(parseMoney(mgmt)))} (selisih Rp {fmtNumber(Math.round(akhir - parseMoney(mgmt)))}).</p>}
      {diff && <p>Kemungkinan penyebab selisih dengan Manajemen Gudang: transaksi manual akun Persediaan di menu Transaksi (lihat Catatan perbedaan data), penyesuaian stok yang tidak dijurnal ke Persediaan, atau HPP lama di kartu stok yang berbeda dengan HPP produk saat ini.</p>}
    </div>
  )
}

/** Catatan di bawah Neraca: selisih saldo menu Transaksi dengan data Manajemen Gudang. */
function DiffNote({ pos }: { pos?: GlPos }) {
  if (!pos?.pembanding) return null
  const items = diffNoteItems({ stok: pos.stok, utang: pos.utang }, pos.pembanding, pos.manual_suspects)
  if (!items.length) return null
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <p className="font-semibold text-foreground">Catatan perbedaan data</p>
      {items.map((it) => (
        <div key={it.key} className="space-y-1">
          <p className="tabular-nums break-words">{it.text}</p>
          {it.details.length > 0 && <p>Transaksi manual di menu Transaksi yang perlu diperiksa:</p>}
          {it.details.map((d) => <p key={d} className="pl-4 tabular-nums break-words">• {d}</p>)}
        </div>
      ))}
      <p>Neraca = saldo akun Unit 5 di menu Transaksi (termasuk jurnal otomatis) s.d. {fmtTgl(pos.date)}.</p>
    </div>
  )
}

function AutoTables({ period }: { period: string }) {
  const { sales, purchases, inRows, outRows } = useTradeRows(period)
  const error = sales.error || purchases.error
  if (error) return <p role="alert">{getApiError(error)}</p>
  if (sales.isLoading || purchases.isLoading) return <Spinner label="Memuat transaksi..." />
  return (
    <>
      <AutoTable title="Daftar Invoice untuk Pelanggan (Stock Out)" label="Customer" doc="invoice" period={period} rows={inRows} />
      <AutoTable title="Daftar Purchase Order untuk Pemasok (Stock In)" label="Pemasok" doc="po" period={period} rows={outRows} />
      <SkuStockTable period={period} />
      <SkuStockTable period={period} internal />
    </>
  )
}

function InOut({ i, o, strong, outOnly }: { i: number; o: number; strong?: boolean; outOnly?: boolean }) {
  return (
    <div className={`leading-tight ${strong ? 'font-semibold' : ''}`}>
      {!outOnly && <div>In {fmtNumber(i)}</div>}<div className={outOnly ? '' : 'text-muted-foreground'}>Out {fmtNumber(o)}</div>
    </div>
  )
}

/** Rincian qty In/Out per SKU per minggu; kolom sejajar dengan tabel PO di atasnya. */
function SkuStockTable({ period, internal = false }: { period: string; internal?: boolean }) {
  const { data: units } = useUnitsQuery(true)
  const unitId = units?.find((u) => u.code === TOKO_UNIT_CODE)?.id
  const range = { date_from: weekStart(period, 1), date_to: weekEnd(period, weekCount(period)) }
  const q = useQuery({
    queryKey: ['toko', 'sku-moves', period, unitId],
    queryFn: async () => (await api.get<StockMoveRec[]>(`${INV}/movements`, { params: { ...range, unit_usaha_id: unitId, limit: 2000 } })).data,
  })
  const rows = useMemo(() => buildSkuStockRows(q.data ?? [], period, internal), [q.data, period, internal])
  const title = internal ? 'Rincian Transaksi Stok Berdasarkan SKU (internal)' : 'Rincian Transaksi Stok Berdasarkan SKU'
  if (q.error) return <p role="alert">{getApiError(q.error)}</p>
  const pad = Math.max(DEFAULT_TX_ROWS - rows.length, 0)
  const sum = (w: number, k: 'in' | 'out') => rows.reduce((a, r) => a + (r.weeks[w]?.[k] ?? 0), 0)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <SectionTitle>{title}</SectionTitle>
        <HelpHint label={`Tentang tabel ${title}`}>{internal
          ? 'Jumlah barang (qty, bukan rupiah) keluar untuk pemakaian internal per SKU per minggu (Senin–Sabtu), dari Manajemen Gudang.'
          : 'Jumlah barang (qty, bukan rupiah) masuk (Stock In) dan keluar karena penjualan (Stock Out) per SKU per minggu (Senin–Sabtu), dari Manajemen Gudang. Pemakaian internal ada di tabel (internal) di bawahnya.'}</HelpHint>
      </div>
      {q.isLoading ? <Spinner label="Memuat pergerakan stok..." /> : (
      <Card className="overflow-hidden p-0"><TableShell minWidth={TX_TABLE_MIN_WIDTH + DOC_COL} label={`Tabel ${title}`}><Table className={`${tableClass} table-fixed`}>
        <colgroup>
          <col style={{ width: TX_COL.no }} />
          <col style={{ width: TX_COL.uraian }} />
          {WEEKS.map((w) => <col key={w} style={{ width: TX_COL.week }} />)}
          <col style={{ width: TX_COL.jumlah }} />
          <col style={{ width: DOC_COL }} />
        </colgroup>
        <TableHeader className={headerClass}><TableRow>
          <TableHead>No.</TableHead>
          <TableHead>SKU</TableHead>
          {WEEKS.map((w) => <TableHead key={w} className="text-right whitespace-nowrap">Minggu ke-{w}</TableHead>)}
          <TableHead className="text-right">Jumlah</TableHead>
          <TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow key={r.key}>
              <TableCell>{idx + 1}</TableCell>
              <TableCell className="min-w-0" title={r.name ? `${r.sku} — ${r.name}` : r.sku}>
                <div className="truncate">{r.sku}</div>
                {r.name && <div className="truncate text-xs text-muted-foreground">{r.name}</div>}
              </TableCell>
              {WEEKS.map((w) => (
                <TableCell key={w} className="text-right whitespace-nowrap tabular-nums">
                  {r.weeks[w] ? <InOut i={r.weeks[w].in} o={r.weeks[w].out} outOnly={internal} /> : <EmptyCellDash />}
                </TableCell>
              ))}
              <TableCell className="text-right whitespace-nowrap tabular-nums"><InOut i={r.totalIn} o={r.totalOut} strong outOnly={internal} /></TableCell>
              <TableCell />
            </TableRow>
          ))}
          {Array.from({ length: pad }, (_, i) => (
            <TableRow key={`empty-${i}`}>
              <TableCell>{rows.length + i + 1}</TableCell><TableCell><EmptyCellDash /></TableCell>
              {WEEKS.map((w) => <TableCell key={w} className="text-right"><EmptyCellDash /></TableCell>)}
              <TableCell /><TableCell />
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t bg-muted/50 font-semibold"><TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          {WEEKS.map((w) => <TableCell key={w} className="text-right whitespace-nowrap tabular-nums"><InOut i={sum(w, 'in')} o={sum(w, 'out')} strong outOnly={internal} /></TableCell>)}
          <TableCell className="text-right whitespace-nowrap tabular-nums">
            <InOut i={rows.reduce((a, r) => a + r.totalIn, 0)} o={rows.reduce((a, r) => a + r.totalOut, 0)} strong outOnly={internal} />
          </TableCell>
          <TableCell />
        </TableRow></tfoot>
      </Table></TableShell></Card>
      )}
    </div>
  )
}

const DOC_COL = 110

function AutoTable({ title, label, doc, period, rows }: { title: string; label: string; doc: 'invoice' | 'po'; period: string; rows: TxRow[] }) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const docLabel = doc === 'invoice' ? 'Invoice' : 'PO'
  const download = async (row: TxRow, week: number | null) => {
    const ids = week == null ? ((row.ids as string[] | undefined) ?? [])
      : ((row.idsByWeek as Record<number, string[]> | undefined)?.[week] ?? [])
    if (!ids.length) return
    setOpenKey(null)
    setBusyKey(row.key)
    try {
      const res = await api.post(`${INV}/documents/transactions-pdf`, { kind: doc, source_ids: ids, week: week == null ? undefined : weekEnd(period, week) }, { responseType: 'blob' })
      const suffix = week == null ? period : `${period}-minggu${week}`
      triggerBlobDownload(res.data, `${docLabel}-${(row.uraian ?? '').replace(/[^\w-]+/g, '_')}-${suffix}.pdf`)
    } catch (e) {
      notify(getApiError(e), { type: 'error' })
    } finally {
      setBusyKey(null)
    }
  }
  const { sorted, headerProps, sortIndicator } = useSort<TxRow>(rows)
  const padCount = Math.max(DEFAULT_TX_ROWS - rows.length, 0)
  const display = [...sorted, ...Array.from({ length: padCount }, (_, i) => emptyTxRow(`empty-${i}`))]
  const totals = txTotals(rows)
  const sortHead = (key: string, text: string, right = false) => (
    <TableHead {...headerProps(key)} className={`tabular-nums cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : ''}`}>
      {text}{sortIndicator(key)}
    </TableHead>
  )
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <SectionTitle>{title}</SectionTitle>
        <HelpHint label={`Tentang tabel ${title}`}>Terisi otomatis dari transaksi {doc === 'invoice' ? 'penjualan' : 'pembelian reguler (tanpa Belanja Modal Awal)'}, dijumlah per {label} per minggu (Senin–Sabtu).</HelpHint>
      </div>
      <Card className="overflow-hidden p-0"><TableShell minWidth={TX_TABLE_MIN_WIDTH + DOC_COL} label={`Tabel ${title} otomatis`}><Table className={`${tableClass} table-fixed`}>
        <colgroup>
          <col style={{ width: TX_COL.no }} />
          <col style={{ width: TX_COL.uraian }} />
          {WEEKS.map((w) => <col key={w} style={{ width: TX_COL.week }} />)}
          <col style={{ width: TX_COL.jumlah }} />
          <col style={{ width: DOC_COL }} />
        </colgroup>
        <TableHeader className={headerClass}><TableRow>
          <TableHead>No.</TableHead>
          {sortHead('uraian', 'Uraian')}
          {WEEKS.map((w) => <Fragment key={w}>{sortHead(`w${w}`, `Minggu ke-${w}`, true)}</Fragment>)}
          {sortHead('jumlah', 'Jumlah', true)}
          <TableHead className="text-center">{docLabel}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {display.map((row, idx) => (
            <TableRow key={row.key}>
              <TableCell>{idx + 1}</TableCell>
              <TableCell className="min-w-0 truncate" title={row.uraian ?? undefined}>{row.uraian ?? <EmptyCellDash />}</TableCell>
              {WEEKS.map((w) => {
                const v = row[`w${w}`] as number | null
                return <TableCell key={w} className="text-right whitespace-nowrap tabular-nums">{v == null ? <EmptyCellDash /> : fmtNumber(v)}</TableCell>
              })}
              <TableCell className="text-right whitespace-nowrap font-semibold tabular-nums">{row.jumlah == null ? '' : fmtNumber(row.jumlah)}</TableCell>
              <TableCell className="text-center">
                {row.uraian && row.uraian !== '-' ? (
                  <Popover open={openKey === row.key} onOpenChange={(o) => setOpenKey(o ? row.key : null)}>
                    <PopoverTrigger asChild>
                      <Button type="button" size="sm" variant="outline" disabled={busyKey !== null} title={`Unduh ${docLabel} ${row.uraian}`}>
                        <Download size={14} />Unduh PDF
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-auto p-1">
                      <div className="flex flex-col" role="menu" aria-label={`Periode ${docLabel}`}>
                        {WEEKS.filter((w) => (row.idsByWeek as Record<number, string[]> | undefined)?.[w]?.length).map((w) => (
                          <Button key={w} type="button" variant="ghost" size="sm" className="justify-start" role="menuitem"
                            onClick={() => void download(row, w)}>{tradeWeekLabel(period, w)}</Button>
                        ))}
                        <Button type="button" variant="ghost" size="sm" className="justify-start" role="menuitem"
                          onClick={() => void download(row, null)}>Semua minggu</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : <EmptyCellDash />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t bg-muted/50 font-semibold"><TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          {WEEKS.map((w) => <TableCell key={w} className="text-right whitespace-nowrap tabular-nums">{fmtNumber(totals[`w${w}` as 'w1'])}</TableCell>)}
          <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtNumber(totals.jumlah)}</TableCell>
          <TableCell />
        </TableRow></tfoot>
      </Table></TableShell></Card>
    </div>
  )
}

function TxTable({ jenis, items, entries, onCell, onEmptyUraian }: {
  jenis: TokoJenis
  items: TokoItem[]
  entries: TokoEntry[]
  onCell: (t: CellTarget) => void
  onEmptyUraian: () => void
}) {
  const rows = useMemo(() => buildTxRows(items, entries, jenis), [items, entries, jenis])
  const { sorted, headerProps, sortIndicator } = useSort<TxRow>(rows)
  const padCount = Math.max(DEFAULT_TX_ROWS - rows.length, 0)
  const display = [...sorted, ...Array.from({ length: padCount }, (_, i) => emptyTxRow(`empty-${i}`))]
  const totals = txTotals(rows)
  const title = JENIS_LABEL[jenis]
  const sortHead = (key: string, label: string, right = false) => (
    <TableHead {...headerProps(key)} className={`tabular-nums cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : ''}`}>
      {label}{sortIndicator(key)}
    </TableHead>
  )
  const money = (n: number) => fmtNumber(n)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle>{title}</SectionTitle>
      </div>
      <Card className="overflow-hidden p-0"><TableShell minWidth={TX_TABLE_MIN_WIDTH} label={`Tabel ${title}`}><Table className={`${tableClass} table-fixed`}>
        <colgroup>
          <col style={{ width: TX_COL.no }} />
          <col style={{ width: TX_COL.uraian }} />
          {WEEKS.map((w) => <col key={w} style={{ width: TX_COL.week }} />)}
          <col style={{ width: TX_COL.jumlah }} />
        </colgroup>
        <TableHeader className={headerClass}><TableRow>
          <TableHead>No.</TableHead>
          {sortHead('uraian', 'Uraian')}
          {WEEKS.map((w) => <Fragment key={w}>{sortHead(`w${w}`, `Minggu ke-${w}`, true)}</Fragment>)}
          {sortHead('jumlah', 'Jumlah', true)}
        </TableRow></TableHeader>
        <TableBody>
          {display.map((row, idx) => (
            <TableRow key={row.key} data-testid={`toko-${jenis}-row`}>
              <TableCell>{idx + 1}</TableCell>
              <TableCell className="min-w-0 truncate" title={row.uraian ?? undefined}>
                {row.uraian ?? <Hint onClick={onEmptyUraian} label={`Isi uraian ${title} baris ${idx + 1}`} />}
              </TableCell>
              {WEEKS.map((w) => {
                const v = row[`w${w}`] as number | null
                const open = () => {
                  if (!row.item) { onEmptyUraian(); return }
                  onCell({ item: row.item, week: w, entry: row.entries[w] })
                }
                return (
                  <TableCell key={w} className="text-right whitespace-nowrap tabular-nums">
                    {v == null ? <Hint onClick={open} label={`Input minggu ke-${w} baris ${idx + 1}`} />
                      : <button type="button" className="tabular-nums hover:underline" onClick={open}
                        title={row.entries[w]?.tanggal}>{money(v)}</button>}
                  </TableCell>
                )
              })}
              <TableCell className="text-right whitespace-nowrap font-semibold tabular-nums">{row.jumlah == null ? '' : money(row.jumlah)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t bg-muted/50 font-semibold"><TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          {WEEKS.map((w) => <TableCell key={w} className="text-right whitespace-nowrap tabular-nums">{money(totals[`w${w}` as 'w1'])}</TableCell>)}
          <TableCell className="text-right whitespace-nowrap tabular-nums">{money(totals.jumlah)}</TableCell>
        </TableRow></tfoot>
      </Table></TableShell></Card>
    </div>
  )
}

function DataTable({ jenis, items, onChanged }: { jenis: TokoJenis; items: TokoItem[]; onChanged: () => Promise<unknown> | void }) {
  const title = jenis === 'pemasukan' ? 'Uraian Pemasukan' : 'Uraian Pengeluaran'
  const [extra, setExtra] = useState(0)
  const pad = Math.max(DEFAULT_DATA_ROWS - items.length, 0) + extra
  const { sorted, headerProps, sortIndicator } = useSort(items as unknown as Record<string, unknown>[])
  const sortedItems = sorted as unknown as TokoItem[]
  const sortHead = (key: string, label: string, cls = '') => (
    <TableHead {...headerProps(key)} className={`cursor-pointer select-none whitespace-nowrap ${cls}`}>{label}{sortIndicator(key)}</TableHead>
  )
  return (
    <div className="space-y-2" data-testid={`toko-data-${jenis}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <Button size="sm" variant="outline" onClick={() => setExtra((n) => n + 1)}><Plus className="size-4" />Tambah baris</Button>
      </div>
      <Card className="overflow-hidden p-0"><TableShell minWidth={640} label={`Tabel ${title}`}><Table className={tableClass}>
        <TableHeader className={headerClass}><TableRow>
          <TableHead className="w-14">No.</TableHead>{sortHead('name', 'Nama Baris')}{sortHead('keterangan', 'Keterangan')}<TableHead className="w-14" />
        </TableRow></TableHeader>
        <TableBody>
          {sortedItems.map((it, i) => <DataRow key={it.id} no={i + 1} jenis={jenis} item={it} onChanged={onChanged} />)}
          {Array.from({ length: pad }, (_, i) => (
            <DataRow key={`new-${items.length + i}`} no={items.length + i + 1} jenis={jenis} item={null}
              onChanged={async () => { setExtra((n) => Math.max(n - 1, 0)); await onChanged() }} />
          ))}
        </TableBody>
      </Table></TableShell></Card>
    </div>
  )
}

function DataRow({ no, jenis, item, onChanged }: { no: number; jenis: TokoJenis; item: TokoItem | null; onChanged: () => Promise<unknown> | void }) {
  const confirm = useConfirm()
  const [name, setName] = useState(item?.name ?? '')
  const [keterangan, setKeterangan] = useState(item?.keterangan ?? '')
  const [busy, setBusy] = useState(false)

  // Jenis ditentukan tabel tempat baris berada (Uraian Pemasukan / Uraian Pengeluaran).
  const persist = async (next: { name: string; keterangan: string }) => {
    const trimmed = next.name.trim()
    if (busy) return
    try {
      if (item) {
        if (!trimmed) { setName(item.name); notify('Nama Baris tidak boleh kosong'); return }
        if (trimmed === item.name && next.keterangan === item.keterangan) return
        setBusy(true)
        await api.put(`/v1/toko/items/${item.id}`, { name: trimmed, keterangan: next.keterangan })
        await onChanged()
      } else {
        if (!trimmed) return
        setBusy(true)
        await api.post('/v1/toko/items', { name: trimmed, jenis, keterangan: next.keterangan })
        setName(''); setKeterangan('')
        await onChanged()
      }
    } catch (e) {
      notify(getApiError(e), { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!item) return
    if (!(await confirm({ title: 'Hapus data transaksi?', description: `"${item.name}" akan dihapus dari tab Data.`, confirmLabel: 'Hapus' }))) return
    try { await api.delete(`/v1/toko/items/${item.id}`); await onChanged() } catch (e) { notify(getApiError(e), { type: 'error' }) }
  }

  return (
    <TableRow data-testid="toko-data-row">
      <TableCell>{no}</TableCell>
      <TableCell>
        <Input aria-label={`Nama Baris ${jenis} baris ${no}`} title={HINT_A11Y} value={name} disabled={busy} placeholder={EMPTY_CELL_DASH}
          className="placeholder:text-muted-foreground/60"
          onChange={(e) => setName(e.target.value)} onBlur={() => void persist({ name, keterangan })} />
      </TableCell>
      <TableCell>
        <Input aria-label={`Keterangan ${jenis} baris ${no}`} title={HINT_A11Y} value={keterangan} disabled={busy} placeholder={EMPTY_CELL_DASH}
          className="placeholder:text-muted-foreground/60"
          onChange={(e) => setKeterangan(e.target.value)} onBlur={() => void persist({ name, keterangan })} />
      </TableCell>
      <TableCell>
        {item && (item.has_entries ? (
          <span className="inline-flex" title={LOCKED_HINT} aria-label={LOCKED_HINT} tabIndex={0}>
            <Button variant="ghost" size="icon" disabled aria-label={`Hapus baris ${no} (terkunci)`}><Trash2 className="size-4" /></Button>
          </span>
        ) : (
          <Button variant="ghost" size="icon" aria-label={`Hapus baris ${no}`} title="Hapus baris" onClick={() => void remove()}><Trash2 className="size-4" /></Button>
        ))}
      </TableCell>
    </TableRow>
  )
}

function EntryDialog({ target, period, onClose, onSaved }: {
  target: CellTarget
  period: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [tanggal, setTanggal] = useState(target.entry?.tanggal ?? defaultWeekDate(period, target.week))
  const [nominal, setNominal] = useState(target.entry ? String(parseMoney(target.entry.nominal)) : '')
  const [busy, setBusy] = useState(false)
  const [dateMsg, setDateMsg] = useState('')
  const free = isFreeWeek(period, target.week)
  const wStart = weekStart(period, target.week)
  const wEnd = weekEnd(period, target.week)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!tanggal) { notify('Tanggal transaksi wajib diisi'); return }
    const dateError = validateEntryDate(period, target.week, tanggal)
    if (dateError) { setDateMsg(dateError); return }
    if (!nominal || Number(nominal) <= 0) { notify('Nominal transaksi harus lebih dari nol'); return }
    setBusy(true)
    try {
      await api.put('/v1/toko/entries', { item_id: target.item.id, period, week: target.week, tanggal, nominal })
      notify('Transaksi tersimpan', { type: 'success' })
      await onSaved()
    } catch (err) { notify(getApiError(err), { type: 'error' }) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!target.entry) { onClose(); return }
    setBusy(true)
    try {
      await api.delete(`/v1/toko/entries/${target.entry.id}`)
      notify('Isian dihapus', { type: 'success' })
      await onSaved()
    } catch (err) { notify(getApiError(err), { type: 'error' }) } finally { setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{target.item.name} — Minggu ke-{target.week}</DialogTitle>
          <DialogDescription>{JENIS_LABEL[target.item.jenis]} periode {period}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="toko-tanggal">Tanggal transaksi</Label>
            <Input id="toko-tanggal" type="date" required value={tanggal} aria-invalid={!!dateMsg}
              min={wStart} max={wEnd}
              onChange={(e) => { setTanggal(e.target.value); setDateMsg('') }} />
            {free && !dateMsg && <p className="help-text">Periode {period} tidak memiliki Minggu ke-{target.week} (minggu Senin–Sabtu).</p>}
            {!free && !dateMsg && <p className="help-text">Minggu ke-{target.week}: {wStart} s.d. {wEnd} (Senin–Sabtu, hari Minggu ikut minggu ini).</p>}
            {dateMsg && <p role="alert" className="text-xs text-destructive">{dateMsg}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="toko-nominal">Nominal transaksi</Label>
            <Input id="toko-nominal" type="number" min="0" step="any" required inputMode="numeric" placeholder="0"
              value={nominal} onChange={(e) => setNominal(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}><Trash2 className="size-4" />Hapus</Button>
            <Button type="submit" disabled={busy}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
