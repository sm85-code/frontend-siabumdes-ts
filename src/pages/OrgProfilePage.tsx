import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import api, { getApiError } from '@/api/client'
import { useAuth, can } from '@/lib/auth'
import { notify } from '@/lib/feedback'
import Spinner from '@/components/Spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { OrgProfile } from '@/types'

type OrgFormState = {
  org_name: string
  org_legal_name: string
  address: string
  village: string
  district: string
  regency: string
  province: string
  phone: string
  email: string
  tagline: string
  logo_url: string
  signatory_left_title: string
  signatory_left_name: string
  signatory_mid_title: string
  signatory_mid_name: string
  signatory_right_title: string
  signatory_right_name: string
  primary_color: string
  share_pengurus: number | string
  share_penasihat: number | string
  share_pengawas: number | string
  share_dana_sosial: number | string
  share_pades: number | string
  share_modal_bumdes: number | string
  share_unit_pengelola: number | string
  share_unit_bumdes: number | string
  updated_at?: string | null
}

const EMPTY: OrgFormState = {
  org_name: '',
  org_legal_name: '',
  address: '',
  village: '',
  district: '',
  regency: '',
  province: '',
  phone: '',
  email: '',
  tagline: '',
  logo_url: '',
  signatory_left_title: '',
  signatory_left_name: '',
  signatory_mid_title: '',
  signatory_mid_name: '',
  signatory_right_title: '',
  signatory_right_name: '',
  primary_color: '1F4E79',
  share_pengurus: 35,
  share_penasihat: 7,
  share_pengawas: 5,
  share_dana_sosial: 5,
  share_pades: 30,
  share_modal_bumdes: 18,
  share_unit_pengelola: 30,
  share_unit_bumdes: 70,
}

type ShareKey =
  | 'share_pengurus'
  | 'share_penasihat'
  | 'share_pengawas'
  | 'share_dana_sosial'
  | 'share_pades'
  | 'share_modal_bumdes'
  | 'share_unit_pengelola'
  | 'share_unit_bumdes'

const SHARE_FIELDS_BUMDES: [ShareKey, string][] = [
  ['share_pengurus', 'Pengurus'],
  ['share_penasihat', 'Penasihat'],
  ['share_pengawas', 'Pengawas'],
  ['share_dana_sosial', 'Dana Sosial'],
  ['share_pades', 'PADes (ke Desa)'],
  ['share_modal_bumdes', 'Penguatan Modal BUMDES'],
]
const SHARE_FIELDS_UNIT: [ShareKey, string][] = [
  ['share_unit_pengelola', 'Pengelola Unit'],
  ['share_unit_bumdes', 'BUMDES (Pusat)'],
]
const TOTAL_TOLERANCE = 0.01

function mergeOrg(data: OrgProfile | Partial<OrgFormState>): OrgFormState {
  return { ...EMPTY, ...(data as Partial<OrgFormState>) }
}

