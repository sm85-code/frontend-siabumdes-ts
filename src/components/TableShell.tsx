import type { ReactNode } from 'react'

/** Keep wide data tables scrollable without widening the page. */
export default function TableShell({
  children,
  minWidth = 560,
  label = 'Tabel data',
}: {
  children: ReactNode
  minWidth?: number
  label?: string
}) {
  return (
    <div className="table-shell w-full min-w-0 overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline-2 focus-visible:outline-ring" role="region" aria-label={label} tabIndex={0}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  )
}
