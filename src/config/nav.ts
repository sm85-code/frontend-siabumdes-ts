import type { LucideIcon } from 'lucide-react'
import {
  BookOpenText,
  Library,
  Building2,
  ChartLine,
  ClipboardList,
  Home,
  Package,
  Receipt,
  UserCircle,
  Users,
} from 'lucide-react'
import {
  READ_MOST,
  ROLES_AUDIT_LOG,
  ROLES_COA,
  ROLES_INVENTORY,
  ROLES_ORG_PROFILE,
  ROLES_REPORTS,
  ROLES_UNIT_USAHA,
  ROLES_USERS,
  can,
} from '@/config/roles'
import type { Role } from '@/types'

export interface NavItem {
  to: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  roles: Role[]
  /** Hide Inventory for pengelola unless their unit is perdagangan/manufaktur. */
  inventoryUnitOnly?: boolean
  yieldUnitOnly?: boolean
}

/** Fixed mobile bottom-nav slot order (left→right). Lainnya is appended in BottomNav. */
export const BOTTOM_NAV_PATHS = ['/dashboard', '/ledger', '/reports', '/transactions'] as const

export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: Home, roles: READ_MOST },
  { to: '/accounts', label: 'Kode Akun (COA)', icon: Library, roles: ROLES_COA },
  { to: '/transactions', label: 'Transaksi', icon: Receipt, roles: READ_MOST },
  {
    to: '/reports',
    label: 'Laporan Keuangan',
    shortLabel: 'Laporan',
    icon: ChartLine,
    roles: ROLES_REPORTS,
  },
  { to: '/ledger', label: 'Buku Besar', icon: BookOpenText, roles: READ_MOST },
  {
    to: '/inventory',
    label: 'Manajemen Stok',
    icon: Package,
    roles: ROLES_INVENTORY,
    inventoryUnitOnly: true,
  },
  { to: '/imbal-hasil', label: 'Imbal Hasil', icon: Receipt, roles: ROLES_INVENTORY, yieldUnitOnly: true },
  { to: '/unit-usaha', label: 'Profil Unit Usaha', icon: Building2, roles: ROLES_UNIT_USAHA },
  { to: '/profil-bumdes', label: 'Profil BUMDES', icon: Building2, roles: ROLES_ORG_PROFILE },
  { to: '/audit-log', label: 'Audit Log', icon: ClipboardList, roles: ROLES_AUDIT_LOG },
  { to: '/users', label: 'Kelola Pengguna', icon: Users, roles: ROLES_USERS },
  { to: '/profile', label: 'Profil Saya', icon: UserCircle, roles: READ_MOST },
]

/** Pure filter: which nav items a user may see (role + inventory unit gate). */
export function filterNavForUser(
  user: { role: Role; unit_usaha_id?: string | null } | null | undefined,
  inventoryUnitIds: string[] | null | undefined,
  items: NavItem[] = NAV,
  yieldUnitId?: string,
): NavItem[] {
  if (!user) return []
  return items.filter((n) => {
    if (!can(user, ...n.roles)) return false
    if (n.yieldUnitOnly && user.role === 'pengelola') return !!yieldUnitId && user.unit_usaha_id === yieldUnitId
    if (n.inventoryUnitOnly && user.role === 'pengelola') {
      return Boolean(inventoryUnitIds?.includes(user.unit_usaha_id ?? ''))
    }
    return true
  })
}
