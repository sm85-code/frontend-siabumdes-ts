import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmtRp } from '@/api/client'
import { CoaSelect, KAS_ACCOUNT_CODE, PIUTANG_ACCOUNT_CODE } from '@/lib/uu05InventoryCoa'
import {
  emptyStockOutForm,
  emptyStockOutLine,
  stockOutFormSchema,
  stockOutInternalDebit,
  stockOutSaleDebit,
  type StockOutFormValues,
} from '@/schemas/inventory'
import type { InventoryPartner, InventoryProduct } from '@/types'

interface Props {
  products: InventoryProduct[]
  customers: InventoryPartner[]
  /** again=true: Simpan & input lagi (dialog tetap terbuka). */
  onSubmit: (values: StockOutFormValues, again: boolean) => void | Promise<void>
  /** Same oversell guard as before — set page-level error string. */
  onClientError: (msg: string) => void
}

function fieldErr(msg?: string) {
  return msg ? (
    <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
      {msg}
    </p>
  ) : null
}

export default function StockOutFormCard({ products, customers, onSubmit, onClientError }: Props) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockOutFormValues>({
    resolver: zodResolver(stockOutFormSchema),
    defaultValues: emptyStockOutForm(),
  })

  const isInternal = watch('isInternal')
  const paymentMethod = watch('payment_method')
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = watch('lines')

  const productOptions = products.map((p) => ({
    id: p.id,
    label: `${p.sku} — ${p.name} (stok ${p.qty_on_hand})`,
  }))

  const used = isInternal ? lines.slice(0, 1) : lines
  const hppPreview = used.reduce(
    (sum, l) => sum + Number(l.quantity || 0) * Number(products.find((p) => p.id === l.product_id)?.cost_price || 0), 0)
  const salePreview = used.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.sell_price || 0), 0)

  const submit = (again: boolean) => async (values: StockOutFormValues) => {
    const rows = values.isInternal ? values.lines.slice(0, 1) : values.lines
    // Qty per produk dijumlah (produk sama bisa muncul di beberapa baris).
    const need = new Map<string, number>()
    rows.forEach((l) => need.set(l.product_id, (need.get(l.product_id) || 0) + Number(l.quantity)))
    for (const [id, qty] of need) {
      const product = products.find((p) => p.id === id)
      if (product && qty > Number(product.qty_on_hand)) {
        onClientError(`${product.sku}: qty keluar (${qty}) melebihi stok (${product.qty_on_hand}).`)
        return
      }
    }
    await onSubmit({ ...values, lines: rows }, again)
    reset(again ? { ...values, invoice_number: '', note: '', lines: [emptyStockOutLine()] } : emptyStockOutForm())
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(submit(false))(e).catch(() => {})}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <label
        className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2"
        data-testid="stock-out-internal-toggle"
      >
        <Controller
          control={control}
          name="isInternal"
          render={({ field }) => (
            <input
              type="checkbox"
              checked={field.value}
              onChange={(e) => {
                const next = e.target.checked
                field.onChange(next)
                setValue('debit_account_code', next ? stockOutInternalDebit : stockOutSaleDebit, {
                  shouldValidate: true,
                })
              }}
            />
          )}
        />
        Pemakaian / transfer internal (bukan penjualan ke pihak luar)
      </label>
      {!isInternal && (
        <div>
          <label className="label">Customer</label>
          <Controller
            control={control}
            name="customer_id"
            render={({ field }) => (
              <Select
                value={field.value || '__none__'}
                onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
              >
                <SelectTrigger aria-invalid={Boolean(errors.customer_id)}>
                  <SelectValue placeholder="— pilih customer —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— pilih customer —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {fieldErr(errors.customer_id?.message)}
          {customers.length === 0 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Belum ada customer — tambahkan di tab Customer.
            </p>
          )}
        </div>
      )}
      <div>
        <label className="label" htmlFor="so-date">
          Tanggal
        </label>
        <Input id="so-date" type="date" aria-invalid={Boolean(errors.movement_date)} {...register('movement_date')} />
        {fieldErr(errors.movement_date?.message)}
      </div>
      {isInternal ? (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="so-note">
            Catatan (opsional)
          </label>
          <Input id="so-note" placeholder="mis. dipakai untuk operasional kantor" {...register('note')} />
        </div>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="so-invoice">
              No. Invoice
            </label>
            <Input id="so-invoice" {...register('invoice_number')} />
          </div>
          <div>
            <label className="label">Metode bayar</label>
            <Controller
              control={control}
              name="payment_method"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(method) => {
                    field.onChange(method)
                    setValue(
                      'revenue_debit_account_code',
                      method === 'piutang' ? PIUTANG_ACCOUNT_CODE : KAS_ACCOUNT_CODE,
                      { shouldValidate: true },
                    )
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="piutang">Piutang</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {fieldErr(errors.payment_method?.message)}
          </div>
          {paymentMethod === 'piutang' && (
            <div>
              <label className="label" htmlFor="so-due">
                Jatuh tempo
              </label>
              <Input id="so-due" type="date" aria-invalid={Boolean(errors.due_date)} {...register('due_date')} />
              {fieldErr(errors.due_date?.message)}
            </div>
          )}
        </>
      )}
      <div className="sm:col-span-2 space-y-2">
        <label className="label">Barang</label>
        {fields.map((f, i) => {
          const err = errors.lines?.[i]
          const line = lines[i]
          return (
            <div key={f.id} className="rounded-md border p-2 space-y-2" data-testid="stock-out-line">
              <div className="flex items-center gap-2">
                <span className="text-xs w-5 shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Controller
                    control={control}
                    name={`lines.${i}.product_id`}
                    render={({ field }) => (
                      <Select
                        value={field.value || '__none__'}
                        onValueChange={(v) => {
                          const id = v === '__none__' ? '' : v
                          const p = products.find((x) => x.id === id)
                          field.onChange(id)
                          setValue(`lines.${i}.sell_price`, p ? String(Number(p.sell_price) || 0) : '0', { shouldValidate: true })
                        }}
                      >
                        <SelectTrigger aria-invalid={Boolean(err?.product_id)}>
                          <SelectValue placeholder="— produk —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— produk —</SelectItem>
                          {productOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Hapus baris ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 pl-7">
                <Input type="number" min="1" step="1" placeholder="Qty" aria-label="Qty" aria-invalid={Boolean(err?.quantity)} {...register(`lines.${i}.quantity`)} />
                {!isInternal && (
                  <Input type="number" min="0" step="1" placeholder="Harga jual" aria-label="Harga jual" aria-invalid={Boolean(err?.sell_price)} {...register(`lines.${i}.sell_price`)} />
                )}
                {!isInternal && (
                  <p className="self-center text-right text-sm">{fmtRp(Number(line?.quantity || 0) * Number(line?.sell_price || 0))}</p>
                )}
              </div>
              {fieldErr(err?.product_id?.message || err?.quantity?.message || err?.sell_price?.message)}
            </div>
          )
        })}
        {!isInternal && (
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={() => append(emptyStockOutLine())}>
              <Plus className="h-4 w-4" /> Tambah baris
            </Button>
            <p className="text-sm">Total <strong>{fmtRp(salePreview)}</strong></p>
          </div>
        )}
      </div>
      <div>
        <label className="label">{isInternal ? 'Akun debit (Beban)' : 'Akun debit (HPP)'}</label>
        <Controller
          control={control}
          name="debit_account_code"
          render={({ field }) => <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />}
        />
        {fieldErr(errors.debit_account_code?.message)}
      </div>
      <div>
        <label className="label">Akun kredit (Persediaan)</label>
        <Controller
          control={control}
          name="credit_account_code"
          render={({ field }) => <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />}
        />
        {fieldErr(errors.credit_account_code?.message)}
      </div>
      {!isInternal && (
        <>
          <div>
            <label className="label">
              Akun debit penjualan ({paymentMethod === 'piutang' ? 'Piutang' : 'Kas/Bank'})
            </label>
            <Controller
              control={control}
              name="revenue_debit_account_code"
              render={({ field }) => <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />}
            />
            {fieldErr(errors.revenue_debit_account_code?.message)}
          </div>
          <div>
            <label className="label">Akun kredit (Pendapatan)</label>
            <Controller
              control={control}
              name="revenue_credit_account_code"
              render={({ field }) => <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />}
            />
            {fieldErr(errors.revenue_credit_account_code?.message)}
          </div>
        </>
      )}
      <Card className="p-3 text-sm sm:col-span-2" style={{ background: 'var(--surface-alt)' }}>
        <p>
          Preview jurnal {isInternal ? 'Beban' : 'HPP'}: <strong>{fmtRp(hppPreview)}</strong>
        </p>
        {!isInternal && (
          <p>
            Preview jurnal Penjualan: <strong>{fmtRp(salePreview)}</strong>
          </p>
        )}
      </Card>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => void handleSubmit(submit(true))().catch(() => {})}>
          Simpan &amp; input lagi
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}
