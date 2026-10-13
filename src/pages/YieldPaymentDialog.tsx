import FormDialog from '@/components/FormDialog'
import { useState } from 'react'
import api, { fmtRp, getApiError } from '@/api/client'
import { useConfirm } from '@/components/ConfirmProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { YieldPartner } from './YieldPage'

export const PAYMENT_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export default function YieldPaymentDialog({
  partner,
  year,
  month: monthNumber,
  onClose,
  onSaved,
}: {
  partner: YieldPartner
  year: number
  month: number
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const month = String(monthNumber)
  const mm = String(monthNumber).padStart(2, '0')
  // Tanggal bebas di tahun periode (1 Jan – 31 Des).
  const firstDay = `${year}-01-01`
  const lastDay = `${year}-12-31`
  // Default isian baru: tanggal 28 bulan tsb; isian tersimpan memakai tanggal tercatat.
  const defaultDate = () => partner.payment_dates?.[month] || `${year}-${mm}-28`
  const recorded = partner.payments?.[month]
  const [transactionDate, setTransactionDate] = useState(defaultDate)
  const [automatic, setAutomatic] = useState(recorded == null)
  const [manual, setManual] = useState(recorded ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const confirm = useConfirm()
  const submit = async (remove: boolean) => {
    if (saving) return
    if (transactionDate && (transactionDate < firstDay || transactionDate > lastDay)) {
      setError(`Tanggal transaksi harus berada di tahun ${year}.`)
      return
    }
    if (
      !transactionDate ||
      (!automatic && (manual.trim() === '' || !Number.isFinite(Number(manual)) || Number(manual) <= 0))
    ) {
      setError('Isi tanggal transaksi dan jumlah setoran lebih dari nol.')
      return
    }
    setError('')
    if (
      remove &&
      !(await confirm({
        title: 'Hapus pembayaran?',
        description: `${partner.name} — ${PAYMENT_MONTHS[Number(month) - 1]} ${year}.`,
        confirmLabel: 'Hapus',
        destructive: true,
      }))
    )
      return
    setSaving(true)
    try {
      const payload = {
        transaction_date: transactionDate,
        year,
        month: Number(month),
        automatic,
        ...(automatic ? {} : { amount: manual }),
      }
      const url = `/imbal-hasil/mitra/${partner.id}/pembayaran`
      if (remove) await api.delete(url, { data: payload })
      else await api.put(url, payload)
      await onSaved()
      onClose()
    } catch (e) {
      setError(getApiError(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <FormDialog compact title={`${partner.name} - Setoran Periode : ${mm}/${year}`} error={error} onClose={onClose}>
      {({ cancel, run }) => (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => submit(false))
            }}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="payment-date">Tanggal Transaksi</Label>
              <Input
                id="payment-date"
                type="date"
                value={transactionDate}
                min={firstDay}
                max={lastDay}
                disabled={saving}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>
            <fieldset className="space-y-3" disabled={saving}>
              <legend className="mb-2 text-sm font-medium">Jumlah Setoran</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="payment-method" checked={automatic} onChange={() => setAutomatic(true)} />
                Nominal Otomatis (3%)
              </label>
              <Input aria-label="Nominal Otomatis (3%)" readOnly value={fmtRp(partner.yield_amount)} />
              <label className="flex items-center gap-2">
                <input type="radio" name="payment-method" checked={!automatic} onChange={() => setAutomatic(false)} />
                Nominal Senduene
              </label>
              <Input
                aria-label="Nominal Senduene (Rp)"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                disabled={automatic}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Input jumlah setoran"
              />
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Memproses...' : 'Simpan'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={() => void run(() => submit(true))}
              >
                Hapus
              </Button>
              <Button type="button" variant="outline" onClick={cancel}>
                Batal
              </Button>
            </div>
          </form>
        </>
      )}
    </FormDialog>
  )
}
