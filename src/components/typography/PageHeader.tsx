import type { ReactNode } from 'react'
import HelpHint from '@/components/HelpHint'

/** Standar judul halaman: h1 + bantuan opsional, subjudul (.page-sub), dan aksi di kanan. */
export default function PageHeader({
  title,
  icon,
  hint,
  hintLabel,
  subtitle,
  actions,
}: {
  title: ReactNode
  icon?: ReactNode
  hint?: ReactNode
  hintLabel?: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  const heading = (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <h1 className="font-heading page-h1 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          {icon}
          {title}
        </h1>
        {hint && <HelpHint label={hintLabel}>{hint}</HelpHint>}
      </div>
      {subtitle && <p className="page-sub mt-1">{subtitle}</p>}
    </div>
  )
  if (!actions) return heading
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {heading}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}
