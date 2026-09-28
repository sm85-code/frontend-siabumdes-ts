import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  emptyPartnerFormValues,
  partnerFormSchema,
  type PartnerFormValues,
} from '@/schemas/inventory'

type PartnerKind = 'vendor' | 'customer'

interface Props {
  kind: PartnerKind
  editingId: string | null
  defaultValues?: PartnerFormValues
  onSubmit: (values: PartnerFormValues) => void | Promise<void>
  onCancel: () => void
}

function fieldErr(msg?: string) {
  return msg ? (
    <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }} data-testid="partner-field-error">
      {msg}
    </p>
  ) : null
}

const LABELS: Record<PartnerKind, { edit: string; create: string; submitEdit: string; submitCreate: string }> = {
  vendor: {
    edit: 'Edit mitra pemasok',
    create: 'Tambah mitra pemasok',
    submitEdit: 'Simpan perubahan',
    submitCreate: 'Simpan mitra pemasok',
  },
  customer: {
    edit: 'Edit customer',
    create: 'Tambah customer',
    submitEdit: 'Simpan perubahan',
    submitCreate: 'Simpan customer',
  },
}

export default function PartnerFormCard({
  kind,
  editingId,
  defaultValues,
  onSubmit,
  onCancel,
}: Props) {
  const labels = LABELS[kind]
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: defaultValues ?? emptyPartnerFormValues(),
  })

  useEffect(() => {
    reset(defaultValues ?? emptyPartnerFormValues())
  }, [defaultValues, editingId, reset])

  return (
    <Card className="fade-in" data-testid={`partner-form-${kind}`}>
      <CardContent className="pt-6">
        <p className="label mb-3">{editingId ? labels.edit : labels.create}</p>
        <form
          onSubmit={(e) => void handleSubmit((v) => onSubmit(v))(e)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          noValidate
        >
          <div>
            <label className="label" htmlFor={`partner-${kind}-name`}>
              Nama
            </label>
            <Input
              id={`partner-${kind}-name`}
              data-testid={`partner-${kind}-name`}
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
            {fieldErr(errors.name?.message)}
          </div>
          <div>
            <label className="label" htmlFor={`partner-${kind}-contact`}>
              Kontak
            </label>
            <Input
              id={`partner-${kind}-contact`}
              data-testid={`partner-${kind}-contact`}
              aria-invalid={Boolean(errors.contact)}
              {...register('contact')}
            />
            {fieldErr(errors.contact?.message)}
          </div>
          <div>
            <label className="label" htmlFor={`partner-${kind}-address`}>
              Alamat
            </label>
            <Input
              id={`partner-${kind}-address`}
              data-testid={`partner-${kind}-address`}
              aria-invalid={Boolean(errors.address)}
              {...register('address')}
            />
            {fieldErr(errors.address?.message)}
          </div>
          <div className="flex justify-end gap-2 sm:col-span-3">
            {editingId && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Batal
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting} data-testid={`partner-${kind}-submit`}>
              {editingId ? labels.submitEdit : labels.submitCreate}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
