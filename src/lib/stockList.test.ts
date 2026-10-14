import { describe, expect, it } from 'vitest'
import { monthRange, searchRows, totals } from './stockList'

const rows = [
  { id: '1', date: '2026-10-01', sku: 'KRS.MM-OYK', product: 'Oyek', qty: 10, value: 50000 },
  { id: '2', date: '2026-10-02', sku: 'KRS.MM-GLA', product: 'Gula', qty: 5, value: 20000 },
]

describe('stockList', () => {
  it('rentang bulan', () => {
    expect(monthRange('2026-02')).toEqual({ date_from: '2026-02-01', date_to: '2026-02-28' })
  })
  it('cari nama/SKU dan total', () => {
    expect(searchRows(rows, 'oyk').map((r) => r.id)).toEqual(['1'])
    expect(searchRows(rows, 'gula').map((r) => r.id)).toEqual(['2'])
    expect(totals(rows)).toEqual({ qty: 15, value: 70000 })
  })
})
