import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  emptyTransactionForm,
  transactionFormSchema,
  type TransactionFormValues,
} from '@/schemas/transactions'
import type { Account, TransactionType, UnitUsaha, User } from '@/types'

interface Props {
  editingId: string | null
  defaultValues?: TransactionFormValues
  units: UnitUsaha[]
  types: TransactionType[]
  accounts: Account[]
  user: User
  isPengelola: boolean
  onSubmit: (values: TransactionFormValues) => void | Promise<void>
  onCancel: () => void
}

export default function TxFormCard({
  editingId,
  defaultValues,
  units,
  types,
  accounts,
  user,
  isPengelola,
  onSubmit,
  onCancel,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaultValues ?? emptyTransactionForm(),
  })

  const unitUsahaId = watch('unit_usaha_id')

  const filteredTypes = (() => {
    let list: TransactionType[]
    if (!unitUsahaId) {
      list = types.filter((t) => (t.group || 'BUMDES') === 'BUMDES')
    } else {
      const unitCode = units.find((u) => u.id === unitUsahaId)?.code
      list = unitCode ? types.filter((t) => (t.group || 'BUMDES') === unitCode) : []
    }
    return [...list].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' }),
    )
  })()

  const filteredAccounts = (() => {
    const grp = unitUsahaId
      ? units.find((u) => u.id === unitUsahaId)?.code || 'BUMDES'
      : 'BUMDES'
    return accounts.filter((a) => (a.group || 'BUMDES') === grp)
  })()

  const onTypeChange = (code: string) => {
    const t = types.find((x) => x.code === code)
    setValue('transaction_type', code, { shouldValidate: true })
    if (t?.debit) setValue('debit_account_code', t.debit, { shouldValidate: true })
    if (t?.credit) setValue('credit_account_code', t.credit, { shouldValidate: true })
    // Create: prefer type name for description. Edit: leave description unchanged.
    if (!editingId && t?.name) {
      setValue('description', t.name, { shouldValidate: true })
    }
  }

  const onUnitChange = (unitId: string) => {
    setValue('unit_usaha_id', unitId, { shouldValidate: true })
    setValue('transaction_type', '', { shouldValidate: false })
  }

  const err = (msg?: string) =>
    msg ? (
      <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
        {msg}
      </p>
    ) : null

  return (
    <Card className="fade-in">
      <CardHeader>
        <CardTitle className="font-heading text-lg">
          {editingId ? 'Edit Transaksi' : 'Transaksi Baru'}
        </CardTitle>
      </CardHeader>
      <form onSubmit={(e) => void handleSubmit((v) => onSubmit(v))(e)}>
        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tx-date">Tanggal</Label>
            <Input
              id="tx-date"
              data-testid="tx-date"
              type="date"
              aria-invalid={Boolean(errors.date)}
              {...register('date')}
            />
            {err(errors.date?.message)}
          </div>
          <div className="space-y-1.5">
            <Label>Unit Usaha (opsional)</Label>
            <Controller
              control={control}
              name="unit_usaha_id"
              render={({ field }) => (
                <Select
                  value={field.value || '__bumdes__'}
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
              )}
            />
            {err(errors.unit_usaha_id?.message)}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Jenis Transaksi
              {unitUsahaId && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (difilter berdasarkan unit terpilih)
                </span>
              )}
            </Label>
            <Controller
              control={control}
              name="transaction_type"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={onTypeChange}
                >
                  <SelectTrigger data-testid="tx-type" aria-invalid={Boolean(errors.transaction_type)}>
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
              )}
            />
            {err(errors.transaction_type?.message)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">Nominal (Rp)</Label>
            <Input
              id="tx-amount"
              data-testid="tx-amount"
              type="number"
              min="0"
              step="1"
              placeholder="100000"
              aria-invalid={Boolean(errors.amount)}
              {...register('amount')}
            />
            {err(errors.amount?.message)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-ref">Nomor Referensi (opsional)</Label>
            <Input
              id="tx-ref"
              data-testid="tx-ref"
              placeholder="mis. nota-001"
              {...register('reference')}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tx-desc">Keterangan</Label>
            <Input
              id="tx-desc"
              data-testid="tx-desc"
              placeholder="Keterangan detail transaksi"
              aria-invalid={Boolean(errors.description)}
              {...register('description')}
            />
            {err(errors.description?.message)}
          </div>
          <div className="space-y-1.5">
            <Label>Debit</Label>
            <Controller
              control={control}
              name="debit_account_code"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger data-testid="tx-debit" aria-invalid={Boolean(errors.debit_account_code)}>
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
              )}
            />
            {err(errors.debit_account_code?.message)}
          </div>
          <div className="space-y-1.5">
            <Label>Kredit</Label>
            <Controller
              control={control}
              name="credit_account_code"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger data-testid="tx-credit" aria-invalid={Boolean(errors.credit_account_code)}>
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
              )}
            />
            {err(errors.credit_account_code?.message)}
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 sm:col-span-2">
          <Button type="button" onClick={onCancel} variant="outline">
            Batal
          </Button>
          <Button data-testid="tx-save" type="submit" disabled={isSubmitting}>
            {editingId ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
