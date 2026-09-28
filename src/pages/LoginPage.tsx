import { ArrowLeft, Eye, EyeOff, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import AppearancePopover from '@/components/AppearancePopover'
import Spinner from '@/components/Spinner'
import WallpaperLayer from '@/components/WallpaperLayer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'
import { loginSchema, type LoginFormValues } from '@/schemas/auth'

const COPYRIGHT_YEAR = new Date().getFullYear()

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setErr('')
    try {
      await login(values.username.trim(), values.password)
      nav('/dashboard')
    } catch (er: unknown) {
      const detail = (er as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErr(detail || 'Login gagal')
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
            <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
              <div>
                <label className="label" htmlFor="login-username">
                  Username / Email
                </label>
                <Input
                  id="login-username"
                  data-testid="login-username"
                  placeholder="mis. admin"
                  autoFocus
                  autoComplete="username"
                  aria-invalid={Boolean(errors.username)}
                  {...register('username')}
                />
                {errors.username && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
                    {errors.username.message}
                  </p>
                )}
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
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    {...register('password')}
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
                {errors.password && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
                    {errors.password.message}
                  </p>
                )}
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
              <Button data-testid="login-submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
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
