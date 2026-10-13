import type { Role } from '@/types'

/** Role lists extracted from live App.jsx + Layout.jsx (centralized for F0+). */

export const ALL_ROLES: Role[] = [
  'admin',
  'direktur',
  'bendahara',
  'pengelola',
  'pengawas',
  'penasihat',
]

/** Most authenticated users (sidebar visibility). */
export const READ_MOST: Role[] = [
  'admin',
  'direktur',
  'bendahara',
  'pengelola',
  'pengawas',
  'penasihat',
]

export const ROLES_REPORTS: Role[] = READ_MOST
export const ROLES_LEDGER: Role[] = READ_MOST
export const ROLES_COA: Role[] = ['admin']
export const ROLES_USERS: Role[] = ['admin']
export const ROLES_AUDIT_LOG: Role[] = ['admin']
export const ROLES_ORG_PROFILE: Role[] = ['admin', 'direktur', 'pengawas', 'penasihat']
export const ROLES_UNIT_USAHA: Role[] = ['admin', 'direktur', 'pengawas', 'penasihat']
export const ROLES_INVENTORY: Role[] = ['admin', 'direktur', 'bendahara', 'pengelola']
/** Manajemen Toko: pengelola hanya jika terikat unit 5 (UU05), dicek di filterNavForUser/halaman. */
export const ROLES_TOKO: Role[] = ['admin', 'direktur', 'bendahara', 'pengelola']
/** Kode unit usaha toko (unit 5). */
export const TOKO_UNIT_CODE = 'UU05'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin Utama',
  direktur: 'Direktur',
  bendahara: 'Bendahara',
  pengelola: 'Pengelola Unit',
  pengawas: 'Pengawas',
  penasihat: 'Penasihat',
}

export function hasRole(user: { role: Role } | null | undefined, roles: Role[]): boolean {
  return !!user && roles.includes(user.role)
}

export function can(user: { role: Role } | null | undefined, ...roles: Role[]): boolean {
  return hasRole(user, roles)
}
