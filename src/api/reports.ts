import api from '@/api/client'
import type { DashboardData } from '@/types'

export interface DashboardParams {
  startDate: string
  endDate: string
  granularity: string
}

export async function fetchDashboard(params: DashboardParams): Promise<DashboardData> {
  const r = await api.get<DashboardData>('/reports/dashboard', {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      granularity: params.granularity,
    },
  })
  return r.data
}
