import { ArrowLeft, Eye, EyeOff, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppearancePopover from '@/components/AppearancePopover'
import Spinner from '@/components/Spinner'
import WallpaperLayer from '@/components/WallpaperLayer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'

const COPYRIGHT_YEAR = new Date().getFullYear()

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      nav('/dashboard')
    } catch (er: unknown) {
      const detail = (er as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErr(detail || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg relative flex min-h-screen items-center justify-center p-4">
      <WallpaperLayer />
      <Button
        asChild
        variant="outline"
        className="absolute top-4 left-4 text-xs sm:top-6 sm:left-6 sm:text-sm"
      >
        <Link to="/" data-testid="login-back">
          <ArrowLeft className="size-3.5" /> Kembali
        </Link>
      </Button>
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <AppearancePopover triggerClassName="gap-2 text-xs sm:text-sm" align="end" />
      </div>
      <div className="fade-in w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src="/logo-transparent.png"
            alt="Logo BUMDES Karya Raharja"
            data-testid="bumdes-logo"
            className="mx-auto mb-3 h-28 w-28 object-contain"
          />
          <h1 className="font-heading mt-1 text-2xl sm:text-3xl">BUMDes Karya Raharja</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Sistem Informasi Akuntansi
          </p>
        </div>
        <Card>
          <CardContent className="pt-2">
            <h2 className="font-heading mb-1 text-xl">Masuk ke Akun</h2>
            <p className="mb-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Silakan gunakan username & password Anda.
            </p>
            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <div>
                <label className="label" htmlFor="login-username">
                  Username / Email
                </label>
                <Input
                  id="login-username"
                  data-testid="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mis. admin"
                  autoFocus
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="label" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    data-testid="login-password"
                    className="pr-10"
                    type={showPw ? 'text' : 'password'}
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    data-testid="toggle-password"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute top-1/2 right-3 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {showPw ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                  </button>
                </div>
              </div>
              {err && (
                <div
                  data-testid="login-error"
                  className="rounded-xl p-3 text-sm"
                  style={{
                    color: 'var(--status-error)',
                    background: 'var(--status-error-bg)',
                    border: '1px solid var(--status-error-border)',
                  }}
                >
                  {err}
                </div>
              )}
              <Button data-testid="login-submit" disabled={loading} className="w-full">
                {loading ? (
                  <Spinner size={18} label="Memproses..." />
                ) : (
                  <>
                    <LogIn className="size-4.5" />
                    Masuk
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
          Aplikasi SIA BUMDes ini dikembangkan dengan berpedoman pada Kepmendesa PDTT No. 136 Tahun
          2022.
        </p>
        <p className="mt-3 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          © {COPYRIGHT_YEAR} BUMDes Karya Raharja Wonoharjo. All Rights Reserved.
        </p>
      </div>
    </div>
  )
}
