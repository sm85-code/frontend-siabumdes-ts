import { useId, type SVGProps } from 'react'
import { cn } from '@/lib/utils'

/** Adapted from Magic UI DotPattern (static SVG, no framer-motion). */
export function DotPattern({
  width = 18,
  height = 18,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  ...props
}: {
  width?: number
  height?: number
  cx?: number
  cy?: number
  cr?: number
  className?: string
} & SVGProps<SVGSVGElement>) {
  const id = useId()
  return (
    <svg aria-hidden="true" className={cn('wallpaper-dots-svg h-full w-full', className)} {...props}>
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse">
          <circle cx={cx} cy={cy} r={cr} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
