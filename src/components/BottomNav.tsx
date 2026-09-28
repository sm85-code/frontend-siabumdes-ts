import { Menu } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { NavItem } from '@/config/nav'
import { cn } from '@/lib/utils'

function isPrimaryActive(pathname: string, to: string, primaryPaths: string[]) {
  const matches = primaryPaths.filter((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (matches.length === 0) return false
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b))
  return best === to
}

/** Mobile bottom tab bar: fixed slots + Lainnya. */
export default function BottomNav({
  items,
  onOpenMore,
  moreActive = false,
}: {
  items: NavItem[]
  onOpenMore: () => void
  moreActive?: boolean
}) {
  const location = useLocation()
  const primaryPaths = items.map((i) => i.to)

  return (
    <nav
      data-testid="bottom-nav"
      className="bottom-nav-shell fixed inset-x-0 bottom-0 z-30 flex items-stretch lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigasi utama"
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = isPrimaryActive(location.pathname, item.to, primaryPaths)
        return (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={`bottom-nav-${item.to.replace(/\//g, '-') || 'root'}`}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
            )}
            style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
          >
            <span
              className="flex size-8 items-center justify-center rounded-xl"
              style={{
                background: 'var(--surface-alt)',
                border: active ? '1px solid color-mix(in oklch, var(--primary) 35%, transparent)' : '1px solid transparent',
              }}
            >
              <Icon className="size-4.5" strokeWidth={active ? 2.5 : 2} />
            </span>
            <span className="truncate px-1">{item.shortLabel ?? item.label}</span>
          </NavLink>
        )
      })}
      <button
        type="button"
        data-testid="bottom-nav-lainnya"
        onClick={onOpenMore}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium"
        style={{ color: moreActive ? 'var(--primary)' : 'var(--text-muted)' }}
        aria-label="Buka menu lainnya"
      >
        <span
          className="flex size-8 items-center justify-center rounded-xl"
          style={{
            background: 'var(--surface-alt)',
            border: moreActive
              ? '1px solid color-mix(in oklch, var(--primary) 35%, transparent)'
              : '1px solid transparent',
          }}
        >
          <Menu className="size-4.5" strokeWidth={moreActive ? 2.5 : 2} />
        </span>
        <span>Lainnya</span>
      </button>
    </nav>
  )
}
