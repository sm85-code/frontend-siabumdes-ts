import { z } from 'zod'

export const accountFormSchema = z.object({
  code: z.string().trim().min(1, 'Kode akun wajib diisi'),
  name: z.string().trim().min(1, 'Nama akun wajib diisi'),
  category: z.string().trim().min(1, 'Kategori wajib diisi'),
  subcategory: z.string().trim().min(1, 'Sub-kategori wajib diisi'),
  normal_balance: z.enum(['debit', 'kredit'], {
    message: 'Saldo normal wajib dipilih',
  }),
})

export type AccountFormValues = z.infer<typeof accountFormSchema>
