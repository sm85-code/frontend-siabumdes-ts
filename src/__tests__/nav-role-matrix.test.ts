import { describe, expect, it } from 'vitest'
import { NAV, filterNavForUser } from '@/config/nav'
import { ALL_ROLES, ROLE_LABELS } from '@/config/roles'
import type { Role } from '@/types'

function pathsFor(
  role: Role,
  unitId: string | null = null,
  inventoryUnitIds: string[] | null = null,
) {
  return filterNavForUser({ role, unit_usaha_id: unitId }, inventoryUnitIds).map((n) => n.to)
}

describe('nav role matrix (from config)', () => {
  it('exposes labels for every role', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy()
    }
  })

  it('admin sees COA, users, audit, inventory, unit usaha, org profile', () => {
    const paths = pathsFor('admin')
    expect(paths).toEqual(
      expect.arrayContaining([
        '/dashboard',
        '/accounts',
        '/transactions',
        '/reports',
        '/ledger',
        '/inventory',
        '/unit-usaha',
        '/profil-bumdes',
        '/audit-log',
        '/users',
        '/profile',
      ]),
    )
    expect(paths).toHaveLength(NAV.length)
  })

  it('bendahara sees inventory but not COA/users/audit/unit/org', () => {
    const paths = pathsFor('bendahara')
    expect(paths).toContain('/inventory')
    expect(paths).toContain('/transactions')
    expect(paths).not.toContain('/accounts')
    expect(paths).not.toContain('/users')
    expect(paths).not.toContain('/audit-log')
    expect(paths).not.toContain('/unit-usaha')
    expect(paths).not.toContain('/profil-bumdes')
  })

  it('pengawas sees reports/unit/org but not inventory/COA/users', () => {
    const paths = pathsFor('pengawas')
    expect(paths).toContain('/reports')
    expect(paths).toContain('/unit-usaha')
    expect(paths).toContain('/profil-bumdes')
    expect(paths).not.toContain('/inventory')
    expect(paths).not.toContain('/accounts')
    expect(paths).not.toContain('/users')
  })

  it('pengelola without inventory-eligible unit hides Inventory', () => {
    const paths = pathsFor('pengelola', 'unit-jasa', ['unit-dagang'])
    expect(paths).not.toContain('/inventory')
    expect(paths).toContain('/dashboard')
    expect(paths).toContain('/transactions')
  })

  it('pengelola with perdagangan/manufaktur unit sees Inventory', () => {
    const paths = pathsFor('pengelola', 'unit-dagang', ['unit-dagang'])
    expect(paths).toContain('/inventory')
  })

  it('returns empty when user is missing', () => {
    expect(filterNavForUser(null, [])).toEqual([])
  })
})

it('Imbal Hasil allows HQ roles and only the UU04 manager', () => {
  for (const role of ['admin', 'direktur', 'bendahara'] as Role[]) {
    expect(pathsFor(role)).toContain('/imbal-hasil')
  }
  for (const role of ['pengawas', 'penasihat'] as Role[]) expect(pathsFor(role)).not.toContain('/imbal-hasil')
  expect(filterNavForUser({ role: 'pengelola', unit_usaha_id: 'u4' }, [], NAV, 'u4').map(n => n.to)).toContain('/imbal-hasil')
  expect(filterNavForUser({ role: 'pengelola', unit_usaha_id: 'u3' }, [], NAV, 'u4').map(n => n.to)).not.toContain('/imbal-hasil')
  expect(pathsFor('pengelola', 'u4')).not.toContain('/imbal-hasil')
})
