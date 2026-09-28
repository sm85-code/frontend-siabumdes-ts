import api from '@/api/client'
import type { UnitGroupTab, UnitUsaha } from '@/types'

export async function fetchUnits(includeInactive = false): Promise<UnitUsaha[]> {
  const r = await api.get<UnitUsaha[]>('/unit-usaha', {
    params: includeInactive ? { include_inactive: true } : undefined,
  })
  return r.data ?? []
}

/**
 * Build BUMDES + dynamic unit tabs from `/unit-usaha`.
 * Replaces the live FE hardcoded ["UU01"…"UU06"] group-tab pattern.
 */
export function buildUnitGroupTabs(units: UnitUsaha[]): UnitGroupTab[] {
  const sorted = [...units].sort((a, b) => (a.code || '').localeCompare(b.code || ''))
  return [
    { key: 'BUMDES', label: 'BUMDES', unitId: null },
    ...sorted.map((u) => ({
      key: u.code,
      label: u.code,
      unitId: u.id,
    })),
  ]
}

export function inventoryEligibleUnitIds(units: UnitUsaha[]): string[] {
  return units
    .filter((u) => ['perdagangan', 'manufaktur'].includes(u.business_type ?? ''))
    .map((u) => u.id)
}
