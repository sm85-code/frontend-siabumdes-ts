import { Fragment, useMemo, useState, type FormEvent } from 'react'
import HelpHint from '@/components/HelpHint'
import EmptyCellDash, { EMPTY_CELL_DASH } from '@/components/EmptyCellDash'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Database, Download, Plus, Receipt, Trash2 } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
} from '@/lib/toko'

const tableClass = 'toko-table [&_th]:h-auto [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-2'
/** Lebar kolom sama untuk Pemasukan & Pengeluaran agar Minggu/Jumlah sejajar saat ditumpuk. */
const TX_TABLE_MIN_WIDTH = 980
const TX_COL = { no: 56, uraian: 200, week: 120, jumlah: 124 } as const
const headerClass = 'bg-muted [&_th]:text-foreground [&_tr:hover]:bg-transparent'
const HINT_A11Y = 'Klik untuk input'
const LOCKED_HINT = 'Tidak dapat dihapus: baris ini sudah memiliki nominal di tab Perduitan #1. Hapus isian nominalnya dulu.'
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
  const [tab, setTab] = useState<'transaksi' | 'data' | 'otomatis'>('data')
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
      <div className="flex items-center gap-1"><h1 className="font-heading page-h1 text-3xl font-bold">Manajemen Toko</h1><HelpHint label="Tentang Manajemen Toko"><p>Uraian diambil dari tab Bahan Perduitan sesuai Jenis Transaksi. Klik sel Minggu untuk mengisi tanggal dan nominal.</p><p>Setiap nominal otomatis tercatat sebagai transaksi Unit 5; bukti diunggah dari halaman Transaksi.</p></HelpHint></div>
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="toko-period">Periode</Label>
        <Input id="toko-period" type="month" className="w-44" value={period}
          onChange={(e) => e.target.value && setPeriod(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tab Manajemen Toko">
        {([{ id: 'data', label: 'Bahan Perduitan', icon: Database }, { id: 'transaksi', label: 'Perduitan #1', icon: ClipboardList }, { id: 'otomatis', label: 'Perduitan #2', icon: Receipt }] as const).map((t) => {
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
                onCell={setCell} onEmptyUraian={() => { setTab('data'); notify('Isi Nama Transaksi di tab Bahan Perduitan untuk menambah uraian.') }} />
            ))}
          </section>
          <section hidden={tab !== 'otomatis'} role="tabpanel" id="toko-panel-otomatis" aria-labelledby="toko-tab-otomatis" className="min-w-0 space-y-6">
            {tab === 'otomatis' && <AutoTables period={period} />}
          </section>
          <section hidden={tab !== 'data'} role="tabpanel" id="toko-panel-data" aria-labelledby="toko-tab-data" className="min-w-0 space-y-3">
            <DataTable items={items} onChanged={refresh} />
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

function AutoTables({ period }: { period: string }) {
  const sales = useQuery({ queryKey: ['toko', 'auto-sales'], queryFn: async () => (await api.get<SaleRec[]>(`${INV}/sales`, { params: { limit: 500 } })).data })
  const purchases = useQuery({ queryKey: ['toko', 'auto-purchases'], queryFn: async () => (await api.get<PurchaseRec[]>(`${INV}/purchases`, { params: { limit: 500 } })).data })
  const inRows = useMemo(() => buildTradeRows((sales.data ?? []).map((s): TradeRecord => ({ ...s, name: s.customer_name })), period), [sales.data, period])
  const outRows = useMemo(() => buildTradeRows((purchases.data ?? []).filter((p) => p.payment_method !== 'modal_awal')
    .map((p): TradeRecord => ({ ...p, name: p.vendor_name })), period), [purchases.data, period])
  const error = sales.error || purchases.error
  if (error) return <p role="alert">{getApiError(error)}</p>
  if (sales.isLoading || purchases.isLoading) return <Spinner label="Memuat transaksi..." />
  return (
    <>
      <AutoTable title="Pemasukan" label="Customer" doc="invoice" period={period} rows={inRows} />
      <AutoTable title="Pengeluaran" label="Pemasok" doc="po" period={period} rows={outRows} />
    </>
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
      const res = await api.post(`${INV}/documents/transactions-pdf`, { kind: doc, source_ids: ids }, { responseType: 'blob' })
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
    <TableHead {...headerProps(key)} className={`cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : ''}`}>
      {text}{sortIndicator(key)}
    </TableHead>
  )
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <HelpHint label={`Tentang tabel ${title}`}>Terisi otomatis dari transaksi {title === 'Pemasukan' ? 'penjualan' : 'pembelian reguler (tanpa Belanja Modal Awal)'}, dijumlah per {label} per minggu (Senin–Sabtu).</HelpHint>
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
    <TableHead {...headerProps(key)} className={`cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : ''}`}>
      {label}{sortIndicator(key)}
    </TableHead>
  )
  const money = (n: number) => fmtNumber(n)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
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

function DataTable({ items, onChanged }: { items: TokoItem[]; onChanged: () => Promise<unknown> | void }) {
  const [extra, setExtra] = useState(0)
  const pad = Math.max(DEFAULT_DATA_ROWS - items.length, 0) + extra
  const { sorted, headerProps, sortIndicator } = useSort(items as unknown as Record<string, unknown>[])
  const sortedItems = sorted as unknown as TokoItem[]
  const sortHead = (key: string, label: string, cls = '') => (
    <TableHead {...headerProps(key)} className={`cursor-pointer select-none whitespace-nowrap ${cls}`}>{label}{sortIndicator(key)}</TableHead>
  )
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <HelpHint label="Tentang tab Bahan Perduitan">Isi Nama Transaksi dan pilih Jenis Transaksi; baris otomatis tampil sebagai Uraian di tabel Pemasukan/Pengeluaran.</HelpHint>
        <Button size="sm" variant="outline" onClick={() => setExtra((n) => n + 1)}><Plus className="size-4" />Tambah baris</Button>
      </div>
      <Card className="overflow-hidden p-0"><TableShell minWidth={760} label="Tabel Data Transaksi"><Table className={tableClass}>
        <TableHeader className={headerClass}><TableRow>
          <TableHead className="w-14">No.</TableHead>{sortHead('name', 'Nama Transaksi')}{sortHead('jenis', 'Jenis Transaksi', 'w-48')}{sortHead('keterangan', 'Keterangan')}<TableHead className="w-14" />
        </TableRow></TableHeader>
        <TableBody>
          {sortedItems.map((it, i) => <DataRow key={it.id} no={i + 1} item={it} onChanged={onChanged} />)}
          {Array.from({ length: pad }, (_, i) => (
            <DataRow key={`new-${items.length + i}`} no={items.length + i + 1} item={null}
              onChanged={async () => { setExtra((n) => Math.max(n - 1, 0)); await onChanged() }} />
          ))}
        </TableBody>
      </Table></TableShell></Card>
    </>
  )
}

function DataRow({ no, item, onChanged }: { no: number; item: TokoItem | null; onChanged: () => Promise<unknown> | void }) {
  const confirm = useConfirm()
  const [name, setName] = useState(item?.name ?? '')
  const [jenis, setJenis] = useState<TokoJenis | ''>(item?.jenis ?? '')
  const [keterangan, setKeterangan] = useState(item?.keterangan ?? '')
  const [busy, setBusy] = useState(false)

  const persist = async (next: { name: string; jenis: TokoJenis | ''; keterangan: string }) => {
    const trimmed = next.name.trim()
    if (busy) return
    try {
      if (item) {
        if (!trimmed) { setName(item.name); notify('Nama Transaksi tidak boleh kosong'); return }
        if (trimmed === item.name && next.jenis === item.jenis && next.keterangan === item.keterangan) return
        setBusy(true)
        await api.put(`/v1/toko/items/${item.id}`, { name: trimmed, jenis: next.jenis || item.jenis, keterangan: next.keterangan })
        await onChanged()
      } else {
        if (!trimmed || !next.jenis) return
        setBusy(true)
        await api.post('/v1/toko/items', { name: trimmed, jenis: next.jenis, keterangan: next.keterangan })
        setName(''); setJenis(''); setKeterangan('')
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
    if (!(await confirm({ title: 'Hapus data transaksi?', description: `"${item.name}" akan dihapus dari tab Bahan Perduitan.`, confirmLabel: 'Hapus' }))) return
    try { await api.delete(`/v1/toko/items/${item.id}`); await onChanged() } catch (e) { notify(getApiError(e), { type: 'error' }) }
  }

  return (
    <TableRow data-testid="toko-data-row">
      <TableCell>{no}</TableCell>
      <TableCell>
        <Input aria-label={`Nama Transaksi baris ${no}`} title={HINT_A11Y} value={name} disabled={busy} placeholder={EMPTY_CELL_DASH}
          className="placeholder:text-muted-foreground/60"
          onChange={(e) => setName(e.target.value)} onBlur={() => void persist({ name, jenis, keterangan })} />
      </TableCell>
      <TableCell>
        <Select value={jenis} onValueChange={(v) => { const j = v as TokoJenis; setJenis(j); void persist({ name, jenis: j, keterangan }) }} disabled={busy}>
          <SelectTrigger aria-label={`Jenis Transaksi baris ${no}`} title={HINT_A11Y} className="h-11 w-full px-3"><SelectValue placeholder={<span className="text-muted-foreground/60">{EMPTY_CELL_DASH}</span>} /></SelectTrigger>
          <SelectContent position="popper" align="start" sideOffset={4}
            className="toko-table w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width) p-1">
            <SelectItem value="pemasukan" className="min-h-11 px-3 text-sm">Pemasukan</SelectItem>
            <SelectItem value="pengeluaran" className="min-h-11 px-3 text-sm">Pengeluaran</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input aria-label={`Keterangan baris ${no}`} title={HINT_A11Y} value={keterangan} disabled={busy} placeholder={EMPTY_CELL_DASH}
          className="placeholder:text-muted-foreground/60"
          onChange={(e) => setKeterangan(e.target.value)} onBlur={() => void persist({ name, jenis, keterangan })} />
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
  const [y, m] = period.split('-').map(Number)
  const monthEnd = `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!tanggal) { notify('Tanggal transaksi wajib diisi'); return }
    const dateError = validateEntryDate(period, tanggal)
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
              min={`${period}-01`} max={monthEnd}
              onChange={(e) => { setTanggal(e.target.value); setDateMsg('') }} />
            {free && !dateMsg && <p className="text-xs text-muted-foreground">Bulan ini tidak memiliki Sabtu di Minggu ke-5; pilih tanggal bebas dalam periode {period}.</p>}
            {!free && !dateMsg && <p className="text-xs text-muted-foreground">Tanggal dapat diubah ke tanggal mana pun dalam periode {period}.</p>}
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
