import api from '@/api/client'
import type { PaginatedTransactions, Transaction } from '@/types'

export interface ListTransactionsParams {
  startDate?: string
  endDate?: string
  unitUsahaId?: string | null
  reference?: string
  limit?: number
  offset?: number
  /** B3: when true, returns {items, total, limit, offset, has_more}. */
  meta?: boolean
}

/**
 * List transactions. Prefer meta=true + offset/limit for new UI (F2).
 * Default meta=false keeps a bare array (live FE compatibility).
 */
export async function listTransactions(
  params: ListTransactionsParams = {},
): Promise<Transaction[] | PaginatedTransactions> {
  const {
    startDate,
    endDate,
    unitUsahaId,
    reference,
    limit = 500,
    offset = 0,
    meta = false,
  } = params

  const r = await api.get<Transaction[] | PaginatedTransactions>('/transactions', {
    params: {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      unit_usaha_id: unitUsahaId === undefined ? undefined : unitUsahaId,
      reference: reference || undefined,
      limit,
      offset,
      meta: meta || undefined,
    },
  })
  return r.data
}

/** Convenience wrapper always requesting the B3 pagination envelope. */
export async function listTransactionsPage(
  params: Omit<ListTransactionsParams, 'meta'> = {},
): Promise<PaginatedTransactions> {
  const data = await listTransactions({ ...params, meta: true })
  if (Array.isArray(data)) {
    // Defensive: backend should always envelope when meta=true.
    return {
      items: data,
      total: data.length,
      limit: params.limit ?? 500,
      offset: params.offset ?? 0,
      has_more: false,
    }
  }
  return data
}
