/** BUMDes roles from live frontend-siabumdes / sm85-arch. */
export type Role =
  | 'admin'
  | 'direktur'
  | 'bendahara'
  | 'pengelola'
  | 'pengawas'
  | 'penasihat'

export interface User {
  id: string
  username: string
  name: string
  role: Role
  email?: string | null
  photo_url?: string | null
  unit_usaha_id?: string | null
  must_change_password?: boolean
  active?: boolean
  blocked_periods?: string[]
  edits_locked?: boolean
}

export interface UnitUsaha {
  id: string
  code: string
  name: string
  business_type?: string
  description?: string | null
  revenue_scheme?: string | null
  active?: boolean
}

export interface DashboardMonthlyPoint {
  month: string
  pendapatan: number
  beban: number
}

export interface UnitSummary {
  id: string
  code: string
  name: string
  pendapatan: number
  beban: number
  laba: number
}

export interface DashboardData {
  total_pendapatan: number
  total_beban: number
  laba_bersih: number
  total_transactions: number
  monthly: DashboardMonthlyPoint[]
  unit_summaries: UnitSummary[]
  total_aset: number
  total_kewajiban: number
  total_ekuitas: number
  kas_bank: number
}

export interface TransactionProof {
  file_id: string
  file_name?: string
  url?: string | null
}

export interface Transaction {
  id: string
  date: string
  unit_usaha_id: string | null
  transaction_type: string
  description: string
  amount: number
  debit_account_code: string
  credit_account_code: string
  reference: string
  mitra_id?: string | null
  created_by?: string | null
  created_at?: string | null
  is_closing?: boolean
  proofs?: TransactionProof[]
}

/** B3 pagination envelope when GET /transactions?meta=true. */
export interface PaginatedMeta {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface PaginatedTransactions extends PaginatedMeta {
  items: Transaction[]
}

export type PeriodMode =
  | 'today'
  | 'week'
  | 'thisMonth'
  | 'monthly'
  | 'yearly'
  | 'custom'

export interface PeriodValue {
  mode: PeriodMode
  startDate: string
  endDate: string
  label: string
}

/** Dynamic group tab for Transactions/Ledger (replaces hardcoded UU01–UU06). */
export interface UnitGroupTab {
  key: string
  label: string
  unitId: string | null
}
