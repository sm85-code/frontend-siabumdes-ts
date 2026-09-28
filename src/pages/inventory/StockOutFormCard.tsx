import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmtRp } from '@/api/client'
import {
  CoaSelect,
  KAS_ACCOUNT_CODE,
  PIUTANG_ACCOUNT_CODE,
} from '@/lib/uu05InventoryCoa'
import {
  emptyStockOutForm,
  stockOutFormSchema,
  stockOutInternalDebit,
  stockOutSaleDebit,
  type StockOutFormValues,
} from '@/schemas/inventory'
import type { InventoryPartner, InventoryProduct } from '@/types'

interface Props {
  products: InventoryProduct[]
  customers: InventoryPartner[]
  onSubmit: (values: StockOutFormValues) => void | Promise<void>
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
  const productId = watch('product_id')
  const quantity = watch('quantity')
  const sellPrice = watch('sell_price')

  const productOptions = products.map((p) => ({
    id: p.id,
    label: `${p.sku} — ${p.name} (stok ${p.qty_on_hand})`,
  }))

  const selected = products.find((p) => p.id === productId)
  const hppPreview = Number(quantity || 0) * Number(selected?.cost_price || 0)
  const salePreview = Number(quantity || 0) * Number(sellPrice || 0)

  const submit = async (values: StockOutFormValues) => {
    const product = products.find((p) => p.id === values.product_id)
    if (product && Number(values.quantity) > Number(product.qty_on_hand)) {
      onClientError(
        `Qty keluar (${values.quantity}) melebihi stok tersedia (${product.qty_on_hand}).`,
      )
      return
    }
    await onSubmit(values)
    reset(emptyStockOutForm())
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(submit)(e)}
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
      <div>
        <label className="label">Produk</label>
        <Controller
          control={control}
          name="product_id"
          render={({ field }) => (
            <Select
              value={field.value || '__none__'}
              onValueChange={(v) => {
                const id = v === '__none__' ? '' : v
                const p = products.find((x) => x.id === id)
                field.onChange(id)
                setValue('sell_price', p ? String(Number(p.sell_price) || 0) : '0', {
                  shouldValidate: true,
                })
              }}
            >
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
        <Input
          id="so-date"
          type="date"
          aria-invalid={Boolean(errors.movement_date)}
          {...register('movement_date')}
        />
        {fieldErr(errors.movement_date?.message)}
      </div>
      <div>
        <label className="label" htmlFor="so-qty">
          Qty keluar
        </label>
        <Input
          id="so-qty"
          type="number"
          min="1"
          step="1"
          aria-invalid={Boolean(errors.quantity)}
          {...register('quantity')}
        />
        {fieldErr(errors.quantity?.message)}
      </div>
      {isInternal ? (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="so-note">
            Catatan (opsional)
          </label>
          <Input
            id="so-note"
            placeholder="mis. dipakai untuk operasional kantor"
            {...register('note')}
          />
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
            <label className="label" htmlFor="so-sell">
              Harga jual / unit (Rp)
            </label>
            <Input
              id="so-sell"
              type="number"
              min="0"
              step="1"
              aria-invalid={Boolean(errors.sell_price)}
              {...register('sell_price')}
            />
            {fieldErr(errors.sell_price?.message)}
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
              <Input
                id="so-due"
                type="date"
                aria-invalid={Boolean(errors.due_date)}
                {...register('due_date')}
              />
              {fieldErr(errors.due_date?.message)}
            </div>
          )}
        </>
      )}
      <div>
        <label className="label">{isInternal ? 'Akun debit (Beban)' : 'Akun debit (HPP)'}</label>
        <Controller
          control={control}
          name="debit_account_code"
          render={({ field }) => (
            <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />
          )}
        />
        {fieldErr(errors.debit_account_code?.message)}
      </div>
      <div>
        <label className="label">Akun kredit (Persediaan)</label>
        <Controller
          control={control}
          name="credit_account_code"
          render={({ field }) => (
            <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />
          )}
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
              render={({ field }) => (
                <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />
              )}
            />
            {fieldErr(errors.revenue_debit_account_code?.message)}
          </div>
          <div>
            <label className="label">Akun kredit (Pendapatan)</label>
            <Controller
              control={control}
              name="revenue_credit_account_code"
              render={({ field }) => (
                <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />
              )}
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
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : 'Catat stock out'}
        </Button>
      </div>
    </form>
  )
}
