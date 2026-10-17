/** Helper murni untuk daftar Stock In/Out/Penyesuaian (filter bulan, cari, total). */
export interface StockRow extends Record<string, unknown> {
  id: string
  date: string
  sku: string
  product: string
  qty: number
  value: number | null
}

export function monthRange(month: string): { date_from: string; date_to: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { date_from: `${month}-01`, date_to: `${month}-${String(last).padStart(2, '0')}` }
}

export function currentMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function searchRows<T extends StockRow>(rows: T[], q: string): T[] {
  const t = q.trim().toLowerCase()
  if (!t) return rows
  return rows.filter((r) => r.sku.toLowerCase().includes(t) || r.product.toLowerCase().includes(t)
    || String(r.docNumber ?? '').toLowerCase().includes(t) || String(r.invoice ?? '').toLowerCase().includes(t))
}

export function totals(rows: StockRow[]): { qty: number; value: number } {
  return rows.reduce((a, r) => ({ qty: a.qty + r.qty, value: a.value + (r.value ?? 0) }), { qty: 0, value: 0 })
}
