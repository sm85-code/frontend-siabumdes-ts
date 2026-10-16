import type { ReactNode } from 'react'

/** Standar judul seksi di dalam halaman. */
export default function SectionTitle({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return <h2 id={id} className={`section-title ${className}`.trim()}>{children}</h2>
}
