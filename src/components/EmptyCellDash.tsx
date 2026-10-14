import { cn } from '@/lib/utils'

/** En dash penanda sel kosong — ukuran sedang, warna samar. */
export const EMPTY_CELL_DASH = '–'

export const emptyCellDashClassName = 'text-muted-foreground/60 text-sm'

/** Tampilkan en dash samar di sel kosong. Aria-label tetap di induk (tombol/sel). */
export default function EmptyCellDash({ className }: { className?: string }) {
  return (
    <span className={cn(emptyCellDashClassName, className)} aria-hidden="true">
      {EMPTY_CELL_DASH}
    </span>
  )
}
