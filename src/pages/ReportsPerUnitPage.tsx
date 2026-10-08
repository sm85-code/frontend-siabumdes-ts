import { FileSpreadsheet, FileText } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { fmtRp, getApiError } from '@/api/client'
import { downloadReportFile, fetchReport } from '@/api/reports'
import PeriodFilter from '@/components/PeriodFilter'
import Spinner from '@/components/Spinner'
import TableShell from '@/components/TableShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notifyError } from '@/lib/feedback'
import type { PeriodValue } from '@/types'

const today = new Date().toISOString().slice(0, 10)
const currentYear = today.slice(0, 4)
const currentMonth = today.slice(5, 7)
const lastDay = String(
  new Date(Number(currentYear), Number(currentMonth), 0).getDate(),
).padStart(2, '0')

type UnitRow = {
  id: string
  code: string
  name: string
  pendapatan: number
  beban: number
  laba_bersih: number
  share_pengelola_30: number
  share_bumdes_70: number
}

export default function ReportsPerUnitPage() {
  const [period, setPeriod] = useState<PeriodValue>({
    mode: 'monthly',
    startDate: `${currentYear}-${currentMonth}-01`,
    endDate: `${currentYear}-${currentMonth}-${lastDay}`,
    label: '',
  })
  const [data, setData] = useState<{ units: UnitRow[] } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = (await fetchReport('per-unit', {
        start_date: period.startDate,
        end_date: period.endDate,
      })) as { units: UnitRow[] }
      setData(r)
    } catch (er) {
      notifyError(getApiError(er, 'Gagal memuat laporan per unit'))
    } finally {
      setLoading(false)
    }
  }, [period.startDate, period.endDate])

  useEffect(() => {
    void load()
  }, [load])

  const download = async (kind: 'pdf' | 'excel') => {
    const ext = kind === 'pdf' ? 'pdf' : 'xlsx'
    try {
      await downloadReportFile(
        `/reports/per-unit/${kind}`,
        { start_date: period.startDate, end_date: period.endDate },
        `Laporan-Per-Unit_${period.startDate}_sd_${period.endDate}.${ext}`,
      )
    } catch {
      notifyError(`Gagal unduh ${kind}`)
    }
  }

  return (
    <div className="space-y-6" data-testid="per-unit-page">
      <div>
        <p className="label mb-1">Laporan</p>
        <h1 className="font-heading text-3xl font-bold">Kinerja Per Unit Usaha</h1>
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div>
            <label className="label">Periode</label>
            <PeriodFilter
              value={period}
              onChange={setPeriod}
              defaultMode="monthly"
              data-testid="per-unit-period-filter"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="btn-per-unit-pdf" onClick={() => void download('pdf')}>
              <FileText className="size-4 text-destructive" /> PDF
            </Button>
            <Button
              variant="outline"
              data-testid="btn-per-unit-excel"
              onClick={() => void download('excel')}
            >
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>
      {loading && (
        <Card className="flex justify-center py-10">
          <Spinner label="Memuat laporan..." />
        </Card>
      )}
      {!loading && data && (
        <Card className="overflow-hidden p-0">
          <TableShell minWidth={720}>
            <Table data-testid="per-unit-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Unit Usaha</TableHead>
                  <TableHead className="num">Pendapatan</TableHead>
                  <TableHead className="num">Beban</TableHead>
                  <TableHead className="num">Laba Bersih</TableHead>
                  <TableHead className="num">30% Pengelola</TableHead>
                  <TableHead className="num">70% BUMDes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.units.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Badge>{u.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="num">{fmtRp(u.pendapatan)}</TableCell>
                    <TableCell className="num">{fmtRp(u.beban)}</TableCell>
                    <TableCell
                      className="num font-semibold"
                      style={{
                        color: u.laba_bersih >= 0 ? 'var(--primary-dark)' : 'var(--status-error)',
                      }}
                    >
                      {fmtRp(u.laba_bersih)}
                    </TableCell>
                    <TableCell className="num" style={{ color: 'var(--primary-dark)' }}>
                      {fmtRp(u.share_pengelola_30)}
                    </TableCell>
                    <TableCell className="num" style={{ color: 'var(--primary-dark)' }}>
                      {fmtRp(u.share_bumdes_70)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        </Card>
      )}
    </div>
  )
}
