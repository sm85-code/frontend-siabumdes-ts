/** Money field from API: number today; string after BE Decimal→str JSON. */
export type MoneyAmount = number | string

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
  pendapatan: MoneyAmount
  beban: MoneyAmount
}

export interface UnitSummary {
  id: string
  code: string
  name: string
  pendapatan: MoneyAmount
  beban: MoneyAmount
  laba: MoneyAmount
}

export interface DashboardData {
  total_pendapatan: MoneyAmount
  total_beban: MoneyAmount
  laba_bersih: MoneyAmount
  total_transactions: number
  monthly: DashboardMonthlyPoint[]
  unit_summaries: UnitSummary[]
  total_aset: MoneyAmount
  total_kewajiban: MoneyAmount
  total_ekuitas: MoneyAmount
  kas_bank: MoneyAmount
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
  amount: MoneyAmount
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
  type?: string
  category?: string | null
  subcategory?: string | null
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
  unit_codes?: string[]
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
  org_name?: string
  org_legal_name?: string
  name?: string
  address?: string | null
  village?: string | null
  district?: string | null
  regency?: string | null
  province?: string | null
  phone?: string | null
  email?: string | null
  npwp?: string | null
  tagline?: string | null
  logo_url?: string | null
  primary_color?: string | null
  signatory_left_title?: string | null
  signatory_left_name?: string | null
  signatory_mid_title?: string | null
  signatory_mid_name?: string | null
  signatory_right_title?: string | null
  signatory_right_name?: string | null
  share_pengurus?: number | string
  share_penasihat?: number | string
  share_pengawas?: number | string
  share_dana_sosial?: number | string
  share_pades?: number | string
  share_modal_bumdes?: number | string
  share_unit_pengelola?: number | string
  share_unit_bumdes?: number | string
  updated_at?: string | null
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
  debit: MoneyAmount
  credit: MoneyAmount
  balance: MoneyAmount
  other_account_code?: string
  other_account_name?: string
}

export interface LedgerData {
  account: { code: string; name: string; category?: string; normal_balance?: string }
  saldo_awal: MoneyAmount
  saldo_akhir: MoneyAmount
  total_debit?: MoneyAmount
  total_credit?: MoneyAmount
  entries: LedgerEntry[]
}

/** UU05 inventory domain (Incremental typing for Inventory pages). */
export interface InventoryMeta {
  unit_usaha_id?: string | null
  unit_code?: string | null
  unit_name?: string | null
  [key: string]: unknown
}

export interface InventoryCategory {
  id: string
  name: string
}

export interface InventoryProduct {
  id: string
  sku: string
  name: string
  category_id?: string | null
  category_name?: string | null
  unit_of_measure?: string | null
  cost_price?: number | string | null
  sell_price?: number | string | null
  qty_on_hand?: number | string | null
  stock_value?: number | string | null
  is_active?: boolean
  [key: string]: unknown
}

export interface InventoryMovement {
  id: string
  product_id?: string | null
  sku?: string | null
  product_name?: string | null
  direction?: string | null
  quantity?: number | string | null
  total_value?: number | string | null
  movement_date?: string | null
  finance_status?: string | null
  [key: string]: unknown
}

export interface InventoryAdjustment {
  id: string
  product_id?: string | null
  sku?: string | null
  product_name?: string | null
  quantity_delta?: number | string | null
  reason?: string | null
  notes?: string | null
  adjustment_date?: string | null
  [key: string]: unknown
}

export interface InventoryPartner {
  id: string
  name: string
  contact?: string | null
  address?: string | null
  [key: string]: unknown
}

export interface InventoryPurchase {
  id: string
  [key: string]: unknown
}

export interface InventorySale {
  id: string
  [key: string]: unknown
}

export interface InventoryValuation {
  summary?: {
    sku_count?: number
    total_qty?: number
    total_value?: number
  }
  by_category?: {
    category?: string
    value?: number
    qty?: number
    sku_count?: number
  }[]
  [key: string]: unknown
}

export interface InventoryMovementReport {
  stock_in?: { qty?: number; value?: number; count?: number }
  stock_out?: { qty?: number; value?: number; count?: number }
  [key: string]: unknown
}

