import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import HelpHint from '@/components/HelpHint'
import { CoaSelect, KAS_ACCOUNT_CODE, PERSEDIAAN_ACCOUNT_CODE, UTANG_ACCOUNT_CODE } from '@/lib/uu05InventoryCoa'
import { emptyStockInForm, emptyStockInLine, stockInFormSchema, type StockInFormValues } from '@/schemas/inventory'
import type { InventoryPartner, InventoryProduct } from '@/types'

interface Props {
  products: InventoryProduct[]
  vendors: InventoryPartner[]
  /** again=true: Simpan & input lagi (dialog tetap terbuka). */
  onSubmit: (values: StockInFormValues, again: boolean) => void | Promise<void>
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
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = watch('lines')
  const total = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_cost || 0), 0)
  const lockedCostOf = (p?: InventoryProduct) =>
    p && Number(p.qty_on_hand) > 0 && Number(p.cost_price) > 0 ? Number(p.cost_price) : null
  const productOptions = products.map((p) => ({
    id: p.id,
    label: `${p.sku} — ${p.name} (stok ${p.qty_on_hand})`,
  }))

  const submit = (again: boolean) => async (values: StockInFormValues) => {
    await onSubmit(values, again)
    // Simpan & input lagi: header (tanggal, pemasok, sumber dana) tetap, barang dikosongkan.
    reset(again ? { ...values, invoice_number: '', lines: [emptyStockInLine()] } : emptyStockInForm())
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(submit(false))(e).catch(() => {})}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
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
      <div className="sm:col-span-2 space-y-2">
        <label className="label inline-flex items-center gap-1">
          Barang
          <HelpHint label="Tentang HPP / unit">
            <p>Satu SKU satu harga beli. Selama SKU masih ada stok, HPP / unit terkunci. Harga beli berbeda: buat SKU baru di Katalog Produk.</p>
          </HelpHint>
        </label>
        {fields.map((f, i) => {
          const p = products.find((x) => x.id === lines[i]?.product_id)
          const locked = lockedCostOf(p)
          const err = errors.lines?.[i]
          return (
            <div key={f.id} className="rounded-md border p-2 space-y-2" data-testid="stock-in-line">
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
                          const np = products.find((x) => x.id === id)
                          field.onChange(id)
                          setValue(`lines.${i}.unit_cost`, np ? String(Number(np.cost_price) || 0) : '0', { shouldValidate: true })
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
                <Controller control={control} name={`lines.${i}.quantity`} render={({ field }) => <Input type="number" min="1" step="1" placeholder="Qty" aria-label="Qty" aria-invalid={Boolean(err?.quantity)} {...field} />} />
                <Controller control={control} name={`lines.${i}.unit_cost`} render={({ field }) => <Input type="number" min="0" step="1" placeholder="HPP/unit" aria-label="HPP/unit" readOnly={locked !== null} aria-invalid={Boolean(err?.unit_cost)} {...field} />} />
                <p className="self-center text-right text-sm">{rupiah(Number(lines[i]?.quantity || 0) * Number(lines[i]?.unit_cost || 0))}</p>
              </div>
              {locked !== null && (
                <p className="pl-7 text-xs" style={{ color: 'var(--status-warning, var(--text-muted))' }}>
                  Terkunci {rupiah(locked)}. Harga beda? Buat SKU baru.
                  {onOpenCatalog && (
                    <>
                      {' '}
                      <button type="button" className="underline" onClick={onOpenCatalog}>Katalog</button>
                    </>
                  )}
                </p>
              )}
              {fieldErr(err?.product_id?.message || err?.quantity?.message || err?.unit_cost?.message)}
            </div>
          )
        })}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyStockInLine())}>
            <Plus className="h-4 w-4" /> Tambah baris
          </Button>
          <p className="text-sm">Total <strong>{rupiah(total)}</strong></p>
        </div>
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
