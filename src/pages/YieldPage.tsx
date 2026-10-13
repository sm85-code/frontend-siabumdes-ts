import FormDialog from '@/components/FormDialog'
import { Fragment, useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpDown, ClipboardList, Pencil, Plus, Trash2, Users } from 'lucide-react'
import api, { fmtRp, getApiError, parseMoney } from '@/api/client'
import { useAuth } from '@/lib/auth'
import { useUnitsQuery } from '@/hooks/useUnits'
import { notify } from '@/lib/feedback'
import { useConfirm } from '@/components/ConfirmProvider'
import TableShell from '@/components/TableShell'
import Spinner from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { WEEKS, currentPeriod, defaultWeekDate, fmtNumber, isFreeWeek, validateEntryDate } from '@/lib/toko'

/* Pola input mengikuti Manajemen Toko: tabel inline per periode, sel Minggu ke-1..5 → popup. */
const tableClass = 'toko-table [&_th]:h-auto [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-2'
const headerClass = 'bg-muted [&_th]:text-foreground [&_tr:hover]:bg-transparent'
const HINT = 'klik untuk input'

type WeekCell = { amount: string; transaction_date: string | null; transaction_id?: string | null }
export type YieldPartner = { id: string; name: string; capital: string; yield_amount: string; weeks?: Record<string, WeekCell> }
type Partner = YieldPartner
type Row = Partner & { no: number; total: number | null } & Record<`w${number}`, number | null>
type SortKey = 'name' | 'yield_amount' | 'total' | `w${number}`
type CellTarget = { partner: Partner; week: number; cell?: WeekCell }
const QUERY_KEY = ['yield-partners']

