import { BookOpen, Check, ChevronsUpDown, FileSpreadsheet, FileText, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAccounts } from '@/api/accounts'
import { fmtDate, fmtRp, getApiError } from '@/api/client'
import { downloadReportFile, fetchLedger } from '@/api/reports'
import { buildUnitGroupTabs } from '@/api/units'
import PeriodFilter from '@/components/PeriodFilter'
import Spinner from '@/components/Spinner'
import TableShell from '@/components/TableShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { useUnitsQuery } from '@/hooks/useUnits'
import { useAuth } from '@/lib/auth'
import { notify } from '@/lib/feedback'
import { cn } from '@/lib/utils'
import type { Account, LedgerData, PeriodValue } from '@/types'

const pad = (n: number) => String(n).padStart(2, '0')

export default function LedgerPage() {
  const { user } = useAuth()
  const isPengelola = user?.role === 'pengelola'
  const unitsQ = useUnitsQuery(false)
  const units = unitsQ.data ?? []

  const [accounts, setAccounts] = useState<Account[]>([])
  const [group, setGroup] = useState('BUMDES')
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const now = new Date()
  const [period, setPeriod] = useState<PeriodValue>({
    mode: 'monthly',
    startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
    endDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`,
    label: '',
  })
  const [ledger, setLedger] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchAccounts()
      .then(setAccounts)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (isPengelola && user?.unit_usaha_id && units.length) {
      const own = units.find((x) => x.id === user.unit_usaha_id)
      if (own) setGroup(own.code)
    }
  }, [isPengelola, user, units])

  const activeUnitId = useMemo(() => {
    if (group === 'BUMDES') return null
    return units.find((u) => u.code === group)?.id || null
  }, [group, units])

  const loadLedger = useCallback(
    async (code: string) => {
      if (!code) {
        setLedger(null)
        return
      }
      setLoading(true)
      try {
        const r = await fetchLedger({
          accountCode: code,
          startDate: period.startDate,
          endDate: period.endDate,
          unitUsahaId: activeUnitId,
        })
        setLedger(r)
      } catch (er) {
        notify(getApiError(er, 'Gagal memuat buku besar'))
      } finally {
        setLoading(false)
      }
    },
    [period.startDate, period.endDate, activeUnitId],
  )

  useEffect(() => {
    if (selected) void loadLedger(selected)
  }, [selected, loadLedger])

  useEffect(() => {
    setSelected('')
    setLedger(null)
  }, [group])

  const download = async (kind: 'pdf' | 'excel' | 'word') => {
    if (!selected) return
    const params: Record<string, string | undefined> = {
      account_code: selected,
      start_date: period.startDate,
      end_date: period.endDate,
    }
    if (activeUnitId) params.unit_usaha_id = activeUnitId
    const ext = kind === 'pdf' ? 'pdf' : kind === 'word' ? 'docx' : 'xlsx'
    try {
      await downloadReportFile(
        `/reports/ledger/${kind}`,
        params,
        `Buku-Besar_${group}_${selected}_${period.startDate}_sd_${period.endDate}.${ext}`,
      )
    } catch {
      notify(`Gagal mengunduh ${kind}`)
    }
  }

  const groupAccounts = useMemo(
    () => accounts.filter((a) => (a.group || 'BUMDES') === group),
    [accounts, group],
  )
  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groupAccounts
    return groupAccounts.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
    )
  }, [groupAccounts, search])

  const groupTabs = useMemo(() => {
    const tabs = buildUnitGroupTabs(units).map((t) => {
      if (t.key === 'BUMDES') return { key: 'BUMDES', label: 'BUMDes - Pusat' }
      const u = units.find((unit) => unit.code === t.key)
      return { key: t.key, label: u ? `${u.code} - ${u.name}` : t.key }
    })
    return isPengelola
      ? tabs.filter(
          (t) => t.key !== 'BUMDES' && t.key === units.find((u) => u.id === user?.unit_usaha_id)?.code,
        )
      : tabs
  }, [units, isPengelola, user])

  return (
    <div className="space-y-6" data-testid="ledger-page">
      <div>
        <p className="label mb-1">GENERAL LEDGER</p>
        <h1 className="font-heading page-h1 flex items-center gap-2 text-3xl font-bold">
          <BookOpen className="size-7" style={{ color: 'var(--primary-dark)' }} /> Buku Besar per Akun
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Tiap kelompok punya buku besar sendiri. Pilih kelompok terlebih dahulu, lalu pilih akun.
        </p>
      </div>

      <Card className="grid grid-cols-1 items-start gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="ledger-filters">
        <div>
          <label className="label" htmlFor="ledger-group-select">
            Kelompok
          </label>
          <Select value={group} disabled={isPengelola} onValueChange={setGroup}>
            <SelectTrigger id="ledger-group-select" data-testid="ledger-group-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupTabs.map((g) => (
                <SelectItem key={g.key} value={g.key}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="label">Periode</label>
          <PeriodFilter
            value={period}
            onChange={(next) => {
              setPeriod(next)
              setSelected('')
              setLedger(null)
            }}
            defaultMode="monthly"
            data-testid="ledger-period-filter"
            className="w-full"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label">Akun</label>
          <AccountCombobox
            accounts={filteredAccounts}
            group={group}
            selected={selected}
            onSelect={setSelected}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
      </Card>

      {!selected ? (
        <Card className="py-16 text-center">
          <BookOpen className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            Pilih akun dari dropdown di atas untuk melihat buku besar <b>{group}</b>.
          </p>
        </Card>
      ) : loading ? (
        <Card className="py-10 text-center">
          <Spinner column size={40} className="justify-center" />
        </Card>
      ) : ledger ? (
        <Card className="overflow-hidden p-0">
          <div className="p-5" style={{ borderBottom: '1px solid var(--legacy-border)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label mb-0">Buku Besar · {group}</p>
                <h3 className="font-heading text-xl font-bold" data-testid="ledger-title">
                  {ledger.account.code} — {ledger.account.name}
                </h3>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Kategori: {ledger.account.category} • Saldo normal: {ledger.account.normal_balance}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-3">
                <div className="text-right">
                  <div className="label">Saldo Akhir</div>
                  <div
                    className="font-heading text-xl font-bold"
                    style={{ color: 'var(--primary-dark)' }}
                    data-testid="ledger-final-balance"
                  >
                    {fmtRp(ledger.saldo_akhir)}
                  </div>
                </div>
                <Button variant="outline" data-testid="btn-ledger-pdf" onClick={() => void download('pdf')}>
                  <FileText className="size-4 text-destructive" /> Export PDF
                </Button>
                <Button
                  variant="outline"
                  data-testid="btn-ledger-excel"
                  onClick={() => void download('excel')}
                >
                  <FileSpreadsheet className="size-4" /> Export Excel
                </Button>
                <Button
                  variant="outline"
                  data-testid="btn-ledger-word"
                  onClick={() => void download('word')}
                >
                  <FileText className="size-4" /> Export Word
                </Button>
              </div>
            </div>
          </div>
          <TableShell minWidth={760} data-testid="ledger-table">
            <Table className="tbl-compact-mobile" data-testid="ledger-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Akun Lawan</TableHead>
                  <TableHead>Ref.</TableHead>
                  <TableHead className="num">Debit</TableHead>
                  <TableHead className="num">Kredit</TableHead>
                  <TableHead className="num">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow style={{ background: 'var(--primary-light)' }}>
                  <TableCell colSpan={6} className="font-semibold">
                    Saldo Awal
                  </TableCell>
                  <TableCell className="num font-semibold">{fmtRp(ledger.saldo_awal)}</TableCell>
                </TableRow>
                {ledger.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Tidak ada transaksi pada periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger.entries.map((e) => (
                    <TableRow key={e.id || `${e.date}-${e.description}-${e.balance}`}>
                      <TableCell>{fmtDate(e.date)}</TableCell>
                      <TableCell className="max-w-xs">{e.description}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-mono">{e.other_account_code}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{e.other_account_name}</div>
                      </TableCell>
                      <TableCell className="text-xs">{e.reference || '-'}</TableCell>
                      <TableCell className="num">{e.debit ? fmtRp(e.debit) : '-'}</TableCell>
                      <TableCell className="num">{e.credit ? fmtRp(e.credit) : '-'}</TableCell>
                      <TableCell className="num font-semibold tabular-nums">{fmtRp(e.balance)}</TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow style={{ background: 'var(--total-row-bg)' }}>
                  <TableCell colSpan={4} className="font-bold" style={{ color: 'var(--primary-dark)' }}>
                    TOTAL PERIODE
                  </TableCell>
                  <TableCell className="num font-bold">{fmtRp(ledger.total_debit || 0)}</TableCell>
                  <TableCell className="num font-bold">{fmtRp(ledger.total_credit || 0)}</TableCell>
                  <TableCell className="num font-bold">{fmtRp(ledger.saldo_akhir)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableShell>
        </Card>
      ) : null}
    </div>
  )
}

function AccountCombobox({
  accounts,
  group,
  selected,
  onSelect,
  search,
  onSearchChange,
}: {
  accounts: Account[]
  group: string
  selected: string
  onSelect: (code: string) => void
  search: string
  onSearchChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedAccount =
    accounts.find((a) => a.code === selected) || (selected ? { code: selected, name: '' } : null)

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setTimeout(() => inputRef.current?.focus(), 0)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          id="ledger-account-select"
          data-testid="ledger-account-select"
          className="w-full justify-between font-normal"
        >
          {selectedAccount ? (
            <span className="truncate text-left">
              <span className="mr-2 font-mono text-xs font-semibold">{selectedAccount.code}</span>
              <span>{selectedAccount.name}</span>
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Pilih akun {group}...</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2" style={{ borderBottom: '1px solid var(--legacy-border)' }}>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              id="ledger-search"
              data-testid="ledger-search"
              className="pl-10"
              placeholder="Cari berdasarkan kode atau nama akun"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <ul data-testid="ledger-account-list" className="max-h-72 overflow-y-auto">
          {accounts.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">
              Belum ada akun pada kelompok <b>{group}</b>.
            </li>
          ) : (
            accounts.map((a) => {
              const active = a.code === selected
              return (
                <li key={a.code}>
                  <button
                    type="button"
                    data-testid={`ledger-acc-${a.code}`}
                    onClick={() => {
                      onSelect(a.code)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 border-b px-4 py-2.5 text-left transition-colors',
                      active ? 'bg-primary/10' : 'bg-transparent hover:bg-muted/50',
                    )}
                    style={{ borderColor: 'var(--legacy-border)' }}
                  >
                    <span>
                      <span
                        className={cn(
                          'block font-mono text-xs font-semibold',
                          active ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {a.code}
                      </span>
                      <span className={cn('block text-sm', active ? 'text-primary' : 'text-foreground')}>
                        {a.name}
                      </span>
                    </span>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
