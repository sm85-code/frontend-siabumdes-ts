/** Pure offset/limit pagination math used by Transactions (and reusable elsewhere). */

export interface PageWindow {
  /** 1-based page index */
  page: number
  pageCount: number
  /** Inclusive 1-based display start (0 when total is 0) */
  from: number
  /** Inclusive 1-based display end */
  to: number
  prevOffset: number
  nextOffset: number
  canPrev: boolean
  canNext: boolean
}

export function pageWindow(total: number, limit: number, offset: number): PageWindow {
  const safeLimit = Math.max(1, limit || 1)
  const safeOffset = Math.max(0, offset)
  const safeTotal = Math.max(0, total)
  const page = Math.floor(safeOffset / safeLimit) + 1
  const pageCount = Math.max(1, Math.ceil(safeTotal / safeLimit) || 1)
  const from = safeTotal === 0 ? 0 : safeOffset + 1
  const to = Math.min(safeOffset + safeLimit, safeTotal)
  const prevOffset = Math.max(0, safeOffset - safeLimit)
  const nextOffset = safeOffset + safeLimit
  return {
    page,
    pageCount,
    from,
    to,
    prevOffset,
    nextOffset,
    canPrev: safeOffset > 0,
    canNext: nextOffset < safeTotal,
  }
}

export function rangeLabel(total: number, limit: number, offset: number): string {
  const { from, to } = pageWindow(total, limit, offset)
  if (total === 0) return '0 dari 0'
  return `${from}–${to} dari ${total}`
}
