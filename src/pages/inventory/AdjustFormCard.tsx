import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BEBAN_KERUGIAN_BARANG_ACCOUNT_CODE,
  CoaSelect,
  PENYESUAIAN_NILAI_PERSEDIAAN_ACCOUNT_CODE,
  PERSEDIAAN_ACCOUNT_CODE,
} from '@/lib/uu05InventoryCoa'
import { adjustFormSchema, emptyAdjustForm, type AdjustFormValues } from '@/schemas/inventory'
import type { InventoryProduct } from '@/types'

interface Props {
  products: InventoryProduct[]
  onSubmit: (values: AdjustFormValues) => void | Promise<void>
}

function fieldErr(msg?: string) {
  return msg ? (
    <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
      {msg}
    </p>
  ) : null
}

export default function AdjustFormCard({ products, onSubmit }: Props) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustFormSchema),
    defaultValues: emptyAdjustForm(),
  })

  const quantityDelta = watch('quantity_delta')
  const isLoss = Number(quantityDelta) < 0

  const productOptions = products.map((p) => ({
    id: p.id,
    label: `${p.sku} — ${p.name} (stok ${p.qty_on_hand})`,
  }))

  const submit = async (values: AdjustFormValues) => {
    await onSubmit(values)
    reset(emptyAdjustForm())
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(submit)(e).catch(() => {})}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <div>
        <label className="label">Produk</label>
        <Controller
          control={control}
          name="product_id"
          render={({ field }) => (
            <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
              <SelectTrigger aria-invalid={Boolean(errors.product_id)}>
                <SelectValue placeholder="— pilih —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— pilih —</SelectItem>
                {productOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {fieldErr(errors.product_id?.message)}
      </div>
      <div>
        <label className="label" htmlFor="adj-date">
          Tanggal
        </label>
        <Input
          id="adj-date"
          type="date"
          aria-invalid={Boolean(errors.adjustment_date)}
          {...register('adjustment_date')}
        />
        {fieldErr(errors.adjustment_date?.message)}
      </div>
      <div>
        <label className="label" htmlFor="adj-delta">
          Delta qty (+/-)
        </label>
        <Controller
          control={control}
          name="quantity_delta"
          render={({ field }) => (
            <Input id="adj-delta" type="number" step="1" aria-invalid={Boolean(errors.quantity_delta)} {...field} />
          )}
        />
        {fieldErr(errors.quantity_delta?.message)}
      </div>
      <div>
        <label className="label">Alasan</label>
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rusak">Rusak</SelectItem>
                <SelectItem value="kadaluarsa">Kadaluarsa</SelectItem>
                <SelectItem value="koreksi">Koreksi</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {fieldErr(errors.reason?.message)}
      </div>

      {isLoss ? (
        <Card className="space-y-3 p-3 text-sm sm:col-span-2" style={{ background: 'var(--surface-alt)' }}>
          <div>
            <p className="mb-1 font-medium">Jurnal 1 — Pengurangan fisik nilai persediaan</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <CoaSelect
                value={PENYESUAIAN_NILAI_PERSEDIAAN_ACCOUNT_CODE}
                onChange={() => {}}
                disabled
                id="adj-loss-debit-1"
              />
              <CoaSelect value={PERSEDIAAN_ACCOUNT_CODE} onChange={() => {}} disabled id="adj-loss-credit-1" />
            </div>
          </div>
          <div>
            <p className="mb-1 font-medium">Jurnal 2 — Pengakuan beban kerugian</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <CoaSelect
                value={BEBAN_KERUGIAN_BARANG_ACCOUNT_CODE}
                onChange={() => {}}
                disabled
                id="adj-loss-debit-2"
              />
              <CoaSelect
                value={PENYESUAIAN_NILAI_PERSEDIAAN_ACCOUNT_CODE}
                onChange={() => {}}
                disabled
                id="adj-loss-credit-2"
              />
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div>
            <label className="label">Akun debit (Persediaan)</label>
            <Controller
              control={control}
              name="debit_account_code"
              render={({ field }) => <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />}
            />
            {fieldErr(errors.debit_account_code?.message)}
          </div>
          <div>
            <label className="label">Akun kredit (Pendapatan/Offset)</label>
            <Controller
              control={control}
              name="credit_account_code"
              render={({ field }) => <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />}
            />
            {fieldErr(errors.credit_account_code?.message)}
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <label className="label" htmlFor="adj-notes">
          Catatan
        </label>
        <Input id="adj-notes" {...register('notes')} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : 'Simpan penyesuaian'}
        </Button>
      </div>
    </form>
  )
}
