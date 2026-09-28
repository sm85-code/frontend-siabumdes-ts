/** Central TanStack Query key factory. */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  units: {
    all: (includeInactive = false) => ['units', { includeInactive }] as const,
  },
  reports: {
    dashboard: (params: {
      startDate: string
      endDate: string
      granularity: string
    }) => ['reports', 'dashboard', params] as const,
  },
  transactions: {
    list: (params: Record<string, unknown>) => ['transactions', 'list', params] as const,
  },
}
