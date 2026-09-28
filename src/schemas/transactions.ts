import { z } from 'zod'

/** Create / edit transaction form. Amount stays a string in the form; submit still sends number via parseFloat. */
export const transactionFormSchema = z.object({
  date: z.string().trim().min(1, 'Tanggal wajib diisi'),
  /** Empty string = BUMDES pusat (null on API). Optional for non-pengelola. */
  unit_usaha_id: z.string(),
  transaction_type: z.string().trim().min(1, 'Jenis transaksi wajib dipilih'),
  description: z.string().trim().min(1, 'Keterangan wajib diisi'),
  amount: z
    .string()
    .trim()
    .min(1, 'Nominal wajib diisi')
    .refine((v) => {
      const n = Number(v)
      return Number.isFinite(n) && n >= 0
    }, { message: 'Nominal harus angka ≥ 0' }),
  debit_account_code: z.string().trim().min(1, 'Akun debit wajib dipilih'),
  credit_account_code: z.string().trim().min(1, 'Akun kredit wajib dipilih'),
  reference: z.string(),
})

export type TransactionFormValues = z.infer<typeof transactionFormSchema>

export const emptyTransactionForm = (): TransactionFormValues => ({
  date: new Date().toISOString().slice(0, 10),
  unit_usaha_id: '',
  transaction_type: '',
  description: '',
  amount: '',
  debit_account_code: '',
  credit_account_code: '',
  reference: '',
})
