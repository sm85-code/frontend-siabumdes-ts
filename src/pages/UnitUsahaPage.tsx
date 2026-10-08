import { Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import api, { getApiError } from '@/api/client'
import type { UnitUsaha } from '@/types'
import { useAuth, can } from '@/lib/auth'
import { notify } from '@/lib/feedback'
import Spinner from '@/components/Spinner'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  createUnitSchema,
  editUnitSchema,
  type CreateUnitFormValues,
  type EditUnitFormValues,
} from '@/schemas/units'

const BUSINESS_TYPES = [
  { value: 'jasa', label: 'Jasa' },
  { value: 'perdagangan', label: 'Perdagangan' },
  { value: 'manufaktur', label: 'Manufaktur' },
] as const
const BUSINESS_TYPE_LABEL = Object.fromEntries(BUSINESS_TYPES.map((t) => [t.value, t.label]))

const EMPTY_CREATE: CreateUnitFormValues = {
  code: '',
  name: '',
  business_type: 'jasa',
}

export default function UnitUsahaPage() {
  const { user } = useAuth()
  // Admin & Direktur can edit; Penasihat & Pengawas are view-only.
  const canWrite = can(user, 'admin', 'direktur')
  const [list, setList] = useState<UnitUsaha[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<UnitUsaha | null>(null)

  const createForm = useForm<CreateUnitFormValues>({
    resolver: zodResolver(createUnitSchema),
    defaultValues: EMPTY_CREATE,
  })
  const editForm = useForm<EditUnitFormValues>({
    resolver: zodResolver(editUnitSchema),
    defaultValues: { name: '', business_type: 'jasa', active: true },
  })

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get<UnitUsaha[]>('/unit-usaha', { params: { include_inactive: true } })
      setList(r.data || [])
    } catch (er) {
      notify(getApiError(er, 'Gagal memuat daftar unit usaha'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const submitNew = async (values: CreateUnitFormValues) => {
    if (!canWrite) return
    setSaving(true)
    try {
      await api.post('/unit-usaha', values)
      notify('Unit usaha baru ditambahkan')
      setAddOpen(false)
      createForm.reset(EMPTY_CREATE)
      await load()
    } catch (er) {
      notify(getApiError(er, 'Gagal menambah unit usaha'))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (u: UnitUsaha) => {
    setEditing(u)
    editForm.reset({
      name: u.name,
      business_type:
        u.business_type === 'perdagangan' || u.business_type === 'manufaktur'
          ? u.business_type
          : 'jasa',
      active: u.active !== false,
    })
  }

  const submitEdit = async (values: EditUnitFormValues) => {
    if (!canWrite || !editing) return
    setSaving(true)
    try {
      await api.patch(`/unit-usaha/${editing.id}`, {
        name: values.name,
        business_type: values.business_type,
        active: values.active,
      })
      notify('Perubahan unit usaha tersimpan')
      setEditing(null)
      await load()
    } catch (er) {
      notify(getApiError(er, 'Gagal menyimpan perubahan unit usaha'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner column size={48} label="Memuat unit usaha..." />
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="unit-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label mb-1">Struktur Usaha</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{list.length} Unit Usaha BUMDes</h1>
        </div>
        {canWrite && (
          <Dialog
            open={addOpen}
            onOpenChange={(o) => {
              setAddOpen(o)
              if (!o) createForm.reset(EMPTY_CREATE)
            }}
          >
            <DialogTrigger asChild>
              <Button data-testid="unit-add-btn">
                <Plus className="mr-1" /> Tambah Unit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Unit Usaha</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => void createForm.handleSubmit(submitNew)(e)}
                className="space-y-3"
              >
                <div>
                  <Label htmlFor="new-code">Kode unit</Label>
                  <Input
                    id="new-code"
                    data-testid="unit-new-code"
                    placeholder="mis. UU07"
                    aria-invalid={Boolean(createForm.formState.errors.code)}
                    {...createForm.register('code')}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Kode tidak bisa diubah lagi setelah dibuat.
                  </p>
                  {createForm.formState.errors.code && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
                      {createForm.formState.errors.code.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="new-name">Nama unit</Label>
                  <Input
                    id="new-name"
                    data-testid="unit-new-name"
                    aria-invalid={Boolean(createForm.formState.errors.name)}
                    {...createForm.register('name')}
                  />
                  {createForm.formState.errors.name && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
                      {createForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Jenis usaha</Label>
                  <Controller
                    control={createForm.control}
                    name="business_type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-testid="unit-new-business-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUSINESS_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {createForm.formState.errors.business_type && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
                      {createForm.formState.errors.business_type.message}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving} data-testid="unit-new-save">
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
        {!canWrite && (
          <p className="text-muted-foreground text-sm" data-testid="unit-usaha-readonly-banner">
            Mode lihat saja — role Anda tidak dapat mengubah Profil Unit Usaha.
          </p>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode</TableHead>
            <TableHead>Nama Unit</TableHead>
            <TableHead>Jenis Usaha</TableHead>
            <TableHead>Status</TableHead>
            {canWrite && <TableHead className="text-right">Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((u) => (
            <TableRow
              key={u.id}
              data-testid={`unit-row-${u.code}`}
              className={u.active === false ? 'opacity-60' : ''}
            >
              <TableCell>
                <Badge variant="secondary">{u.code}</Badge>
              </TableCell>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell>
                {(u.business_type && BUSINESS_TYPE_LABEL[u.business_type]) || u.business_type}
              </TableCell>
              <TableCell>
                {u.active === false ? (
                  <Badge variant="outline">Nonaktif</Badge>
                ) : (
                  <Badge variant="outline">Aktif</Badge>
                )}
              </TableCell>
              {canWrite && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid={`unit-edit-${u.code}`}
                    onClick={() => openEdit(u)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={canWrite && !!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Unit Usaha {editing?.code}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => void editForm.handleSubmit(submitEdit)(e)}
              className="space-y-3"
            >
              <div>
                <Label>Kode unit</Label>
                <Input value={editing.code} disabled />
                <p className="text-muted-foreground mt-1 text-xs">
                  Kode tidak bisa diubah karena sudah dipakai di akun/transaksi unit ini.
                </p>
              </div>
              <div>
                <Label htmlFor="edit-name">Nama unit</Label>
                <Input
                  id="edit-name"
                  data-testid="unit-edit-name"
                  aria-invalid={Boolean(editForm.formState.errors.name)}
                  {...editForm.register('name')}
                />
                {editForm.formState.errors.name && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Jenis usaha</Label>
                <Controller
                  control={editForm.control}
                  name="business_type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="unit-edit-business-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {editForm.formState.errors.business_type && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--status-error)' }}>
                    {editForm.formState.errors.business_type.message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={editForm.control}
                  name="active"
                  render={({ field }) => (
                    <Switch
                      id="edit-active"
                      data-testid="unit-edit-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="edit-active">Unit aktif</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving} data-testid="unit-edit-save">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
