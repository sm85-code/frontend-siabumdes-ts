import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/keys'
import { fetchUnits, inventoryEligibleUnitIds } from '@/api/units'

export function useUnitsQuery(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.units.all(includeInactive),
    queryFn: () => fetchUnits(includeInactive),
    staleTime: 60_000,
  })
}

export function useInventoryUnitIds() {
  const q = useUnitsQuery(false)
  return {
    ...q,
    inventoryUnitIds: q.data ? inventoryEligibleUnitIds(q.data) : null,
  }
}
