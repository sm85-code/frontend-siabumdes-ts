import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username / email wajib diisi'),
  password: z
    .string()
    .min(1, 'Password wajib diisi')
    .max(72, 'Password maksimal 72 karakter'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Password sementara wajib diisi')
      .max(72, 'Password maksimal 72 karakter'),
    newPassword: z
      .string()
      .min(8, 'Password baru minimal 8 karakter.')
      .max(72, 'Password maksimal 72 karakter'),
    confirmation: z
      .string()
      .min(8, 'Konfirmasi password minimal 8 karakter.')
      .max(72, 'Password maksimal 72 karakter'),
  })
  .refine((data) => data.newPassword === data.confirmation, {
    message: 'Konfirmasi password tidak cocok.',
    path: ['confirmation'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Password baru harus berbeda dari password sementara.',
    path: ['newPassword'],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
