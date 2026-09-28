import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/keys'
import { listTransactionsPage, type ListTransactionsParams } from '@/api/transactions'
import { fetchAccounts, fetchTransactionTypes } from '@/api/accounts'

const PAGE_SIZE = 50

export function useTransactionsPage(
  params: Omit<ListTransactionsParams, 'meta' | 'limit'> & { limit?: number; enabled?: boolean },
) {
  const { enabled = true, limit = PAGE_SIZE, ...rest } = params
  return useQuery({
    queryKey: queryKeys.transactions.list({ ...rest, limit }),
    queryFn: () => listTransactionsPage({ ...rest, limit }),
    enabled,
    placeholderData: (prev) => prev,
  })
}

export function useTransactionTypesQuery() {
  return useQuery({
    queryKey: queryKeys.transactions.types,
    queryFn: fetchTransactionTypes,
    staleTime: 60_000,
  })
}

export function useAccountsQuery() {
  return useQuery({
    queryKey: queryKeys.accounts.all,
    queryFn: fetchAccounts,
    staleTime: 60_000,
  })
}

export function useInvalidateTransactions() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['transactions'] })
}

export { PAGE_SIZE }
