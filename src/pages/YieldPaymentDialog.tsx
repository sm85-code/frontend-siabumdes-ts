import { useState, type FormEvent } from 'react'
import api, { fmtRp, getApiError } from '@/api/client'
import { useConfirm } from '@/components/ConfirmProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { YieldPartner } from './YieldPage'

export const PAYMENT_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export default function YieldPaymentDialog({ partner, year, onClose, onSaved }: {
  partner: YieldPartner; year: number; onClose: () => void; onSaved: () => Promise<void>
}) {
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const [transactionDate, setTransactionDate] = useState(today)
  const [month, setMonth] = useState('')
  const [automatic, setAutomatic] = useState(true)
  const [manual, setManual] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const confirm = useConfirm()
  const selectMonth = (value: string) => {
    setMonth(value); setError('')
    setTransactionDate(partner.payment_dates?.[value] || today())
    const recorded = partner.payments?.[value]
    setManual(recorded ?? '')
    setAutomatic(recorded == null)
  }
  const submit = async (remove: boolean) => {
    if (saving) return
    if (!transactionDate || !month || (!automatic && (manual.trim() === '' || !Number.isFinite(Number(manual)) || Number(manual) <= 0))) {
      setError('Pilih bulan, tanggal transaksi, dan nominal pembayaran lebih dari nol.')
      return
    }
    setError('')
    if (remove && !await confirm({ title: 'Hapus pembayaran?', description: `${partner.name} — ${PAYMENT_MONTHS[Number(month) - 1]} ${year}.`, confirmLabel: 'Hapus', destructive: true })) return
    setSaving(true)
    try {
      const payload = { transaction_date: transactionDate, year, month: Number(month), automatic, ...(automatic ? {} : { amount: manual }) }
      const url = `/imbal-hasil/mitra/${partner.id}/pembayaran`
      if (remove) await api.delete(url, { data: payload })
      else await api.put(url, payload)
      await onSaved()
      onClose()
    } catch (e) { setError(getApiError(e)) } finally { setSaving(false) }
  }
  const save = (e: FormEvent) => { e.preventDefault(); void submit(false) }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}><DialogContent>
    <DialogHeader><DialogTitle>Input Pembayaran</DialogTitle></DialogHeader>
    <p className="text-sm font-medium">{partner.name} · Tahun {year}</p>
    <form onSubmit={save} className="space-y-4" noValidate>
      <div className="space-y-2"><Label htmlFor="payment-month">Bulan</Label>
        <select id="payment-month" className="h-10 w-full rounded-lg border bg-popover px-3 text-popover-foreground" value={month} disabled={saving} onChange={e => selectMonth(e.target.value)}>
          <option value="">Pilih bulan</option>{PAYMENT_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
        </select>
        {month && <p className="text-xs text-muted-foreground">{partner.payments?.[month] == null ? 'Belum ada pembayaran tercatat.' : `Pembayaran tercatat: ${fmtRp(partner.payments[month])}. Simpan akan memperbarui nilai bulan ini.`}</p>}
      </div>
      <div className="space-y-2"><Label htmlFor="payment-date">Tanggal transaksi</Label><Input id="payment-date" type="date" value={transactionDate} disabled={saving} onChange={e => setTransactionDate(e.target.value)} /></div>
      <fieldset className="space-y-3" disabled={saving}><legend className="mb-2 text-sm font-medium">Metode nominal</legend>
        <label className="flex items-center gap-2"><input type="radio" name="payment-method" checked={automatic} onChange={() => setAutomatic(true)} />Otomatis 3%</label>
        <Input aria-label="Nominal otomatis 3%" readOnly value={fmtRp(partner.yield_amount)} />
        <label className="flex items-center gap-2"><input type="radio" name="payment-method" checked={!automatic} onChange={() => setAutomatic(false)} />Nominal Manual</label>
        <Input aria-label="Nominal manual (Rp)" type="number" inputMode="decimal" min="0.01" step="0.01" disabled={automatic} value={manual} onChange={e => setManual(e.target.value)} placeholder="Input nominal Imbal Hasil" />
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}>{saving ? 'Memproses...' : 'Simpan'}</Button><Button type="button" variant="destructive" disabled={saving} onClick={() => void submit(true)}>Hapus</Button></div>
    </form>
  </DialogContent></Dialog>
}
