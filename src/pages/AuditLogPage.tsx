import { ClipboardList } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchAuditLog } from '@/api/admin'
import { queryKeys } from '@/api/keys'
import Spinner from '@/components/Spinner'
import TableShell from '@/components/TableShell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ROLE_LABELS } from '@/config/roles'

const ACTION_LABELS: Record<string, string> = {
  login_success: 'Login berhasil',
  login_failed: 'Login gagal',
  create_user: 'Buat akun',
  update_user: 'Ubah akun',
  delete_user: 'Hapus akun',
  reset_password: 'Reset password',
  update_blocked_periods: 'Ubah periode terkunci',
  system_lock: 'Kunci sistem',
  system_unlock: 'Buka kunci sistem',
  close_period: 'Tutup periode',
  reopen_period: 'Buka kembali periode',
  update_org_profile: 'Ubah profil BUMDES',
  create_unit_usaha: 'Buat unit usaha',
  update_unit_usaha: 'Ubah unit usaha',
  create_account: 'Buat kode akun',
  update_account: 'Ubah kode akun',
  delete_account: 'Hapus kode akun',
  reset_accounts: 'Hapus semua kode akun',
  import_accounts: 'Import kode akun',
  create_transaction_type: 'Buat jenis transaksi',
  update_transaction_type: 'Ubah jenis transaksi',
  delete_transaction_type: 'Hapus jenis transaksi',
  import_transaction_types: 'Import jenis transaksi',
  delete_mitra: 'Hapus mitra',
}

const DESTRUCTIVE_ACTIONS = new Set([
  'login_failed',
  'delete_user',
  'delete_account',
  'reset_accounts',
  'delete_transaction_type',
  'delete_mitra',
  'reopen_period',
  'system_lock',
])

const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return '-'
  try {
    return new Date(s).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return s
  }
}

export default function AuditLogPage() {
  const q = useQuery({
    queryKey: queryKeys.audit.list(200),
    queryFn: () => fetchAuditLog(200),
  })
  const rows = q.data ?? []
  const loading = q.isLoading

  return (
    <div className="space-y-6" data-testid="audit-log-page">
      <div>
        <p className="label mb-1">Manajemen Akses (Admin Utama)</p>
        <h1 className="font-heading page-h1 text-3xl font-bold">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jejak aksi sensitif. Menampilkan {rows.length} entri terbaru.
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        {loading ? (
          <CardContent className="flex justify-center py-10">
            <Spinner label="Memuat audit log..." />
          </CardContent>
        ) : rows.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 size-8 opacity-50" />
            Belum ada aktivitas tercatat.
          </CardContent>
        ) : (
          <TableShell minWidth={860} data-testid="audit-log-table">
            <Table data-testid="audit-log-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Pelaku</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {fmtDateTime(row.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.actor_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ROLE_LABELS[row.actor_role as keyof typeof ROLE_LABELS] || row.actor_role}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={DESTRUCTIVE_ACTIONS.has(row.action) ? 'destructive' : 'secondary'}>
                        {ACTION_LABELS[row.action] || row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{row.detail || '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.ip}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </Card>
    </div>
  )
}
