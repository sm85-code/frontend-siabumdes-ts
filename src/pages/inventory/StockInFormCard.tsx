import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import HelpHint from '@/components/HelpHint'
import { CoaSelect, KAS_ACCOUNT_CODE, PERSEDIAAN_ACCOUNT_CODE, UTANG_ACCOUNT_CODE } from '@/lib/uu05InventoryCoa'
import { emptyStockInForm, stockInFormSchema, type StockInFormValues } from '@/schemas/inventory'
import type { InventoryPartner, InventoryProduct } from '@/types'

interface Props {
  products: InventoryProduct[]
  vendors: InventoryPartner[]
  onSubmit: (values: StockInFormValues) => void | Promise<void>
  onOpenCatalog?: () => void
}

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

function fieldErr(msg?: string) {
  return msg ? (
    <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
      {msg}
    </p>
  ) : null
}

export default function StockInFormCard({ products, vendors, onSubmit, onOpenCatalog }: Props) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockInFormValues>({
    resolver: zodResolver(stockInFormSchema),
    defaultValues: emptyStockInForm(),
  })

  const paymentMethod = watch('payment_method')
  const modalAwal = paymentMethod === 'modal_awal'
  const selected = products.find((p) => p.id === watch('product_id'))
  const lockedCost = selected && Number(selected.qty_on_hand) > 0 && Number(selected.cost_price) > 0 ? Number(selected.cost_price) : null
  const productOptions = products.map((p) => ({
    id: p.id,
    label: `${p.sku} — ${p.name} (stok ${p.qty_on_hand})`,
  }))

  const submit = async (values: StockInFormValues) => {
    await onSubmit(values)
    reset(emptyStockInForm())
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
            <Select
              value={field.value || '__none__'}
              onValueChange={(v) => {
                const id = v === '__none__' ? '' : v
                const p = products.find((x) => x.id === id)
                field.onChange(id)
                setValue('unit_cost', p ? String(Number(p.cost_price) || 0) : '0', {
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
      <div>
        <label className="label">Mitra Pemasok{modalAwal && ' (opsional)'}</label>
        <Controller
          control={control}
          name="vendor_id"
          render={({ field }) => (
            <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
              <SelectTrigger aria-invalid={Boolean(errors.vendor_id)}>
                <SelectValue placeholder="— pilih mitra pemasok —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— pilih mitra pemasok —</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {fieldErr(errors.vendor_id?.message)}
        {vendors.length === 0 && !modalAwal && (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Belum ada mitra pemasok — tambahkan di tab Mitra Pemasok.
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="si-date">
          Tanggal
        </label>
        <Input id="si-date" type="date" aria-invalid={Boolean(errors.movement_date)} {...register('movement_date')} />
        {fieldErr(errors.movement_date?.message)}
      </div>
      <div>
        <label className="label" htmlFor="si-invoice">
          No. Invoice
        </label>
        <Input id="si-invoice" {...register('invoice_number')} />
      </div>
      <div>
        <label className="label" htmlFor="si-qty">
          Qty masuk
        </label>
        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <Input id="si-qty" type="number" min="1" step="1" aria-invalid={Boolean(errors.quantity)} {...field} />
          )}
        />
        {fieldErr(errors.quantity?.message)}
      </div>
      <div>
        <label className="label inline-flex items-center gap-1" htmlFor="si-cost">
          HPP / unit (Rp)
          <HelpHint label="Tentang HPP / unit">
            <p>Satu SKU satu harga beli. Selama SKU masih ada stok, HPP / unit terkunci. Harga beli berbeda: buat SKU baru di Katalog Produk.</p>
          </HelpHint>
        </label>
        <Controller
          control={control}
          name="unit_cost"
          render={({ field }) => (
            <Input id="si-cost" type="number" min="0" step="1" readOnly={lockedCost !== null} aria-invalid={Boolean(errors.unit_cost)} {...field} />
          )}
        />
        {lockedCost !== null && (
          <p className="mt-1 text-xs" style={{ color: 'var(--status-warning, var(--text-muted))' }}>
            Terkunci sesuai HPP SKU ini ({rupiah(lockedCost)}). Harga beli beda? Buat SKU baru untuk harga baru.
            {onOpenCatalog && (
              <>
                {' '}
                <button type="button" className="underline" onClick={onOpenCatalog}>
                  Buka Katalog Produk
                </button>
              </>
            )}
          </p>
        )}
        {fieldErr(errors.unit_cost?.message)}
      </div>
      <div>
        <label className="label inline-flex items-center gap-1">
          Sumber dana
          <HelpHint label="Tentang Belanja Modal Awal">
            <p>Belanja Modal Awal: barang dibeli dari modal yang sudah masuk kas. Jurnal otomatis Debit Persediaan, Kredit Kas UU05. Tidak masuk Utang dan Rekap Pembelian.</p>
          </HelpHint>
        </label>
        <Controller
          control={control}
          name="payment_method"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(method) => {
                field.onChange(method)
                if (method === 'modal_awal') setValue('debit_account_code', PERSEDIAAN_ACCOUNT_CODE)
                setValue('credit_account_code', method === 'credit' ? UTANG_ACCOUNT_CODE : KAS_ACCOUNT_CODE, {
                  shouldValidate: true,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Kas unit</SelectItem>
                <SelectItem value="credit">Utang pemasok</SelectItem>
                <SelectItem value="modal_awal">Belanja Modal Awal</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {fieldErr(errors.payment_method?.message)}
      </div>
      {paymentMethod === 'credit' && (
        <div>
          <label className="label" htmlFor="si-due">
            Jatuh tempo
          </label>
          <Input id="si-due" type="date" aria-invalid={Boolean(errors.due_date)} {...register('due_date')} />
          {fieldErr(errors.due_date?.message)}
        </div>
      )}
      {!modalAwal && (<>
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
        <label className="label">Akun kredit ({paymentMethod === 'credit' ? 'Utang Usaha' : 'Kas/Bank'})</label>
        <Controller
          control={control}
          name="credit_account_code"
          render={({ field }) => <CoaSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} />}
        />
        {fieldErr(errors.credit_account_code?.message)}
      </div>
      </>)}
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : 'Catat stock in'}
        </Button>
      </div>
    </form>
  )
}
