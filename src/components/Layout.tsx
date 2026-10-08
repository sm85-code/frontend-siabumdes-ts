import { LogOut } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import AppearancePopover from '@/components/AppearancePopover'
import BottomNav from '@/components/BottomNav'
import WallpaperLayer from '@/components/WallpaperLayer'
import { Button } from '@/components/ui/button'
import { NAV, BOTTOM_NAV_PATHS, filterNavForUser } from '@/config/nav'
import { ROLE_LABELS } from '@/config/roles'
import { useInventoryUnitIds } from '@/hooks/useUnits'
import { useAuth } from '@/lib/auth'

function isNavActive(pathname: string, to: string, allPaths: string[]) {
  const matches = allPaths.filter((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (matches.length === 0) return false
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b))
  return best === to
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const { inventoryUnitIds, data: units } = useInventoryUnitIds()

  const visible = useMemo(
    () => filterNavForUser(user, inventoryUnitIds, NAV, units?.find(u => u.code === 'UU04')?.id),
    [user, inventoryUnitIds, units],
  )

  const allPaths = useMemo(() => visible.map((n) => n.to), [visible])

  const bottomItems = useMemo(() => {
    const byPath = new Map(visible.map((n) => [n.to, n]))
    return BOTTOM_NAV_PATHS.map((p) => byPath.get(p)).filter(Boolean) as typeof visible
  }, [visible])

  const moreActive = useMemo(() => {
    if (!visible.length) return false
    const onPrimary = BOTTOM_NAV_PATHS.some((p) =>
      isNavActive(location.pathname, p, [...BOTTOM_NAV_PATHS]),
    )
    if (onPrimary) return false
    return visible.some(
      (n) =>
        !(BOTTOM_NAV_PATHS as readonly string[]).includes(n.to) &&
        isNavActive(location.pathname, n.to, allPaths),
    )
  }, [visible, location.pathname, allPaths])

  if (!user) return null

  return (
    <div className="app-shell flex min-h-screen">
      <WallpaperLayer />
      <div
        className="fixed inset-x-3 top-3 z-40 flex h-14 items-center rounded-2xl px-4 lg:hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--legacy-border)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <img
            src="/logo-bumdes.webp"
            alt="Logo"
            className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
          />
          <span className="font-heading truncate text-sm font-semibold">BUMDES Karya Raharja</span>
        </div>
      </div>

      <aside
        data-testid="sidebar"
        className={`fixed top-0 left-0 z-50 flex h-[100dvh] w-72 flex-col overflow-hidden transition-transform lg:sticky lg:transform-none ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div
          className="m-0 flex h-full flex-col overflow-hidden rounded-none lg:m-4 lg:h-[calc(100dvh-2rem)] lg:rounded-2xl"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--legacy-border)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <div className="flex items-center gap-3 p-6">
            <img
              src="/logo-bumdes.webp"
              alt="Logo BUMDES"
              data-testid="sidebar-logo"
              className="h-11 w-11 rounded-full object-cover"
            />
            <div>
              <div className="font-heading text-base leading-tight font-semibold">BUMDES</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Karya Raharja
              </div>
            </div>
          </div>
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
            {visible.map((n) => {
              const Icon = n.icon
              const active = isNavActive(location.pathname, n.to, allPaths)
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  data-testid={`nav-${n.to.replace(/\//g, '-')}`}
                  onClick={() => setOpen(false)}
                  className={`side-link ${active ? 'active' : ''}`}
                >
                  <span className="nav-ico">
                    <Icon className="size-4.5" strokeWidth={active ? 2.5 : 2} />
                  </span>
                  <span>{n.label}</span>
                </NavLink>
              )
            })}
          </nav>
          <div className="shrink-0 p-4">
            <AppearancePopover triggerClassName="mb-3 w-full justify-start gap-2" align="start" />
            <div className="mb-3 flex items-center gap-3">
              {user.photo_url ? (
                <img
                  src={user.photo_url}
                  alt={user.name}
                  className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-heading text-sm font-semibold text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  {user.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{user.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {ROLE_LABELS[user.role]}
                </div>
              </div>
            </div>
            <Button data-testid="logout-btn" onClick={() => void logout()} variant="outline" size="sm" className="w-full">
              <LogOut className="size-4" /> Keluar
            </Button>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setOpen(false)} />
      )}
      <main className="min-w-0 flex-1 pt-20 pb-24 lg:pt-0 lg:pb-0">
        <div className="fade-in mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      <BottomNav items={bottomItems} onOpenMore={() => setOpen(true)} moreActive={moreActive} />
    </div>
  )
}
