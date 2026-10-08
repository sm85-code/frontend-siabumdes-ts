import { useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import YieldPaymentDialog, { PAYMENT_MONTHS } from './YieldPaymentDialog'
import { ArrowUpDown, ClipboardList, Users, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'

export type YieldPartner = { id: string; name: string; capital: string; yield_amount: string; payments?: Record<string, string>; payment_dates?: Record<string, string | null> }
type Partner = YieldPartner
type SortKey = 'name' | 'capital' | 'yield_amount' | 'total' | `month-${number}`
const MONTHS = PAYMENT_MONTHS
const QUERY_KEY = ['yield-partners']

export default function YieldPage() {
  const { user } = useAuth()
  const { data: units, isLoading: unitsLoading } = useUnitsQuery(true)
  const unit = units?.find(u => u.code === 'UU04')
  const allowed = user?.role !== 'pengelola' || (!!unit && user.unit_usaha_id === unit.id)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [yearDraft, setYearDraft] = useState(String(year))
  const [paymentPartner, setPaymentPartner] = useState<Partner | null>(null)
  const queryKey = [...QUERY_KEY, user?.id, year]
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<{ items: Partner[]; unit_active: boolean }>('/imbal-hasil/mitra', { params: { year } })).data,
    enabled: allowed,
  })
  const [sort, setSort] = useState<{ key: SortKey | null; desc: boolean }>({ key: null, desc: false })
  const [tab, setTab] = useState<'recap' | 'partners'>('recap')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [name, setName] = useState('')
  const [capital, setCapital] = useState('')
  const [saving, setSaving] = useState(false)
  const paymentTotal = (row: Partner) => {
    const values = Object.values(row.payments ?? {})
    return values.length ? values.reduce((sum, value) => sum + parseMoney(value), 0) : null
  }
  const rows = useMemo(() => [...(data?.items ?? [])].sort((a, b) => {
    if (!sort.key) return 0
    if (sort.key === 'name') return a.name.localeCompare(b.name, 'id') * (sort.desc ? -1 : 1)
    const value = (row: Partner) => sort.key === 'total' ? paymentTotal(row) ?? -1
      : sort.key?.startsWith('month-') ? parseMoney(row.payments?.[String(Number(sort.key.slice(6)) + 1)] ?? '-1')
      : parseMoney(row[sort.key as 'capital' | 'yield_amount'])
    return (value(a) - value(b)) * (sort.desc ? -1 : 1)
  }).map((row, index) => ({ ...row, no: index + 1 })), [data, sort])
  const sortable = (key: SortKey, text: string, colSpan?: number, rowSpan?: number) => <TableHead
    colSpan={colSpan} rowSpan={rowSpan} aria-sort={sort.key === key ? sort.desc ? 'descending' : 'ascending' : 'none'}>
    <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : false })}>
      {text}<ArrowUpDown className="size-3 shrink-0" aria-hidden="true" />
    </button>
  </TableHead>
  const startEdit = (partner: Partner | null) => {
    setEditing(partner); setName(partner?.name ?? ''); setCapital(partner?.capital ?? ''); setOpen(true)
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const payload = { name: name.trim(), capital }
      if (editing) await api.put(`/imbal-hasil/mitra/${editing.id}`, payload)
      else await api.post('/imbal-hasil/mitra', payload)
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey })
      notify('Data mitra berhasil disimpan')
    } catch (e) { notify(getApiError(e)) } finally { setSaving(false) }
  }
  const remove = async (partner: Partner) => {
    if (!await confirm({ title: 'Hapus mitra?', description: `Hapus ${partner.name}? Jika ada pembayaran, hapus pembayaran melalui rekap terlebih dahulu.`, confirmLabel: 'Hapus', destructive: true })) return
    setSaving(true)
    try {
      await api.delete(`/imbal-hasil/mitra/${partner.id}`)
      await queryClient.invalidateQueries({ queryKey })
      notify('Mitra berhasil dihapus')
    } catch (e) { notify(getApiError(e)) } finally { setSaving(false) }
  }
  if (user?.role === 'pengelola' && unitsLoading) return <Spinner label="Memeriksa akses unit..." />
  if (!allowed) return <p role="alert">Imbal Hasil hanya untuk pengelola unit 4.</p>
  const writable = data?.unit_active === true && !saving
  return <div className="min-w-0 space-y-5">
    <h1 className="font-heading text-3xl font-bold">Imbal Hasil</h1>
    <p className="text-sm text-muted-foreground">Catatan mitra unit 4. Imbal hasil dihitung 3% dari penyertaan modal; pembayaran bulanan dicatat per tahun melalui tombol pensil di rekap. Pembayaran otomatis membuat transaksi dan jurnal unit 4; ubah atau hapus melalui rekap ini.</p>
    <div className="flex items-center gap-3"><Label htmlFor="yield-year">Tahun</Label><Input id="yield-year" type="number" min="1900" max="9999" className="w-28" value={yearDraft} onChange={e => setYearDraft(e.target.value)} onBlur={() => { const value = Number(yearDraft); if (Number.isInteger(value) && value >= 1900 && value <= 9999) setYear(value); else { notify('Masukkan tahun antara 1900 dan 9999'); setYearDraft(String(year)) } }} /></div>
    {error ? <div role="alert" className="space-y-2"><p>{getApiError(error)}</p><Button onClick={() => void refetch()}>Coba lagi</Button></div> : isLoading ? <Spinner label="Memuat mitra..." /> : <>
    {data?.unit_active === false && <p role="status">Unit nonaktif. Data dapat dilihat, tetapi tidak dapat diubah.</p>}
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tab Imbal Hasil">
      {([{ id: 'recap', label: 'Rekap Catatan Imbal Hasil', icon: ClipboardList }, { id: 'partners', label: 'Data Mitra Usaha', icon: Users }] as const).map(item => {
        const Icon = item.icon
        return <Button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
          aria-controls={`yield-panel-${item.id}`} id={`yield-tab-${item.id}`}
          variant={tab === item.id ? 'default' : 'outline'} size="sm" onClick={() => setTab(item.id)}>
          <Icon size={16} />{item.label}
        </Button>
      })}
    </div>
      <section hidden={tab !== 'partners'} role="tabpanel" id="yield-panel-partners" aria-labelledby="yield-tab-partners" className="min-w-0 space-y-3">
        <div className="flex justify-end"><Button disabled={!writable} onClick={() => startEdit(null)}><Plus className="size-4" />Tambah Mitra</Button></div>
        <Card className="overflow-hidden p-0"><TableShell minWidth={720}><Table>
          <TableHeader><TableRow><TableHead>No.</TableHead>{sortable('name', 'Nama Mitra')}{sortable('capital', 'Jumlah Penyertaan Modal')}{sortable('yield_amount', 'Imbal Hasil (3%)')}<TableHead>Aksi</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map(row => <TableRow key={row.id}><TableCell>{row.no}</TableCell><TableCell>{row.name}</TableCell>
            <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtRp(row.capital)}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{fmtRp(row.yield_amount)}</TableCell>
            <TableCell><div className="flex gap-2"><Button variant="outline" disabled={!writable} onClick={() => startEdit(row)}><Pencil className="size-4" />Ubah</Button><Button variant="outline" disabled={!writable} onClick={() => void remove(row)}><Trash2 className="size-4" />Hapus</Button></div></TableCell>
          </TableRow>)}{!rows.length && <TableRow><TableCell colSpan={5} className="py-8 text-center">Belum ada mitra. Gunakan Tambah Mitra untuk mulai.</TableCell></TableRow>}</TableBody>
        </Table></TableShell></Card>
      </section>
      <section hidden={tab !== 'recap'} role="tabpanel" id="yield-panel-recap" aria-labelledby="yield-tab-recap" className="min-w-0 space-y-3">
        <p className="text-sm text-muted-foreground">Tanda — berarti pembayaran belum dicatat, bukan nilai Rp 0. Nama mitra mengikuti tab Data Mitra Usaha.</p>
        <Card className="overflow-hidden p-0"><TableShell minWidth={1700}><Table>
          <TableHeader><TableRow><TableHead rowSpan={2}>No.</TableHead>{sortable('name', 'Nama Mitra', undefined, 2)}<TableHead rowSpan={2}>Aksi</TableHead><TableHead colSpan={12} className="text-center">Pembayaran Imbal Hasil (3%)</TableHead>{sortable('total', 'Jumlah', undefined, 2)}</TableRow>
          <TableRow>{MONTHS.map((month, i) => <TableHead key={month} aria-sort={sort.key === `month-${i}` ? sort.desc ? 'descending' : 'ascending' : 'none'}><button type="button" className="inline-flex items-center gap-1" onClick={() => setSort({ key: `month-${i}`, desc: sort.key === `month-${i}` ? !sort.desc : false })}>{month}<ArrowUpDown className="size-3" /></button></TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map(row => <TableRow key={row.id}><TableCell>{row.no}</TableCell><TableCell>{row.name}</TableCell><TableCell><Button variant="outline" size="icon" aria-label={`Input pembayaran ${row.name}`} disabled={!writable} onClick={() => setPaymentPartner(row)}><Pencil className="size-4" /></Button></TableCell>{MONTHS.map((month, i) => <TableCell key={month} className="text-right whitespace-nowrap tabular-nums">{row.payments?.[String(i + 1)] == null ? '—' : fmtRp(row.payments[String(i + 1)])}</TableCell>)}<TableCell className="text-right whitespace-nowrap font-semibold tabular-nums">{paymentTotal(row) == null ? '—' : fmtRp(paymentTotal(row))}</TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={16} className="py-8 text-center">Belum ada mitra. Tambahkan melalui tab Data Mitra Usaha.</TableCell></TableRow>}</TableBody>
        </Table></TableShell></Card>
      </section>
    </>}
    {paymentPartner && <YieldPaymentDialog partner={paymentPartner} year={year} onClose={() => setPaymentPartner(null)} onSaved={async () => { await queryClient.invalidateQueries({ queryKey }) }} />}
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value) }}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Ubah Mitra' : 'Tambah Mitra'}</DialogTitle></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="yield-name">Nama Mitra</Label><Input id="yield-name" required maxLength={255} value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="yield-capital">Jumlah Penyertaan Modal (Rp)</Label><Input id="yield-capital" type="number" inputMode="decimal" required min="0.01" max="9999999999999999.99" step="0.01" value={capital} onChange={e => setCapital(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="yield-amount">Imbal Hasil (3%) — otomatis</Label><Input id="yield-amount" readOnly value={fmtRp(parseMoney(capital) * 0.03)} /></div>
        <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Menyimpan...' : 'Simpan'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>
}
