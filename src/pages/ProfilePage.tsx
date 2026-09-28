import { useState, type FormEvent } from 'react'
import { getApiError } from '@/api/client'
import { updateProfile, uploadProfilePhoto } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'

export default function ProfilePage() {
  const { user, changePassword, refreshUser } = useAuth()
  const [profile, setProfile] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
  })
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const uploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran foto maksimal 2 MB')
      return
    }
    setUploading(true)
    setMessage('')
    setError('')
    uploadProfilePhoto(file)
      .then(() => {
        void refreshUser()
        setMessage('Foto profil berhasil diupload')
      })
      .catch((er) => setError(getApiError(er, 'Gagal upload foto')))
      .finally(() => setUploading(false))
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await updateProfile(profile)
      await refreshUser()
      setMessage('Profil berhasil diperbarui')
    } catch (err) {
      setError(getApiError(err, 'Profil gagal diperbarui'))
    }
  }

  const savePassword = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setError('')
    if (passwords.next !== passwords.confirm) {
      setError('Konfirmasi password tidak sama')
      return
    }
    try {
      await changePassword(passwords.current, passwords.next)
      setPasswords({ current: '', next: '', confirm: '' })
      setMessage('Password berhasil diperbarui')
    } catch (err) {
      setError(getApiError(err, 'Password gagal diperbarui'))
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Profil Saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola identitas akun dan password Anda sendiri.
        </p>
      </div>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Foto Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
              {user?.photo_url ? (
                <img src={user.photo_url} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <span className="px-1 text-center text-xs text-muted-foreground">Belum ada foto</span>
              )}
            </div>
            <div>
              <Label className="inline-flex">
                <Button asChild variant="outline" size="sm" className="cursor-pointer">
                  <span>{uploading ? 'Mengupload...' : 'Upload Foto'}</span>
                </Button>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={uploadPhoto}
                  disabled={uploading}
                  data-testid="profile-photo-input"
                />
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">PNG/JPG/WebP, maksimal 2 MB.</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Informasi Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void saveProfile(e)} className="grid gap-4 sm:grid-cols-2">
            <Label className="label">
              Nama
              <Input
                className="mt-1"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
              />
            </Label>
            <Label className="label">
              Username
              <Input
                className="mt-1"
                value={profile.username}
                onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                required
                minLength={3}
              />
            </Label>
            <Label className="label sm:col-span-2">
              Email
              <Input
                className="mt-1"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                required
              />
            </Label>
            <div>
              <Button type="submit">Simpan Profil</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Ganti Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void savePassword(e)} className="grid gap-4">
            <Label className="label">
              Password Saat Ini
              <Input
                className="mt-1"
                type="password"
                maxLength={72}
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                required
              />
            </Label>
            <Label className="label">
              Password Baru
              <Input
                className="mt-1"
                type="password"
                minLength={8}
                maxLength={72}
                value={passwords.next}
                onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                required
              />
            </Label>
            <Label className="label">
              Konfirmasi Password Baru
              <Input
                className="mt-1"
                type="password"
                minLength={8}
                maxLength={72}
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                required
              />
            </Label>
            <div>
              <Button type="submit">Ganti Password</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
