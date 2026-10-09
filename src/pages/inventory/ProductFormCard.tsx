import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { emptyProductForm, productFormSchema, type ProductFormValues } from '@/schemas/inventory'
import type { InventoryCategory } from '@/types'

interface Props {
  editingId: string | null
  defaultValues?: ProductFormValues
  categories: InventoryCategory[]
  onSubmit: (values: ProductFormValues) => void | Promise<void>
  onCancel: () => void
}

function fieldErr(msg?: string) {
  return msg ? (
    <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
      {msg}
    </p>
  ) : null
}

export default function ProductFormCard({ editingId, defaultValues, categories, onSubmit, onCancel }: Props) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultValues ?? emptyProductForm(),
  })

  useEffect(() => {
    reset(defaultValues ?? emptyProductForm())
  }, [defaultValues, editingId, reset])

  return (
    <Card className="fade-in">
      <CardContent className="pt-6">
        <p className="label mb-3">{editingId ? 'Edit produk' : 'Tambah produk'}</p>
        <form
          onSubmit={(e) => void handleSubmit((v) => onSubmit(v))(e)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div>
            <label className="label" htmlFor="inv-sku">
              SKU
            </label>
            <Input id="inv-sku" disabled={!!editingId} aria-invalid={Boolean(errors.sku)} {...register('sku')} />
            {fieldErr(errors.sku?.message)}
          </div>
          <div>
            <label className="label" htmlFor="inv-name">
              Nama produk
            </label>
            <Input id="inv-name" aria-invalid={Boolean(errors.name)} {...register('name')} />
            {fieldErr(errors.name?.message)}
          </div>
          <div>
            <label className="label">Kategori</label>
            <Controller
              control={control}
              name="category_id"
              render={({ field }) => (
                <Select
                  value={field.value || '__none__'}
                  onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger aria-invalid={Boolean(errors.category_id)}>
                    <SelectValue placeholder="— pilih —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— pilih —</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {fieldErr(errors.category_id?.message)}
          </div>
          <div>
            <label className="label" htmlFor="inv-uom">
              Satuan
            </label>
            <Input id="inv-uom" aria-invalid={Boolean(errors.unit_of_measure)} {...register('unit_of_measure')} />
            {fieldErr(errors.unit_of_measure?.message)}
          </div>
          <div>
            <label className="label" htmlFor="inv-cost">
              Harga pokok (Rp)
            </label>
            <Controller
              control={control}
              name="cost_price"
              render={({ field }) => (
                <Input
                  id="inv-cost"
                  type="number"
                  min="0"
                  step="1"
                  aria-invalid={Boolean(errors.cost_price)}
                  {...field}
                />
              )}
            />
            {fieldErr(errors.cost_price?.message)}
          </div>
          <div>
            <label className="label" htmlFor="inv-sell">
              Harga jual (Rp)
            </label>
            <Controller
              control={control}
              name="sell_price"
              render={({ field }) => (
                <Input
                  id="inv-sell"
                  type="number"
                  min="0"
                  step="1"
                  aria-invalid={Boolean(errors.sell_price)}
                  {...field}
                />
              )}
            />
            {fieldErr(errors.sell_price?.message)}
          </div>
          {!editingId && (
            <div>
              <label className="label" htmlFor="inv-opening">
                Qty awal
              </label>
              <Controller
                control={control}
                name="opening_qty"
                render={({ field }) => (
                  <Input
                    id="inv-opening"
                    type="number"
                    min="0"
                    step="1"
                    aria-invalid={Boolean(errors.opening_qty)}
                    {...field}
                  />
                )}
              />
              {fieldErr(errors.opening_qty?.message)}
            </div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {editingId ? 'Simpan perubahan' : 'Simpan produk'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
