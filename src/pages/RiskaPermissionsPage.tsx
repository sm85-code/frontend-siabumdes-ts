import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import HelpHint from '@/components/HelpHint'
import api from '@/api/client'
import { Switch } from '@/components/ui/switch'

type Assignment = { user_id: string; name: string; username: string; role: string; unit: string; active: boolean; unit_active: boolean; is_allowed: boolean }
const key = ['riska-assignments']

export default function RiskaPermissionsPage() {
  const client = useQueryClient()
  const { data, isPending, error } = useQuery({ queryKey: key, refetchInterval: 5_000, queryFn: async () => (await api.get<Assignment[]>('/v1/admin/riska-assignments')).data })
  const mutation = useMutation({ mutationFn: async (body: { user_id: string; is_allowed: boolean }) => api.patch('/v1/admin/riska-assignments', body),
    onSuccess: () => client.invalidateQueries({ queryKey: key }) })
  return <section className="space-y-4">
    <div className="flex items-center gap-1"><h1 className="font-heading page-h1 text-2xl font-bold sm:text-3xl">Penugasan Asisten Riska</h1><HelpHint label="Tentang Penugasan Riska"><p>Pilih pengguna yang membutuhkan bantuan. Riska hanya memakai hak akses pengguna tersebut. Setelah pengguna mengakhiri sesi, Riska menghilang sampai ditugaskan kembali.</p></HelpHint></div>
    {(error || mutation.error) && <p role="alert">Perubahan tidak berhasil. Periksa koneksi dan hak akses.</p>}
    {mutation.isSuccess && <p role="status">Penugasan tersimpan. Tombol Riska akan mengikuti status bantuan dalam sekitar 5 detik, atau saat pengguna kembali membuka halaman SIABUMDES.</p>}
    {isPending && <p>Memuat penugasan…</p>}
    {data?.map(row => <div key={row.user_id} className="flex items-center justify-between gap-3 rounded border p-4">
      <div className="min-w-0"><p className="font-semibold break-words">{row.name}</p>
        <p className="break-words text-sm">{row.username} · {row.role} · {row.unit}</p>
        {(!row.active || !row.unit_active) && <p className="text-sm text-red-700">Pengguna atau unit nonaktif</p>}
      </div>
      <Switch aria-label={`Bantuan Riska ${row.name}`} checked={row.is_allowed} disabled={mutation.isPending || (!row.is_allowed && (!row.active || !row.unit_active))}
        onCheckedChange={is_allowed => mutation.mutate({ user_id: row.user_id, is_allowed })} />
    </div>)}
  </section>
}
