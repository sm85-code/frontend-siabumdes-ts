import api, { API } from '@/api/client'
import type { Account, ImportResult, TransactionType } from '@/types'

export async function fetchAccounts(): Promise<Account[]> {
  const r = await api.get<Account[]>('/accounts')
  return r.data ?? []
}

export async function createAccount(body: Partial<Account>) {
  const r = await api.post<Account>('/accounts', body)
  return r.data
}

export async function updateAccount(id: string, body: Partial<Account>) {
  const r = await api.put<Account>(`/accounts/${id}`, body)
  return r.data
}

export async function deleteAccount(id: string) {
  await api.delete(`/accounts/${id}`)
}

export async function resetAccounts() {
  await api.delete('/accounts')
}

export async function importAccounts(file: File): Promise<ImportResult> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API}/accounts/import`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Gagal impor akun')
  return data as ImportResult
}

export async function downloadAccountsTemplate() {
  const res = await fetch(`${API}/accounts/template`, { credentials: 'include' })
  if (!res.ok) throw new Error('Gagal download template')
  return res.blob()
}

export async function fetchTransactionTypes(): Promise<TransactionType[]> {
  const r = await api.get<TransactionType[]>('/transaction-types')
  return r.data ?? []
}

export async function createTransactionType(body: Partial<TransactionType>) {
  const r = await api.post<TransactionType>('/transaction-types', body)
  return r.data
}

export async function updateTransactionType(id: string, body: Partial<TransactionType>) {
  const r = await api.put<TransactionType>(`/transaction-types/${id}`, body)
  return r.data
}

export async function deleteTransactionType(id: string) {
  await api.delete(`/transaction-types/${id}`)
}

export async function importTransactionTypes(file: File): Promise<ImportResult> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API}/transaction-types/import`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Gagal impor jenis transaksi')
  return data as ImportResult
}
