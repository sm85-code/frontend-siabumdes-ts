import api, { API } from '@/api/client'
import type { ImportResult, PaginatedTransactions, Transaction } from '@/types'

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
    limit = 50,
    offset = 0,
    meta = false,
  } = params

  const r = await api.get<Transaction[] | PaginatedTransactions>('/transactions', {
    params: {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      // Empty string = BUMDES pusat (null unit); omit = all units
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
    return {
      items: data,
      total: data.length,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      has_more: false,
    }
  }
  return data
}

export type TransactionInput = {
  date: string
  unit_usaha_id: string | null
  transaction_type: string
  description: string
  amount: number
  debit_account_code: string
  credit_account_code: string
  reference: string
}

export async function createTransaction(body: TransactionInput) {
  const r = await api.post<Transaction>('/transactions', body)
  return r.data
}

export async function updateTransaction(id: string, body: TransactionInput) {
  const r = await api.put<Transaction>(`/transactions/${id}`, body)
  return r.data
}

export async function deleteTransaction(id: string) {
  await api.delete(`/transactions/${id}`)
}

export async function verifyProofs() {
  const r = await api.post<{ removed: number }>('/transactions/verify-proofs')
  return r.data
}

export async function uploadProof(txId: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API}/transactions/${txId}/proof`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Gagal upload bukti')
  return data as { proofs: Transaction['proofs'] }
}

export async function deleteProof(txId: string, fileId: string) {
  const res = await fetch(`${API}/transactions/${txId}/proofs/${fileId}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { detail?: string }).detail || 'Gagal hapus bukti')
  return data
}

export async function downloadTxTemplate() {
  const res = await fetch(`${API}/transactions/template`, { credentials: 'include' })
  if (!res.ok) throw new Error('Gagal download template')
  return res.blob()
}

export async function importTransactions(file: File): Promise<ImportResult> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API}/transactions/import`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Gagal impor')
  return data as ImportResult
}

export async function exportTransactions(params: {
  startDate?: string
  endDate?: string
  unitUsahaId?: string | null
  allData?: boolean
}) {
  const qs = new URLSearchParams()
  if (params.allData) {
    qs.set('all_data', 'true')
  } else {
    if (params.startDate) qs.set('start_date', params.startDate)
    if (params.endDate) qs.set('end_date', params.endDate)
    if (params.unitUsahaId === null) qs.set('unit_usaha_id', '')
    else if (params.unitUsahaId) qs.set('unit_usaha_id', params.unitUsahaId)
  }
  const res = await fetch(`${API}/transactions/export?${qs}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Gagal export Excel')
  return res.blob()
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
