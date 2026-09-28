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
    report: (key: string, params: Record<string, unknown>) =>
      ['reports', key, params] as const,
    ledger: (params: Record<string, unknown>) => ['reports', 'ledger', params] as const,
    closedPeriods: ['reports', 'closed-periods'] as const,
  },
  transactions: {
    list: (params: Record<string, unknown>) => ['transactions', 'list', params] as const,
    types: ['transactions', 'types'] as const,
  },
  accounts: {
    all: ['accounts'] as const,
  },
  users: {
    all: ['users'] as const,
  },
  audit: {
    list: (limit: number) => ['audit', { limit }] as const,
  },
  orgProfile: ['org-profile'] as const,
}
