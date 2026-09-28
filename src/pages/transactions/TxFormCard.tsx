import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Account, TransactionType, UnitUsaha, User } from '@/types'
import type { FormEvent } from 'react'
import type { TxFormState } from './types'

interface Props {
  editingId: string | null
  form: TxFormState
  setForm: (updater: TxFormState | ((f: TxFormState) => TxFormState)) => void
  units: UnitUsaha[]
  types: TransactionType[]
  accounts: Account[]
  user: User
  isPengelola: boolean
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
}

export default function TxFormCard({
  editingId,
  form,
  setForm,
  units,
  types,
  accounts,
  user,
  isPengelola,
  onSubmit,
  onCancel,
}: Props) {
  const filteredTypes = (() => {
    let list: TransactionType[]
    if (!form.unit_usaha_id) {
      list = types.filter((t) => (t.group || 'BUMDES') === 'BUMDES')
    } else {
      const unitCode = units.find((u) => u.id === form.unit_usaha_id)?.code
      list = unitCode ? types.filter((t) => (t.group || 'BUMDES') === unitCode) : []
    }
    return [...list].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' }),
    )
  })()

  const filteredAccounts = (() => {
    const grp = form.unit_usaha_id
      ? units.find((u) => u.id === form.unit_usaha_id)?.code || 'BUMDES'
      : 'BUMDES'
    return accounts.filter((a) => (a.group || 'BUMDES') === grp)
  })()

  const onTypeChange = (code: string) => {
    const t = types.find((x) => x.code === code)
    setForm((f) => ({
      ...f,
      transaction_type: code,
      debit_account_code: t?.debit || f.debit_account_code,
      credit_account_code: t?.credit || f.credit_account_code,
      description: (editingId ? f.description : t?.name) || f.description,
    }))
  }

  const onUnitChange = (unitId: string) => {
    setForm((f) => ({ ...f, unit_usaha_id: unitId, transaction_type: '' }))
  }

  return (
    <Card className="fade-in">
      <CardHeader>
        <CardTitle className="font-heading text-lg">
          {editingId ? 'Edit Transaksi' : 'Transaksi Baru'}
        </CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tanggal</Label>
            <Input
              data-testid="tx-date"
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Usaha (opsional)</Label>
            <Select
              value={form.unit_usaha_id || '__bumdes__'}
              onValueChange={(v) => onUnitChange(v === '__bumdes__' ? '' : v)}
              disabled={isPengelola}
            >
              <SelectTrigger data-testid="tx-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!isPengelola && <SelectItem value="__bumdes__">BUMDES - Pusat</SelectItem>}
                {units
                  .filter((u) => !isPengelola || u.id === user.unit_usaha_id)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.code} - {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Jenis Transaksi
              {form.unit_usaha_id && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (difilter berdasarkan unit terpilih)
                </span>
              )}
            </Label>
            <Select
              required
              value={form.transaction_type || undefined}
              onValueChange={onTypeChange}
            >
              <SelectTrigger data-testid="tx-type">
                <SelectValue placeholder="— pilih jenis —" />
              </SelectTrigger>
              <SelectContent>
                {filteredTypes.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nominal (Rp)</Label>
            <Input
              data-testid="tx-amount"
              type="number"
              min="0"
              step="1"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="100000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nomor Referensi (opsional)</Label>
            <Input
              data-testid="tx-ref"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="mis. nota-001"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Keterangan</Label>
            <Input
              data-testid="tx-desc"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Keterangan detail transaksi"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Debit</Label>
            <Select
              required
              value={form.debit_account_code || undefined}
              onValueChange={(v) => setForm({ ...form, debit_account_code: v })}
            >
              <SelectTrigger data-testid="tx-debit">
                <SelectValue placeholder="— pilih akun —" />
              </SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((a) => (
                  <SelectItem key={a.code} value={a.code}>
                    {a.code} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kredit</Label>
            <Select
              required
              value={form.credit_account_code || undefined}
              onValueChange={(v) => setForm({ ...form, credit_account_code: v })}
            >
              <SelectTrigger data-testid="tx-credit">
                <SelectValue placeholder="— pilih akun —" />
              </SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((a) => (
                  <SelectItem key={a.code} value={a.code}>
                    {a.code} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 sm:col-span-2">
          <Button type="button" onClick={onCancel} variant="outline">
            Batal
          </Button>
          <Button data-testid="tx-save" type="submit">
            {editingId ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