function Hint({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return <button type="button" onClick={onClick} aria-label={label} disabled={disabled}
    className="italic text-muted-foreground/60 no-underline hover:text-muted-foreground text-sm disabled:cursor-not-allowed">{HINT}</button>
}

export default function YieldPage() {
  const { user } = useAuth()
  const { data: units, isLoading: unitsLoading } = useUnitsQuery(true)
  const unit = units?.find(u => u.code === 'UU04')
  const allowed = user?.role !== 'pengelola' || (!!unit && user.unit_usaha_id === unit.id)
  const [period, setPeriod] = useState(currentPeriod)
  const queryKey = [...QUERY_KEY, user?.id, period]
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<{ items: Partner[]; unit_active: boolean }>('/imbal-hasil/setoran', { params: { period } })).data,
    enabled: allowed,
  })
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  ])
  const [sort, setSort] = useState<{ key: SortKey | null; desc: boolean }>({ key: null, desc: false })
  const [tab, setTab] = useState<'setoran' | 'partners'>('setoran')
  const [cell, setCell] = useState<CellTarget | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [name, setName] = useState('')
  const [capital, setCapital] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const baseRows = useMemo(() => (data?.items ?? []).map(p => {
    const vals = WEEKS.map(w => p.weeks?.[String(w)] ? parseMoney(p.weeks[String(w)].amount) : null)
    const filled = vals.filter((v): v is number => v != null)
    const row = { ...p, no: 0, total: filled.length ? filled.reduce((a, b) => a + b, 0) : null } as Row
    WEEKS.forEach((w, i) => { row[`w${w}`] = vals[i] })
    return row
  }), [data])
  const rows = useMemo(() => [...baseRows].sort((a, b) => {
    if (!sort.key) return 0
    if (sort.key === 'name') return a.name.localeCompare(b.name, 'id') * (sort.desc ? -1 : 1)
    const value = (r: Row) => sort.key === 'yield_amount' ? parseMoney(r.yield_amount) : (r[sort.key as 'total'] ?? -1)
    return (value(a) - value(b)) * (sort.desc ? -1 : 1)
  }).map((row, index) => ({ ...row, no: index + 1 }) as Row), [baseRows, sort])
  const totals = useMemo(() => ({
    capital: baseRows.reduce((s, r) => s + parseMoney(r.capital), 0),
    yield: baseRows.reduce((s, r) => s + parseMoney(r.yield_amount), 0),
    weeks: WEEKS.map(w => baseRows.reduce((s, r) => s + (r[`w${w}`] ?? 0), 0)),
    total: baseRows.reduce((s, r) => s + (r.total ?? 0), 0),
  }), [baseRows])

  const sortable = (key: SortKey, text: string, right = false) => <TableHead
    aria-sort={sort.key === key ? sort.desc ? 'descending' : 'ascending' : 'none'} className={right ? 'text-right' : ''}>
    <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : false })}>
      {text}<ArrowUpDown className="size-3 shrink-0" aria-hidden="true" />
    </button>
  </TableHead>
  const startEdit = (partner: Partner | null) => {
    setFormError(''); setEditing(partner); setName(partner?.name ?? ''); setCapital(partner?.capital ?? ''); setOpen(true)
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setFormError(''); setSaving(true)
    try {
      const payload = { name: name.trim(), capital }
      if (editing) await api.put(`/imbal-hasil/mitra/${editing.id}`, payload)
      else await api.post('/imbal-hasil/mitra', payload)
      setOpen(false)
      await refresh()
      notify('Data mitra berhasil disimpan')
    } catch (e) { setFormError(getApiError(e)) } finally { setSaving(false) }
  }
  const remove = async (partner: Partner) => {
    if (!await confirm({ title: 'Hapus mitra?', description: `Hapus ${partner.name}? Jika ada setoran, hapus isian setorannya terlebih dahulu.`, confirmLabel: 'Hapus', destructive: true })) return
    setSaving(true)
    try {
      await api.delete(`/imbal-hasil/mitra/${partner.id}`)
      await refresh()
      notify('Mitra berhasil dihapus')
    } catch (e) { notify(getApiError(e)) } finally { setSaving(false) }
  }

  if (user?.role === 'pengelola' && unitsLoading) return <Spinner label="Memeriksa akses unit..." />
  if (!allowed) return <p role="alert">Manajemen Setoran hanya untuk pengelola unit 4.</p>
  const writable = data?.unit_active === true && !saving
  return <div className="min-w-0 space-y-5">
    <h1 className="font-heading text-3xl font-bold">Manajemen Setoran</h1>
    <p className="text-sm text-muted-foreground">Catatan setoran mitra unit 4. Imbal hasil dihitung 3% dari penyertaan modal. Setiap nominal setoran otomatis membuat transaksi dan jurnal unit 4; bukti diunggah dari halaman Transaksi.</p>
    <div className="flex flex-wrap items-center gap-3">
      <Label htmlFor="yield-period">Periode</Label>
      <Input id="yield-period" type="month" className="w-44" value={period} onChange={e => e.target.value && setPeriod(e.target.value)} />
    </div>
    {error ? <div role="alert" className="space-y-2"><p>{getApiError(error)}</p><Button onClick={() => void refetch()}>Coba lagi</Button></div> : isLoading ? <Spinner label="Memuat mitra..." /> : <>
    {data?.unit_active === false && <p role="status">Unit nonaktif. Data dapat dilihat, tetapi tidak dapat diubah.</p>}
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tab Manajemen Setoran">
      {([{ id: 'setoran', label: 'Setoran', icon: ClipboardList }, { id: 'partners', label: 'Data Mitra Usaha', icon: Users }] as const).map(item => {
        const Icon = item.icon
        return <Button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
          aria-controls={`yield-panel-${item.id}`} id={`yield-tab-${item.id}`}
          variant={tab === item.id ? 'default' : 'outline'} size="sm" onClick={() => setTab(item.id)}>
          <Icon size={16} />{item.label}
        </Button>
      })}
    </div>
    <section hidden={tab !== 'setoran'} role="tabpanel" id="yield-panel-setoran" aria-labelledby="yield-tab-setoran" className="min-w-0 space-y-3">
      <p className="text-sm text-muted-foreground">Nama mitra mengikuti tab Data Mitra Usaha. Klik sel Minggu untuk mengisi tanggal dan nominal setoran.</p>
      <Card className="overflow-hidden p-0"><TableShell minWidth={1100} label="Tabel Setoran"><Table className={tableClass}>
        <TableHeader className={headerClass}><TableRow>
          <TableHead className="w-14">No.</TableHead>{sortable('name', 'Nama Mitra')}{sortable('yield_amount', 'Imbal Hasil (3%)', true)}
          {WEEKS.map(w => <Fragment key={w}>{sortable(`w${w}`, `Minggu ke-${w}`, true)}</Fragment>)}{sortable('total', 'Jumlah', true)}
        </TableRow></TableHeader>
        <TableBody>
          {rows.map(row => <TableRow key={row.id}>
            <TableCell>{row.no}</TableCell><TableCell>{row.name}</TableCell>
            <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtNumber(parseMoney(row.yield_amount))}</TableCell>
            {WEEKS.map(w => {
              const v = row[`w${w}`]
              const openCell = () => setCell({ partner: row, week: w, cell: row.weeks?.[String(w)] })
              return <TableCell key={w} className="text-right whitespace-nowrap tabular-nums">
                {v == null ? <Hint onClick={openCell} disabled={!writable} label={`Input setoran ${row.name} minggu ke-${w}`} />
                  : <button type="button" className="tabular-nums hover:underline disabled:no-underline" disabled={!writable} onClick={openCell}
                    title={row.weeks?.[String(w)]?.transaction_date ?? undefined}>{fmtNumber(v)}</button>}
              </TableCell>
            })}
            <TableCell className="text-right whitespace-nowrap font-semibold tabular-nums">{row.total == null ? '' : fmtNumber(row.total)}</TableCell>
          </TableRow>)}
          {!rows.length && <TableRow><TableCell colSpan={9} className="py-8 text-center">Belum ada mitra. Tambahkan melalui tab Data Mitra Usaha.</TableCell></TableRow>}
        </TableBody>
        <tfoot className="border-t bg-muted/50 font-semibold"><TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtNumber(totals.yield)}</TableCell>
          {totals.weeks.map((v, i) => <TableCell key={i} className="text-right whitespace-nowrap tabular-nums">{fmtNumber(v)}</TableCell>)}
          <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtNumber(totals.total)}</TableCell>
        </TableRow></tfoot>
      </Table></TableShell></Card>
    </section>
    <section hidden={tab !== 'partners'} role="tabpanel" id="yield-panel-partners" aria-labelledby="yield-tab-partners" className="min-w-0 space-y-3">
      <div className="flex justify-end"><Button disabled={!writable} onClick={() => startEdit(null)}><Plus className="size-4" />Tambah Mitra</Button></div>
      <Card className="overflow-hidden p-0"><TableShell minWidth={720}><Table className={tableClass}>
        <TableHeader className={headerClass}><TableRow><TableHead className="w-14">No.</TableHead>{sortable('name', 'Nama Mitra')}<TableHead className="text-right">Jumlah Penyertaan Modal</TableHead>{sortable('yield_amount', 'Imbal Hasil (3%)', true)}<TableHead>Aksi</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map(row => <TableRow key={row.id}><TableCell>{row.no}</TableCell><TableCell>{row.name}</TableCell>
          <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtRp(row.capital)}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{fmtRp(row.yield_amount)}</TableCell>
          <TableCell><div className="flex gap-2"><Button variant="outline" disabled={!writable} onClick={() => startEdit(row)}><Pencil className="size-4" />Ubah</Button><Button variant="outline" disabled={!writable} onClick={() => void remove(row)}><Trash2 className="size-4" />Hapus</Button></div></TableCell>
        </TableRow>)}{!rows.length && <TableRow><TableCell colSpan={5} className="py-8 text-center">Belum ada mitra. Gunakan Tambah Mitra untuk mulai.</TableCell></TableRow>}</TableBody>
        <tfoot className="border-t bg-muted/50 font-semibold"><TableRow><TableCell colSpan={2}>Total</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{fmtRp(totals.capital)}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{fmtRp(totals.yield)}</TableCell><TableCell /></TableRow></tfoot>
      </Table></TableShell></Card>
    </section>
    </>}
    {cell && <SetoranDialog target={cell} period={period} onClose={() => setCell(null)} onSaved={async () => { setCell(null); await refresh() }} />}
    {open && <FormDialog compact title={editing ? 'Ubah Mitra' : 'Tambah Mitra'} error={formError} onClose={() => setOpen(false)}>{({ cancel, run }) => <>
      <form onSubmit={e => { e.preventDefault(); void run(() => save(e)); }} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="yield-name">Nama Mitra</Label><Input id="yield-name" required maxLength={255} value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="yield-capital">Jumlah Penyertaan Modal (Rp)</Label><Input id="yield-capital" type="number" inputMode="decimal" required min="0.01" max="9999999999999999.99" step="0.01" value={capital} onChange={e => setCapital(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="yield-amount">Imbal Hasil (3%) — otomatis</Label><Input id="yield-amount" readOnly value={fmtRp(parseMoney(capital) * 0.03)} /></div>
        <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={cancel}>Batal</Button><Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Menyimpan...' : 'Simpan'}</Button></DialogFooter>
      </form>
    </>}</FormDialog>}
  </div>
}

function SetoranDialog({ target, period, onClose, onSaved }: { target: CellTarget; period: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [tanggal, setTanggal] = useState(target.cell?.transaction_date ?? defaultWeekDate(period, target.week))
  const [nominal, setNominal] = useState(target.cell ? String(parseMoney(target.cell.amount)) : '')
  const [busy, setBusy] = useState(false)
  const [dateMsg, setDateMsg] = useState('')
  const free = isFreeWeek(period, target.week)
  const [y, m] = period.split('-').map(Number)
  const monthEnd = `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  const body = (amount: string) => ({ year: y, month: m, week: target.week, transaction_date: tanggal, amount, automatic: false })
  const threePercent = (parseMoney(target.partner.yield_amount)).toFixed(2).replace(/\.00$/, '')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!tanggal) { notify('Tanggal transaksi wajib diisi'); return }
    const dateError = validateEntryDate(period, tanggal)
    if (dateError) { setDateMsg(dateError); return }
    if (!nominal || Number(nominal) <= 0) { notify('Nominal transaksi harus lebih dari nol'); return }
    setBusy(true)
    try {
      await api.put(`/imbal-hasil/mitra/${target.partner.id}/pembayaran`, body(nominal))
      notify('Setoran tersimpan', { type: 'success' })
      await onSaved()
    } catch (err) { notify(getApiError(err), { type: 'error' }) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!target.cell) { onClose(); return }
    setBusy(true)
    try {
      await api.delete(`/imbal-hasil/mitra/${target.partner.id}/pembayaran`, { data: body(String(parseMoney(target.cell.amount))) })
      notify('Setoran dihapus', { type: 'success' })
      await onSaved()
    } catch (err) { notify(getApiError(err), { type: 'error' }) } finally { setBusy(false) }
  }

  return <Dialog open onOpenChange={o => { if (!o && !busy) onClose() }}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{target.partner.name} — Minggu ke-{target.week}</DialogTitle>
        <DialogDescription>Setoran periode {period}</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="yield-tanggal">Tanggal transaksi</Label>
          <Input id="yield-tanggal" type="date" required value={tanggal} aria-invalid={!!dateMsg} min={`${period}-01`} max={monthEnd}
            onChange={e => { setTanggal(e.target.value); setDateMsg('') }} />
          {free && !dateMsg && <p className="text-xs text-muted-foreground">Bulan ini tidak memiliki Sabtu di Minggu ke-5; pilih tanggal bebas dalam periode {period}.</p>}
          {!free && !dateMsg && <p className="text-xs text-muted-foreground">Tanggal dapat diubah ke tanggal mana pun dalam periode {period}.</p>}
          {dateMsg && <p role="alert" className="text-xs text-destructive">{dateMsg}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="yield-nominal">Nominal transaksi</Label>
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setNominal(threePercent)}>Isi imbal hasil 3% ({fmtNumber(parseMoney(target.partner.yield_amount))})</Button>
          </div>
          <Input id="yield-nominal" type="number" min="0" step="any" required inputMode="numeric" placeholder="0"
            value={nominal} onChange={e => setNominal(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}><Trash2 className="size-4" />Hapus</Button>
          <Button type="submit" disabled={busy}>Simpan</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
