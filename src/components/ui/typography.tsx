import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * shadcn-style typography helpers for narrative content (landing, CaLK, policy notes).
 * Size/weight/tracking only — colors follow global h1–h4 / CSS variables.
 */

export function TypographyH2({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0',
        className,
      )}
      {...props}
    />
  )
}

export function TypographyH3({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('scroll-m-20 text-xl font-semibold tracking-tight', className)} {...props} />
  )
}

export function TypographyH4({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4 className={cn('scroll-m-20 text-lg font-semibold tracking-tight', className)} {...props} />
  )
}

export function TypographyP({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('leading-7 [&:not(:first-child)]:mt-4', className)} {...props} />
}

export function TypographyLead({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-lg text-muted-foreground', className)} {...props} />
}

export function TypographyLarge({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-lg font-semibold', className)} {...props} />
}

export function TypographySmall({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <small className={cn('text-sm font-medium leading-none', className)} {...props} />
}

export function TypographyMuted({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function TypographyBlockquote({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) {
  return <blockquote className={cn('mt-4 border-l-2 pl-6 italic', className)} {...props} />
}

export function TypographyList({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('my-4 ml-6 list-disc [&>li]:mt-2', className)} {...props} />
}
