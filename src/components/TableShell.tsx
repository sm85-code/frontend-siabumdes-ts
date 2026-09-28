import type { ReactNode } from 'react'

/** Horizontal scroll wrapper for wide tables (matches live FE). */
export default function TableShell({
  children,
  minWidth = 560,
}: {
  children: ReactNode
  minWidth?: number
}) {
  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth }}>{children}</div>
    </div>
  )
}
