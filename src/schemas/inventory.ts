import { z } from 'zod'
import {
  BEBAN_PENJUALAN_BARANG_ACCOUNT_CODE,
  HPP_ACCOUNT_CODE,
  KAS_ACCOUNT_CODE,
  PENDAPATAN_ACCOUNT_CODE,
  PERSEDIAAN_ACCOUNT_CODE,
} from '@/lib/uu05InventoryCoa'

const today = () => new Date().toISOString().slice(0, 10)

/** Non-negative money/qty kept as string in the form; submit still sends number via Number(). */
const nonNegNumberString = (requiredMsg: string, invalidMsg: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMsg)
    .refine((v) => {
      const n = Number(v)
      return Number.isFinite(n) && n >= 0
    }, { message: invalidMsg })

const positiveIntString = (requiredMsg: string, invalidMsg: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMsg)
    .refine((v) => {
      const n = Number(v)
      return Number.isFinite(n) && Number.isInteger(n) && n >= 1
    }, { message: invalidMsg })

const nonzeroIntString = (requiredMsg: string, invalidMsg: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMsg)
    .refine((v) => {
      const n = Number(v)
      return Number.isFinite(n) && Number.isInteger(n) && n !== 0
    }, { message: invalidMsg })

export const productFormSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'SKU wajib diisi')
    .max(64, 'SKU maksimal 64 karakter'),
  name: z
    .string()
    .trim()
    .min(1, 'Nama produk wajib diisi')
    .max(200, 'Nama produk maksimal 200 karakter'),
  category_id: z.string().trim().min(1, 'Kategori wajib dipilih'),
  unit_of_measure: z
    .string()
    .trim()
    .min(1, 'Satuan wajib diisi')
    .max(32, 'Satuan maksimal 32 karakter'),
  cost_price: nonNegNumberString('Harga pokok wajib diisi', 'Harga pokok harus angka ≥ 0'),
  sell_price: nonNegNumberString('Harga jual wajib diisi', 'Harga jual harus angka ≥ 0'),
  opening_qty: nonNegNumberString('Qty awal wajib diisi', 'Qty awal harus angka ≥ 0'),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

export const emptyProductForm = (): ProductFormValues => ({
  sku: '',
  name: '',
  category_id: '',
  unit_of_measure: 'pcs',
  cost_price: '0',
  sell_price: '0',
  opening_qty: '0',
})

export const stockInFormSchema = z
  .object({
    product_id: z.string().trim().min(1, 'Produk wajib dipilih'),
    vendor_id: z.string().trim().min(1, 'Mitra pemasok wajib dipilih'),
    movement_date: z.string().trim().min(1, 'Tanggal wajib diisi'),
    invoice_number: z.string(),
    quantity: positiveIntString('Qty masuk wajib diisi', 'Qty masuk harus bilangan bulat ≥ 1'),
    unit_cost: nonNegNumberString('HPP/unit wajib diisi', 'HPP/unit harus angka ≥ 0'),
    payment_method: z.enum(['cash', 'credit'], { message: 'Metode bayar wajib dipilih' }),
    due_date: z.string(),
    debit_account_code: z.string().trim().min(1, 'Akun debit wajib dipilih'),
    credit_account_code: z.string().trim().min(1, 'Akun kredit wajib dipilih'),
  })
  .superRefine((data, ctx) => {
    if (data.payment_method === 'credit' && !data.due_date.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Jatuh tempo wajib diisi untuk kredit',
        path: ['due_date'],
      })
    }
  })

export type StockInFormValues = z.infer<typeof stockInFormSchema>

export const emptyStockInForm = (): StockInFormValues => ({
  product_id: '',
  vendor_id: '',
  movement_date: today(),
  invoice_number: '',
  quantity: '1',
  unit_cost: '0',
  payment_method: 'cash',
  due_date: '',
  debit_account_code: PERSEDIAAN_ACCOUNT_CODE,
  credit_account_code: KAS_ACCOUNT_CODE,
})

