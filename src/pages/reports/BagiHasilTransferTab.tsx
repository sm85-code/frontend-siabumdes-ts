import { HandCoins } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fmtRp, getApiError } from '@/api/client'
import {
  cancelBagiHasilTransfer,
  fetchBagiHasilTransfers,
  transferBagiHasil,
  type BagiHasilTransferRow,
} from '@/api/reports'
import { useConfirm } from '@/components/ConfirmProvider'
import TableShell from '@/components/TableShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notify } from '@/lib/feedback'
import type { UnitUsaha } from '@/types'

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]
/** BUMDES (Pusat) transfers per triwulan: only quarter-end months. */
const BUMDES_MONTHS = [3, 6, 9, 12]
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()

interface Props {
  units: UnitUsaha[]
}

export default function BagiHasilTransferTab({ units }: Props) {
  const confirm = useConfirm()
  const [group, setGroup] = useState('BUMDES')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(Math.ceil((now.getMonth() + 1) / 3) * 3)
  const [rows, setRows] = useState<BagiHasilTransferRow[]>([])
  const [busy, setBusy] = useState(false)

  const period = `${year}-${pad(month)}`
  const monthOptions =
    group === 'BUMDES' ? BUMDES_MONTHS : MONTHS.map((_, i) => i + 1)

  const load = () =>
    fetchBagiHasilTransfers()
      .then(setRows)
      .catch(() => {})
  useEffect(() => {
    void load()
  }, [])

  const onGroupChange = (g: string) => {
    setGroup(g)
    // Snap to the next quarter-end month when switching to BUMDES.
    if (g === 'BUMDES' && !BUMDES_MONTHS.includes(month)) setMonth(Math.ceil(month / 3) * 3)
  }

  const doTransfer = async () => {
    if (
      !(await confirm({
        title: 'Transfer bagi hasil',
        description: `Transfer bagi hasil periode ${period} untuk ${group}?`,
        confirmLabel: 'Transfer Bagi Hasil',
        destructive: true,
      }))
    )
      return
    setBusy(true)
    try {
      const r = await transferBagiHasil(period, group)
      notify(`Berhasil ditransfer ${fmtRp(r.total)} (tanggal ${r.date}).`)
      void load()
    } catch (er) {
      notify(getApiError(er, 'Gagal transfer bagi hasil'))
    } finally {
      setBusy(false)
    }
  }

  const doCancel = async (p: string, g: string) => {
    if (
      !(await confirm({
        title: 'Batalkan transfer bagi hasil',
        description: `Batalkan transfer bagi hasil ${p} (${g})? Transaksi pembayarannya akan dihapus.`,
        confirmLabel: 'Batalkan',
        destructive: true,
      }))
    )
      return
    try {
      await cancelBagiHasilTransfer(p, g)
      void load()
    } catch (er) {
      notify(getApiError(er, 'Gagal membatalkan'))
    }
  }

  return (
    <Card data-testid="bagi-hasil-card">
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center gap-2">
          <HandCoins className="size-5 text-emerald-500" />
          <h3 className="font-heading font-semibold">Transfer Bagi Hasil</h3>
        </div>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Melunasi saldo utang bagi hasil setelah periode ditutup buku. BUMDes: per triwulan
          (Maret, Juni, September, Desember) ke Pengurus, Penasihat, Pengawas, dan Dana Sosial. Unit
          usaha: tiap bulan ke BUMDes dan Pengelola. Transaksi dicatat tanggal 1 bulan berikutnya.
        </p>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-5">
          <div>
            <label className="label">Kelompok</label>
            <Select value={group} onValueChange={onGroupChange}>
              <SelectTrigger data-testid="bh-group-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUMDES">BUMDes</SelectItem>
                {units
                  .filter((u) => u.active !== false)
                  .map((u) => (
                    <SelectItem key={u.code} value={u.code}>
                      {u.code} - {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="label">Tahun</label>
            <Input
              type="number"
              groupDigits={false}
              data-testid="bh-year-input"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
            />
          </div>
          <div>
            <label className="label">Bulan</label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger data-testid="bh-month-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {MONTHS[m - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button data-testid="btn-bagi-hasil-transfer" disabled={busy} onClick={() => void doTransfer()}>
            <HandCoins className="size-4" /> Transfer Bagi Hasil
          </Button>
        </div>
        <div className="mt-6">
          <p className="label mb-2">Transfer Sudah Dilakukan ({rows.length})</p>
          <TableShell minWidth={560}>
            <Table data-testid="bagi-hasil-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Kelompok</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="num">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Belum ada transfer bagi hasil.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.period + r.group}>
                      <TableCell className="font-medium">{r.period}</TableCell>
                      <TableCell>
                        <Badge>{r.group}</Badge>
                      </TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="num">{fmtRp(r.total)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          data-testid={`bh-cancel-${r.period}-${r.group}`}
                          onClick={() => void doCancel(r.period, r.group)}
                        >
                          Batalkan
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableShell>
        </div>
      </CardContent>
    </Card>
  )
}
