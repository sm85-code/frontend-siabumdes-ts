import type { ReactNode } from 'react'
import { TableCell, TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

/** Kolom "Unit Usaha" standar: lebar tetap, maks 2 baris + elipsis, menempel di kiri. */
export function UnitHead({ children = 'Unit Usaha' }: { children?: ReactNode }) {
  return <TableHead className="col-unit">{children}</TableHead>
}

export function UnitCell({ name, bold, className }: { name: string; bold?: boolean; className?: string }) {
  return (
    <TableCell className={cn('col-unit', bold ? 'font-bold' : 'font-medium', className)} title={name}>
      <span className="col-unit-text">{name}</span>
    </TableCell>
  )
}