export const stockOutFormSchema = z
  .object({
    isInternal: z.boolean(),
    product_id: z.string().trim().min(1, 'Produk wajib dipilih'),
    customer_id: z.string(),
    movement_date: z.string().trim().min(1, 'Tanggal wajib diisi'),
    quantity: positiveIntString('Qty keluar wajib diisi', 'Qty keluar harus bilangan bulat ≥ 1'),
    note: z.string(),
    invoice_number: z.string(),
    sell_price: nonNegNumberString('Harga jual wajib diisi', 'Harga jual harus angka ≥ 0'),
    payment_method: z.enum(['cash', 'piutang'], { message: 'Metode bayar wajib dipilih' }),
    due_date: z.string(),
    debit_account_code: z.string().trim().min(1, 'Akun debit wajib dipilih'),
    credit_account_code: z.string().trim().min(1, 'Akun kredit wajib dipilih'),
    revenue_debit_account_code: z.string(),
    revenue_credit_account_code: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.isInternal) {
      if (!data.customer_id.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Customer wajib dipilih',
          path: ['customer_id'],
        })
      }
      if (!data.revenue_debit_account_code.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Akun debit penjualan wajib dipilih',
          path: ['revenue_debit_account_code'],
        })
      }
      if (!data.revenue_credit_account_code.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Akun kredit pendapatan wajib dipilih',
          path: ['revenue_credit_account_code'],
        })
      }
      if (data.payment_method === 'piutang' && !data.due_date.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Jatuh tempo wajib diisi untuk piutang',
          path: ['due_date'],
        })
      }
    }
  })

export type StockOutFormValues = z.infer<typeof stockOutFormSchema>

export const emptyStockOutForm = (): StockOutFormValues => ({
  isInternal: false,
  product_id: '',
  customer_id: '',
  movement_date: today(),
  quantity: '1',
  note: '',
  invoice_number: '',
  sell_price: '0',
  payment_method: 'cash',
  due_date: '',
  debit_account_code: HPP_ACCOUNT_CODE,
  credit_account_code: PERSEDIAAN_ACCOUNT_CODE,
  revenue_debit_account_code: KAS_ACCOUNT_CODE,
  revenue_credit_account_code: PENDAPATAN_ACCOUNT_CODE,
})

/** Debit COA when toggling internal stock-out (same business defaults as before). */
export const stockOutInternalDebit = BEBAN_PENJUALAN_BARANG_ACCOUNT_CODE
export const stockOutSaleDebit = HPP_ACCOUNT_CODE

export const adjustFormSchema = z.object({
  product_id: z.string().trim().min(1, 'Produk wajib dipilih'),
  adjustment_date: z.string().trim().min(1, 'Tanggal wajib diisi'),
  quantity_delta: nonzeroIntString(
    'Delta qty wajib diisi',
    'Delta qty harus bilangan bulat bukan nol',
  ),
  reason: z.enum(['rusak', 'kadaluarsa', 'koreksi'], { message: 'Alasan wajib dipilih' }),
  notes: z.string(),
  debit_account_code: z.string().trim().min(1, 'Akun debit wajib dipilih'),
  credit_account_code: z.string().trim().min(1, 'Akun kredit wajib dipilih'),
})

export type AdjustFormValues = z.infer<typeof adjustFormSchema>

export const emptyAdjustForm = (): AdjustFormValues => ({
  product_id: '',
  adjustment_date: today(),
  quantity_delta: '-1',
  reason: 'rusak',
  notes: '',
  debit_account_code: PERSEDIAAN_ACCOUNT_CODE,
  credit_account_code: PENDAPATAN_ACCOUNT_CODE,
})

/** Mitra pemasok / customer — same shape; name required, contact/address optional. */
export const partnerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama wajib diisi')
    .max(200, 'Nama maksimal 200 karakter'),
  contact: z.string().max(120, 'Kontak maksimal 120 karakter'),
  address: z.string().max(500, 'Alamat maksimal 500 karakter'),
})

export type PartnerFormValues = z.infer<typeof partnerFormSchema>

export const emptyPartnerFormValues = (): PartnerFormValues => ({
  name: '',
  contact: '',
  address: '',
})
