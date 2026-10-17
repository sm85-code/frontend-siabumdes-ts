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
  Store,
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
  ROLES_TOKO,
  ROLES_UNIT_USAHA,
  ROLES_USERS,
  can,
} from '@/config/roles'
import type { Role } from '@/types'

export type NavGroup = 'beranda' | 'unit' | 'keuangan' | 'profil' | 'admin' | 'akun'

/** Grup sidebar (urutan tampil). 'akun' (Profil Saya) tampil di area akun bawah sidebar. */
export const NAV_GROUPS: { id: Exclude<NavGroup, 'akun'>; label: string }[] = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'unit', label: 'Unit Usaha' },
  { id: 'keuangan', label: 'Keuangan & Akuntansi' },
  { id: 'profil', label: 'Profil' },
  { id: 'admin', label: 'Administrasi' },
]

export interface NavItem {
  group: NavGroup
  to: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  roles: Role[]
  /** Hide Inventory for pengelola unless their unit is perdagangan/manufaktur. */
  inventoryUnitOnly?: boolean
  yieldUnitOnly?: boolean
  /** Pengelola hanya boleh melihat jika unitnya UU05 (unit 5 / toko). */
  tokoUnitOnly?: boolean
}

/** Fixed mobile bottom-nav slot order (left→right). Lainnya is appended in BottomNav. */
export const BOTTOM_NAV_PATHS = ['/dashboard', '/ledger', '/reports', '/transactions'] as const

export const NAV: NavItem[] = [
  { group: 'beranda', to: '/dashboard', label: 'Dashboard', icon: Home, roles: READ_MOST },
  { group: 'unit', to: '/imbal-hasil', label: 'Manajemen Setoran', icon: Receipt, roles: ROLES_INVENTORY, yieldUnitOnly: true },
  { group: 'unit', to: '/manajemen-toko', label: 'Manajemen Toko', shortLabel: 'Toko', icon: Store, roles: ROLES_TOKO, tokoUnitOnly: true },
  { group: 'unit', to: '/inventory', label: 'Manajemen Gudang', icon: Package, roles: ROLES_INVENTORY, inventoryUnitOnly: true },
  { group: 'keuangan', to: '/transactions', label: 'Transaksi', icon: Receipt, roles: READ_MOST },
  { group: 'keuangan', to: '/ledger', label: 'Buku Besar', icon: BookOpenText, roles: READ_MOST },
  { group: 'keuangan', to: '/reports', label: 'Laporan Keuangan', shortLabel: 'Laporan', icon: ChartLine, roles: ROLES_REPORTS },
  { group: 'keuangan', to: '/accounts', label: 'Kode Akun (COA)', icon: Library, roles: ROLES_COA },
  { group: 'profil', to: '/profil-bumdes', label: 'Profil BUMDes', icon: Building2, roles: ROLES_ORG_PROFILE },
  { group: 'profil', to: '/unit-usaha', label: 'Profil Unit Usaha', icon: Building2, roles: ROLES_UNIT_USAHA },
  { group: 'admin', to: '/users', label: 'Kelola Pengguna', icon: Users, roles: ROLES_USERS },
  { group: 'admin', to: '/riska-permissions', label: 'Izin Riska', icon: Users, roles: ['admin'] },
  { group: 'admin', to: '/audit-log', label: 'Audit Log', icon: ClipboardList, roles: ROLES_AUDIT_LOG },
  { group: 'akun', to: '/profile', label: 'Profil Saya', icon: UserCircle, roles: READ_MOST },
]

/** Pure filter: which nav items a user may see (role + inventory unit gate). */
export function filterNavForUser(
  user: { role: Role; unit_usaha_id?: string | null } | null | undefined,
  inventoryUnitIds: string[] | null | undefined,
  items: NavItem[] = NAV,
  yieldUnitId?: string,
  tokoUnitId?: string,
): NavItem[] {
  if (!user) return []
  return items.filter((n) => {
    if (!can(user, ...n.roles)) return false
    if (n.yieldUnitOnly && user.role === 'pengelola') return !!yieldUnitId && user.unit_usaha_id === yieldUnitId
    if (n.tokoUnitOnly && user.role === 'pengelola') return !!tokoUnitId && user.unit_usaha_id === tokoUnitId
    if (n.inventoryUnitOnly && user.role === 'pengelola') {
      return Boolean(inventoryUnitIds?.includes(user.unit_usaha_id ?? ''))
    }
    return true
  })
}
