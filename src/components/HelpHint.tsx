import type { ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Ikon (?) kecil berisi penjelasan panjang; dibuka dengan klik/tap (berfungsi di mobile). */
export default function HelpHint({ children, label = 'Bantuan' }: { children: ReactNode; label?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} title={label}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring align-middle">
          <HelpCircle className="size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] space-y-2 text-sm leading-relaxed">{children}</PopoverContent>
    </Popover>
  )
}
