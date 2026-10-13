import { describe, expect, it } from 'vitest'
import { buildSku, shouldAppendRow, type CatalogRow } from './catalog'

const row = (filled: boolean): CatalogRow => ({ key: Math.random().toString(), category_id: filled ? 'c' : '', sku: filled ? 'KRS.PRT-1' : '', name: filled ? 'A' : '', unit_of_measure: 'pcs', cost_price: '0', sell_price: '0' })

describe('catalog', () => {
  it('builds SKU from category code', () => expect(buildSku('prt', ' 001 ')).toBe('KRS.PRT-001'))
  it('appends only from last row when previous rows complete', () => {
    const rows = [row(true), row(true), row(true), row(true), row(false)]
    expect(shouldAppendRow(rows, 4)).toBe(true)
    expect(shouldAppendRow(rows, 3)).toBe(false)
    expect(shouldAppendRow([row(true), row(false), row(false)], 2)).toBe(false)
  })
})
