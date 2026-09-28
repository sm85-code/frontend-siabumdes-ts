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

export interface Account {
  id: string
  code: string
  name: string
  type: string
  category?: string | null
  normal_balance?: string | null
  group?: string | null
  parent_code?: string | null
  is_header?: boolean
  active?: boolean
}

export interface TransactionType {
  id?: string
  code: string
  name: string
  group?: string | null
  debit?: string | null
  credit?: string | null
  description?: string | null
}

export interface AuditLogRow {
  id: string
  created_at: string
  actor_name: string
  actor_role: string
  action: string
  detail?: string | null
  ip?: string | null
}

export interface OrgProfile {
  name?: string
  address?: string | null
  village?: string | null
  district?: string | null
  regency?: string | null
  province?: string | null
  phone?: string | null
  email?: string | null
  npwp?: string | null
  share_pengurus?: number
  share_penasihat?: number
  share_pengawas?: number
  share_dana_sosial?: number
  share_pades?: number
  share_modal_bumdes?: number
  share_unit_pengelola?: number
  share_unit_bumdes?: number
  [key: string]: unknown
}

export interface ImportResult {
  inserted: number
  total_rows: number
  errors?: { row: number; error: string }[]
}

export interface DriveStatus {
  connected: boolean
  email?: string | null
}

export interface LedgerEntry {
  id?: string
  date: string
  description?: string
  reference?: string
  debit: number
  credit: number
  balance: number
  other_account_code?: string
  other_account_name?: string
}

export interface LedgerData {
  account: { code: string; name: string; category?: string; normal_balance?: string }
  saldo_awal: number
  saldo_akhir: number
  total_debit?: number
  total_credit?: number
  entries: LedgerEntry[]
}
