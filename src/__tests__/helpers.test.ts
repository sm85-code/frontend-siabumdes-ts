import { describe, expect, it } from 'vitest'
import { fmtRp } from '@/api/client'
import { buildUnitGroupTabs } from '@/api/units'
import { pageWindow, rangeLabel } from '@/lib/pagination'
import type { UnitUsaha } from '@/types'

describe('fmtRp', () => {
  it('formats rupiah with id-ID grouping', () => {
    expect(fmtRp(1_500_000)).toMatch(/^Rp /)
    expect(fmtRp(1_500_000)).toContain('1')
    expect(fmtRp(1_500_000)).toContain('500')
  })

  it('treats null/undefined/NaN as Rp 0', () => {
    expect(fmtRp(null)).toBe('Rp 0')
    expect(fmtRp(undefined)).toBe('Rp 0')
    expect(fmtRp(Number.NaN)).toBe('Rp 0')
  })

  it('rounds fractional amounts', () => {
    expect(fmtRp(10.6)).toBe(fmtRp(11))
  })
})

describe('buildUnitGroupTabs', () => {
  const units: UnitUsaha[] = [
    { id: '2', code: 'UU02', name: 'Toko' },
    { id: '1', code: 'UU01', name: 'Simpan Pinjam' },
  ]

  it('prefixes BUMDES and sorts by code (no hardcoded UU01–UU06)', () => {
    const tabs = buildUnitGroupTabs(units)
    expect(tabs[0]).toEqual({ key: 'BUMDES', label: 'BUMDES', unitId: null })
    expect(tabs.map((t) => t.key)).toEqual(['BUMDES', 'UU01', 'UU02'])
    expect(tabs[1].unitId).toBe('1')
  })

  it('works with empty unit list', () => {
    expect(buildUnitGroupTabs([])).toEqual([{ key: 'BUMDES', label: 'BUMDES', unitId: null }])
  })
})

describe('pageWindow / rangeLabel', () => {
  it('computes 1-based page and display range', () => {
    const w = pageWindow(120, 50, 50)
    expect(w.page).toBe(2)
    expect(w.pageCount).toBe(3)
    expect(w.from).toBe(51)
    expect(w.to).toBe(100)
    expect(w.canPrev).toBe(true)
    expect(w.canNext).toBe(true)
    expect(w.prevOffset).toBe(0)
    expect(w.nextOffset).toBe(100)
  })

  it('handles empty total and last partial page', () => {
    expect(pageWindow(0, 50, 0)).toMatchObject({ from: 0, to: 0, page: 1, canPrev: false, canNext: false })
    const last = pageWindow(120, 50, 100)
    expect(last.to).toBe(120)
    expect(last.canNext).toBe(false)
    expect(rangeLabel(120, 50, 100)).toBe('101–120 dari 120')
  })
})
