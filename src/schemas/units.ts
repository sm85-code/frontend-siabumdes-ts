import { z } from 'zod'

export const businessTypeEnum = z.enum(['jasa', 'perdagangan', 'manufaktur'], {
  message: 'Jenis usaha wajib dipilih',
})

export const createUnitSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Kode unit wajib diisi')
    .max(32, 'Kode unit maksimal 32 karakter')
    .regex(/^[A-Za-z0-9_-]+$/, 'Kode unit hanya huruf, angka, _ atau -'),
  name: z.string().trim().min(1, 'Nama unit wajib diisi').max(120, 'Nama unit maksimal 120 karakter'),
  business_type: businessTypeEnum,
})

export type CreateUnitFormValues = z.infer<typeof createUnitSchema>

export const editUnitSchema = z.object({
  name: z.string().trim().min(1, 'Nama unit wajib diisi').max(120, 'Nama unit maksimal 120 karakter'),
  business_type: businessTypeEnum,
  active: z.boolean(),
})

export type EditUnitFormValues = z.infer<typeof editUnitSchema>
