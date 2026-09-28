import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Adapted from Magic UI Ripple — pure CSS keyframes (see index.css). */
export function Ripple({
  mainCircleSize = 220,
  mainCircleOpacity = 0.3,
  numCircles = 7,
  className,
  ...props
}: {
  mainCircleSize?: number
  mainCircleOpacity?: number
  numCircles?: number
  className?: string
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('absolute inset-0', className)} {...props}>
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 80
        const opacity = mainCircleOpacity - i * 0.03
        return (
          <div
            key={i}
            className="wallpaper-ripple-circle"
            style={
              {
                width: `${size}px`,
                height: `${size}px`,
                animationDelay: `${i * 0.3}s`,
                '--ripple-opacity': opacity,
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
