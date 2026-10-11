import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { Switch } from '@/components/ui/switch'

type Permission = { unit_usaha_id: string; code: string; name: string; active: boolean; is_allowed: boolean }
const key = ['riska-permissions']

export default function RiskaPermissionsPage() {
  const client = useQueryClient()
  const { data, isPending, error } = useQuery({ queryKey: key, queryFn: async () => (await api.get<Permission[]>('/v1/admin/riska-permissions')).data })
  const mutation = useMutation({ mutationFn: async (body: { unit_usaha_id: string; is_allowed: boolean }) => api.patch('/v1/admin/riska-permissions', body),
    onSuccess: () => client.invalidateQueries({ queryKey: key }) })
  return <section className="space-y-4">
    <h1 className="text-2xl font-bold">Izin Asisten Riska</h1>
    <p>Izin berlaku untuk seluruh pengelola pada unit. Unit nonaktif tetap tidak dapat memakai Riska.</p>
    {(error || mutation.error) && <p role="alert">Perubahan tidak berhasil. Periksa koneksi dan hak akses.</p>}
    {isPending && <p>Memuat izin…</p>}
    {data?.map(row => <div key={row.unit_usaha_id} className="flex items-center justify-between rounded border p-4">
      <span>{row.code} — {row.name}{!row.active && ' (Nonaktif)'}</span>
      <Switch aria-label={`Izin Riska ${row.name}`} checked={row.is_allowed} disabled={mutation.isPending}
        onCheckedChange={is_allowed => mutation.mutate({ unit_usaha_id: row.unit_usaha_id, is_allowed })} />
    </div>)}
  </section>
}
