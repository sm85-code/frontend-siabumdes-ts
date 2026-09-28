import { z } from 'zod'

const roleEnum = z.enum([
  'admin',
  'direktur',
  'bendahara',
  'pengelola',
  'pengawas',
  'penasihat',
])

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama lengkap wajib diisi'),
    username: z.string().trim().min(1, 'Username wajib diisi'),
    email: z
      .string()
      .trim()
      .min(1, 'Email wajib diisi')
      .email('Format email tidak valid'),
    password: z.string().min(6, 'Password minimal 6 karakter'),
    role: roleEnum,
    unit_usaha_id: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'pengelola' && !data.unit_usaha_id?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['unit_usaha_id'],
        message: 'Unit usaha wajib dipilih untuk role pengelola',
      })
    }
  })

export type CreateUserFormValues = z.infer<typeof createUserSchema>
