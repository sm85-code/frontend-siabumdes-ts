import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'
import { getApiError } from '@/api/client'
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/schemas/auth'

export default function ChangePasswordPage() {
  const { changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmation: '',
    },
  })

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setError('')
    try {
      await changePassword(values.currentPassword, values.newPassword)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(getApiError(err, 'Gagal mengganti password.'))
    }
  }

  const fieldError =
    errors.currentPassword?.message ||
    errors.newPassword?.message ||
    errors.confirmation?.message ||
    error

  return (
    <div className="auth-bg flex items-center justify-center p-4">
      <Card className="fade-in w-full max-w-md">
        <CardContent className="pt-6">
          <p className="label mb-1">Keamanan Akun</p>
          <h1 className="font-heading text-2xl font-bold">Ganti Password</h1>
          <p className="mt-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Password sementara harus diganti sebelum Anda dapat melanjutkan.
          </p>
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <div>
              <label className="label" htmlFor="current-password">
                Password sementara
              </label>
              <Input
                id="current-password"
                type="password"
                maxLength={72}
                aria-invalid={Boolean(errors.currentPassword)}
                {...register('currentPassword')}
              />
            </div>
            <div>
              <label className="label" htmlFor="new-password">
                Password baru
              </label>
              <Input
                id="new-password"
                type="password"
                maxLength={72}
                aria-invalid={Boolean(errors.newPassword)}
                {...register('newPassword')}
              />
            </div>
            <div>
              <label className="label" htmlFor="confirm-password">
                Konfirmasi password baru
              </label>
              <Input
                id="confirm-password"
                type="password"
                maxLength={72}
                aria-invalid={Boolean(errors.confirmation)}
                {...register('confirmation')}
              />
            </div>
            {fieldError && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{ background: 'var(--status-error-bg)', color: 'var(--status-error)' }}
              >
                {fieldError}
              </div>
            )}
            <Button className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Password Baru'}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => void logout()}>
              Keluar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
