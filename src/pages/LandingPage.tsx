import { Link } from 'react-router-dom'
import AppearancePopover from '@/components/AppearancePopover'
import WallpaperLayer from '@/components/WallpaperLayer'
import { Button } from '@/components/ui/button'

/** Minimal landing shell — full marketing page ports in a later slice. */
export default function LandingPage() {
  return (
    <div className="auth-bg relative flex min-h-screen flex-col items-center justify-center p-6">
      <WallpaperLayer />
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <AppearancePopover align="end" />
      </div>
      <div className="fade-in max-w-lg text-center">
        <img
          src="/logo-transparent.png"
          alt="Logo BUMDES"
          className="mx-auto mb-4 h-24 w-24 object-contain"
        />
        <h1 className="font-heading text-3xl font-semibold">BUMDes Karya Raharja</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Sistem Informasi Akuntansi — TypeScript port (scaffold F0)
        </p>
        <Button asChild className="mt-8">
          <Link to="/login" data-testid="landing-login">
            Masuk
          </Link>
        </Button>
      </div>
    </div>
  )
}
