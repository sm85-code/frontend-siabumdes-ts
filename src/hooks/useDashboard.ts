import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/keys'
import { fetchDashboard } from '@/api/reports'

export function useDashboardQuery(params: {
  startDate: string
  endDate: string
  granularity: string
  enabled?: boolean
}) {
  const { enabled = true, ...rest } = params
  return useQuery({
    queryKey: queryKeys.reports.dashboard(rest),
    queryFn: () => fetchDashboard(rest),
    enabled,
    staleTime: 30_000,
  })
}