export default function OrgProfilePage() {
  const { user } = useAuth()
  const canWrite = can(user, 'admin', 'direktur')
  const [form, setForm] = useState<OrgFormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get<OrgProfile>('/org-profile')
      setForm(mergeOrg(r.data))
    } catch (er: unknown) {
      notify(getApiError(er, 'Gagal memuat profil BUMDES'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const set =
    (key: keyof OrgFormState) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const setNum =
    (key: ShareKey) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({
        ...f,
        [key]: e.target.value === '' ? '' : Number(e.target.value),
      }))

  const sumFields = (fields: [ShareKey, string][]) =>
    fields.reduce((acc, [key]) => acc + (Number(form[key]) || 0), 0)
  const bumdesTotal = sumFields(SHARE_FIELDS_BUMDES)
  const unitTotal = sumFields(SHARE_FIELDS_UNIT)
  const bumdesValid = Math.abs(bumdesTotal - 100) < TOTAL_TOLERANCE
  const unitValid = Math.abs(unitTotal - 100) < TOTAL_TOLERANCE

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    if (!bumdesValid || !unitValid) {
      notify('Total proporsi bagi hasil tiap grup harus tepat 100%')
      return
    }
    setSaving(true)
    try {
      const { logo_url: _logoUrl, updated_at: _updatedAt, ...payload } = form
      const r = await api.put<OrgProfile>('/org-profile', payload)
      setForm(mergeOrg(r.data))
      notify(
        'Profil BUMDES tersimpan. Kop surat export PDF/Excel/Word akan langsung memakai data ini.',
      )
    } catch (er: unknown) {
      notify(getApiError(er, 'Gagal menyimpan profil BUMDES'))
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!canWrite || !file) return
    if (file.size > 2 * 1024 * 1024) {
      notify('Ukuran logo maksimal 2 MB')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    api
      .post<OrgProfile>('/org-profile/logo', fd)
      .then((r) => {
        setForm(mergeOrg(r.data))
        notify('Logo BUMDES berhasil diupload')
      })
      .catch((er: unknown) => notify(getApiError(er, 'Gagal upload logo')))
      .finally(() => setUploading(false))
  }

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner column size={48} />
      </div>
    )

  return (
    <div className="max-w-3xl space-y-6" data-testid="org-profile-page">
      <div>
        <p className="label mb-1">PENGATURAN</p>
        <h1 className="font-heading page-h1 text-2xl font-bold">Profil BUMDES</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teks dan logo di sini dipakai sebagai kop surat pada semua export PDF, Excel, dan Word
          (Laporan Keuangan, Buku Besar). Perubahan langsung berlaku tanpa perlu deploy ulang.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo BUMDES" className="h-full w-full object-contain" />
              ) : (
                <span className="px-1 text-center text-xs text-muted-foreground">Belum ada logo</span>
              )}
            </div>
            <div>
              {canWrite ? (
                <>
                  <Label className="inline-flex">
                    <Button asChild variant="outline" size="sm" className="cursor-pointer">
                      <span>{uploading ? 'Mengupload...' : 'Upload Logo'}</span>
                    </Button>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      hidden
                      onChange={uploadLogo}
                      disabled={uploading}
                      data-testid="org-logo-input"
                    />
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG/JPG/WebP/SVG, maksimal 2 MB. Tampil di tengah kop surat.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Mode lihat saja — Anda tidak dapat mengubah logo.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={(e) => void save(e)} className="space-y-6">
        {!canWrite && (
          <p className="text-sm text-muted-foreground" data-testid="org-profile-readonly-banner">
            Mode lihat saja — role Anda tidak dapat mengubah Profil BUMDES.
          </p>
        )}
        <fieldset disabled={!canWrite} className="m-0 min-w-0 space-y-6 border-0 p-0">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Identitas Organisasi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Label className="label">
                  Nama BUMDES
                  <Input className="mt-1" value={form.org_name} onChange={set('org_name')} required />
                </Label>
                <Label className="label">
                  Nama Badan Hukum
                  <Input
                    className="mt-1"
                    value={form.org_legal_name}
                    onChange={set('org_legal_name')}
                  />
                </Label>
                <Label className="label sm:col-span-2">
                  Tagline (di bawah nama, opsional)
                  <Input className="mt-1" value={form.tagline} onChange={set('tagline')} />
                </Label>
                <Label className="label sm:col-span-2">
                  Alamat
                  <Input
                    className="mt-1"
                    value={form.address}
                    onChange={set('address')}
                    placeholder="Jl. Contoh No. 1"
                  />
                </Label>
                <Label className="label">
                  Desa/Kelurahan
                  <Input className="mt-1" value={form.village} onChange={set('village')} />
                </Label>
                <Label className="label">
                  Kecamatan
                  <Input className="mt-1" value={form.district} onChange={set('district')} />
                </Label>
                <Label className="label">
                  Kabupaten/Kota
                  <Input className="mt-1" value={form.regency} onChange={set('regency')} />
                </Label>
                <Label className="label">
                  Provinsi
                  <Input className="mt-1" value={form.province} onChange={set('province')} />
                </Label>
                <Label className="label">
                  Telepon
                  <Input className="mt-1" value={form.phone} onChange={set('phone')} />
                </Label>
                <Label className="label">
                  Email
                  <Input
                    className="mt-1"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                  />
                </Label>
                <Label className="label">
                  Warna Kop Surat
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-11 w-14 rounded-md border border-border"
                      value={`#${(form.primary_color || '1F4E79').replace('#', '')}`}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          primary_color: e.target.value.replace('#', ''),
                        }))
                      }
                    />
                    <span className="font-mono text-sm">
                      #{(form.primary_color || '1F4E79').replace('#', '').toUpperCase()}
                    </span>
                  </div>
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Bagi Hasil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-xs text-muted-foreground">
                Proporsi ini dipakai saat Tutup Buku bulanan (jurnal alokasi laba) dan di Laporan
                Perubahan Ekuitas / ringkasan per-unit. Ubah di sini berlaku untuk penutupan bulan
                berikutnya -- periode yang sudah ditutup tidak berubah.
              </p>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">BUMDES (Pusat)</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-xs ${bumdesValid ? '' : 'font-bold'}`}
                    style={{
                      background: bumdesValid ? 'var(--primary-light)' : 'var(--status-error-bg)',
                      color: bumdesValid ? 'var(--primary-dark)' : 'var(--status-error)',
                    }}
                    data-testid="bumdes-share-total"
                  >
                    Total: {bumdesTotal}% {bumdesValid ? '' : '(harus 100%)'}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {SHARE_FIELDS_BUMDES.map(([key, label]) => (
                    <Label key={key} className="label">
                      {label}
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="pr-7"
                          value={form[key]}
                          onChange={setNum(key)}
                          data-testid={`org-${key}`}
                        />
                        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                    </Label>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Unit Usaha</span>
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-xs"
                    style={{
                      background: unitValid ? 'var(--primary-light)' : 'var(--status-error-bg)',
                      color: unitValid ? 'var(--primary-dark)' : 'var(--status-error)',
                    }}
                    data-testid="unit-share-total"
                  >
                    Total: {unitTotal}% {unitValid ? '' : '(harus 100%)'}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SHARE_FIELDS_UNIT.map(([key, label]) => (
                    <Label key={key} className="label">
                      {label}
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="pr-7"
                          value={form[key]}
                          onChange={setNum(key)}
                          data-testid={`org-${key}`}
                        />
                        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                    </Label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Kolom Tanda Tangan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Nama dikosongkan akan tampil sebagai titik-titik (belum diisi manual) di dokumen.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Label className="label">
                  Jabatan Kiri
                  <Input
                    className="mt-1"
                    value={form.signatory_left_title}
                    onChange={set('signatory_left_title')}
                  />
                </Label>
                <Label className="label">
                  Jabatan Tengah
                  <Input
                    className="mt-1"
                    value={form.signatory_mid_title}
                    onChange={set('signatory_mid_title')}
                  />
                </Label>
                <Label className="label">
                  Jabatan Kanan
                  <Input
                    className="mt-1"
                    value={form.signatory_right_title}
                    onChange={set('signatory_right_title')}
                  />
                </Label>
                <Label className="label">
                  Nama Kiri
                  <Input
                    className="mt-1"
                    value={form.signatory_left_name}
                    onChange={set('signatory_left_name')}
                  />
                </Label>
                <Label className="label">
                  Nama Tengah
                  <Input
                    className="mt-1"
                    value={form.signatory_mid_name}
                    onChange={set('signatory_mid_name')}
                  />
                </Label>
                <Label className="label">
                  Nama Kanan
                  <Input
                    className="mt-1"
                    value={form.signatory_right_name}
                    onChange={set('signatory_right_name')}
                  />
                </Label>
              </div>
            </CardContent>
          </Card>

          {canWrite && (
            <Button
              type="submit"
              disabled={saving || !bumdesValid || !unitValid}
              data-testid="save-org-profile"
            >
              {saving ? 'Menyimpan...' : 'Simpan Profil BUMDES'}
            </Button>
          )}
        </fieldset>
      </form>
    </div>
  )
}
