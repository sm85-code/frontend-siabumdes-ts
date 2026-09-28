import { useMemo, useState } from 'react'

export function compareValues(av: unknown, bv: unknown): number {
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), 'id', { numeric: true })
}

export function useSort<T extends Record<string, unknown>>(
  rows: T[],
  defaultKey: string | null = null,
  defaultDir: 'asc' | 'desc' = 'asc',
) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir)

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const copy = [...rows]
    copy.sort((a, b) => compareValues(a[sortKey], b[sortKey]))
    return sortDir === 'desc' ? copy.reverse() : copy
  }, [rows, sortKey, sortDir])

  const headerProps = (key: string) => ({
    onClick: () => toggleSort(key),
    className: 'cursor-pointer select-none',
    'data-testid': `sort-${key}`,
    title: 'Klik untuk mengurutkan',
  })

  const sortIndicator = (key: string) => {
    if (sortKey !== key) return ' ⇅'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return { sorted, sortKey, sortDir, toggleSort, headerProps, sortIndicator }
}
