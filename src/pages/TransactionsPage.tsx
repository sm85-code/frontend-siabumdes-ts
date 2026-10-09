import FormDialog from '@/components/FormDialog'
import {
  Download,
  FileSpreadsheet,
  FileUp,
  HardDrive,
  Plus,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getApiError } from '@/api/client'
import { fetchDriveConnectUrl, fetchDriveStatus } from '@/api/admin'
import { buildUnitGroupTabs } from '@/api/units'
import {
  createTransaction,
  deleteProof,
  deleteTransaction,
  downloadTxTemplate,
  exportTransactions,
  importTransactions,
  triggerBlobDownload,
  updateTransaction,
  uploadProof,
  verifyProofs,
} from '@/api/transactions'
import { useConfirm } from '@/components/ConfirmProvider'
import PeriodFilter, { fmtRangeLabel, resolveRange } from '@/components/PeriodFilter'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { can } from '@/config/roles'
import {
  PAGE_SIZE,
  useAccountsQuery,
  useInvalidateTransactions,
  useTransactionTypesQuery,
  useTransactionsPage,
} from '@/hooks/useTransactions'
import { useUnitsQuery } from '@/hooks/useUnits'
import { useAuth } from '@/lib/auth'
import { notify, notifyError, notifySuccess } from '@/lib/feedback'
import type { DriveStatus, ImportResult, PeriodValue, Transaction } from '@/types'
import TxFormCard from '@/pages/transactions/TxFormCard'
import TxTable from '@/pages/transactions/TxTable'
import { emptyTxForm, type TxFormState } from '@/pages/transactions/types'
import type { TransactionFormValues } from '@/schemas/transactions'

const pad = (n: number) => String(n).padStart(2, '0')

function defaultMonthPeriod(): PeriodValue {
  const now = new Date()
  const range = resolveRange('monthly', {
    monthValue: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
    yearValue: now.getFullYear(),
    customStart: '',
    customEnd: '',
  })
  return {
    mode: 'monthly',
    startDate: range.startDate,
    endDate: range.endDate,
    label: fmtRangeLabel(range.startDate, range.endDate),
  }
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const invalidate = useInvalidateTransactions()
  const canWrite = can(user, 'admin', 'direktur', 'bendahara', 'pengelola')
  const canImport = can(user, 'admin', 'direktur', 'bendahara')
  const canBulkDelete = can(user, 'admin', 'direktur', 'bendahara')
  const isPengelola = user?.role === 'pengelola'

  const [searchParams, setSearchParams] = useSearchParams()
  const refFilter = searchParams.get('reference') || ''
  const clearRefFilter = () =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.delete('reference')
      return p
    })

  const unitsQ = useUnitsQuery(false)
  const typesQ = useTransactionTypesQuery()
  const accountsQ = useAccountsQuery()
  const units = unitsQ.data ?? []
  const types = typesQ.data ?? []
  const accounts = accountsQ.data ?? []

  const [formError, setFormError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [formDefaults, setFormDefaults] = useState<TxFormState>(emptyTxForm)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null)
  const [activeGroup, setActiveGroup] = useState('BUMDES')
  const [period, setPeriod] = useState<PeriodValue>(defaultMonthPeriod)
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const periodLabel = fmtRangeLabel(period.startDate, period.endDate)

  const groupTabs = useMemo(() => {
    const tabs = buildUnitGroupTabs(units).map((t) => {
      if (t.key === 'BUMDES') return { key: t.key, label: 'BUMDes - Pusat' }
      const unit = units.find((u) => u.code === t.key)
      return { key: t.key, label: unit ? `${t.key} - ${unit.name}` : t.key }
    })
    if (isPengelola) {
      const ownCode = units.find((u) => u.id === user?.unit_usaha_id)?.code
      return tabs.filter((t) => t.key === ownCode)
    }
    return tabs
  }, [units, isPengelola, user])

  const activeUnitId = useMemo(() => {
    if (activeGroup === 'BUMDES') return null
    return units.find((u) => u.code === activeGroup)?.id || null
  }, [activeGroup, units])

  // Server pagination: period + unit. BUMDES tab uses B4 pusat sentinel (null → '').
  const listParams = useMemo(() => {
    if (refFilter) {
      return { reference: refFilter, limit: 200, offset: 0 }
    }
    return {
      startDate: period.startDate,
      endDate: period.endDate,
      // null = pusat sentinel (IS NULL); unit id = that unit
      unitUsahaId: activeGroup === 'BUMDES' ? null : activeUnitId,
      limit: PAGE_SIZE,
      offset,
    }
  }, [refFilter, period.startDate, period.endDate, activeGroup, activeUnitId, offset])

  const txQ = useTransactionsPage(listParams)
  const pageData = txQ.data
  const items = pageData?.items ?? []
  const hasMore = pageData?.has_more ?? false
  const loading = txQ.isFetching

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDriveStatus()
        .then(setDriveStatus)
        .catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (!canWrite) return
    let ignore = false
    verifyProofs()
      .then((r) => {
        if (!ignore && r?.removed > 0) invalidate()
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [user, canWrite, invalidate])

  useEffect(() => {
    if (isPengelola && units.length && user?.unit_usaha_id) {
      const own = units.find((x) => x.id === user.unit_usaha_id)
      if (own && activeGroup !== own.code) setActiveGroup(own.code)
    }
  }, [isPengelola, units, user, activeGroup])

  useEffect(() => {
    setOffset(0)
    setSelected(new Set())
  }, [activeGroup, period.startDate, period.endDate, refFilter])

  const connectDrive = async () => {
    try {
      const authUrl = await fetchDriveConnectUrl()
      window.open(authUrl, '_blank', 'width=560,height=720')
      const iv = setInterval(() => {
        fetchDriveStatus()
          .then((s) => {
            if (s?.connected) {
              setDriveStatus(s)
              clearInterval(iv)
              notify('Google Drive terhubung')
            }
          })
          .catch(() => {})
      }, 3000)
      setTimeout(() => clearInterval(iv), 180000)
    } catch {
      notify('Gagal memulai koneksi Drive')
    }
  }

  const openCreate = () => {
    setEditingId(null)
    let initialUnit = ''
    if (activeGroup !== 'BUMDES') {
      initialUnit = units.find((u) => u.code === activeGroup)?.id || ''
    }
    if (isPengelola) initialUnit = user?.unit_usaha_id || ''
    setFormDefaults({ ...emptyTxForm(), unit_usaha_id: initialUnit })
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (tx: Transaction) => {
    setEditingId(tx.id)
    setFormDefaults({
      date: tx.date,
      unit_usaha_id: tx.unit_usaha_id || '',
      transaction_type: tx.transaction_type || '',
      description: tx.description || '',
      amount: String(tx.amount || 0),
      debit_account_code: tx.debit_account_code || '',
      credit_account_code: tx.credit_account_code || '',
      reference: tx.reference || '',
    })
    setFormError('')
    setShowForm(true)
  }

  const submit = async (values: TransactionFormValues, addAnother = false) => {
    setFormError('')
    try {
      const body = {
        date: values.date,
        unit_usaha_id: values.unit_usaha_id || null,
        transaction_type: values.transaction_type,
        description: values.description,
        // Submit number unless/until API documents string amounts on write; response may be number|string.
        amount: parseFloat(values.amount),
        debit_account_code: values.debit_account_code,
        credit_account_code: values.credit_account_code,
        reference: values.reference,
      }
      if (editingId) await updateTransaction(editingId, body)
      else await createTransaction(body)
      if (addAnother && !editingId) {
        // Keep date & unit so entries for the same day need no re-typing.
        setFormDefaults({ ...emptyTxForm(), date: values.date, unit_usaha_id: values.unit_usaha_id })
        setFormKey((k) => k + 1)
      } else {
        setShowForm(false)
        setEditingId(null)
      }
      invalidate()
      notifySuccess(editingId ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil disimpan.')
    } catch (er) {
      setFormError(getApiError(er, 'Gagal menyimpan'))
    }
  }

  const del = async (id: string) => {
    if (
      !(await confirm({
        title: 'Hapus transaksi',
        description: 'Transaksi akan dihapus dan tidak dapat dipulihkan.',
        confirmLabel: 'Hapus',
        destructive: true,
      }))
    )
      return
    try {
      await deleteTransaction(id)
      invalidate()
      notifySuccess('Transaksi berhasil dihapus.')
    } catch (er) {
      notifyError(getApiError(er, 'Gagal menghapus transaksi'))
    }
  }

  const bulkDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (
      !(await confirm({
        title: 'Hapus transaksi terpilih',
        description: `Hapus ${ids.length} transaksi terpilih? Aksi ini tidak dapat dibatalkan.`,
        confirmLabel: 'Hapus semua',
        destructive: true,
      }))
    )
      return
    try {
      await Promise.all(ids.map((id) => deleteTransaction(id)))
      notifySuccess(`${ids.length} transaksi berhasil dihapus.`)
    } catch (er) {
      notifyError('Sebagian gagal dihapus: ' + getApiError(er))
    }
    setSelected(new Set())
    invalidate()
  }

  const onUploadProof = async (tx: Transaction) => {
    if (driveStatus && !driveStatus.connected && user?.role === 'admin') {
      notify("Google Drive belum terhubung. Klik 'Hubungkan Drive' dulu.")
      return
    }
    const current = tx.proofs || []
    if (current.length >= 3) {
      notify('Maksimal 3 file bukti per transaksi.')
      return
    }
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (!f) return
      if (f.size > 1024 * 1024) {
        notify('Ukuran file maksimal 1 MB')
        return
      }
      try {
        const data = await uploadProof(tx.id, f)
        const last = (data.proofs || []).slice(-1)[0]
        notify(`Bukti terupload: ${last?.file_name || 'OK'}`)
        invalidate()
      } catch (er) {
        notify('Gagal upload: ' + (er instanceof Error ? er.message : String(er)))
      }
    }
    inp.click()
  }

  const onDeleteProof = async (tx: Transaction, fileId: string, fileName: string) => {
    if (
      !(await confirm({
        title: 'Hapus bukti transaksi',
        description: `Hapus file bukti "${fileName}"? File juga akan dihapus dari Google Drive.`,
        confirmLabel: 'Hapus',
        destructive: true,
      }))
    )
      return
    try {
      await deleteProof(tx.id, fileId)
      invalidate()
    } catch (er) {
      notify('Gagal hapus: ' + (er instanceof Error ? er.message : String(er)))
    }
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importTransactions(file)
      setImportResult(data)
      invalidate()
    } catch (er) {
      notify('Gagal impor: ' + (er instanceof Error ? er.message : String(er)))
    } finally {
      e.target.value = ''
    }
  }

  const doExportExcel = async () => {
    if (items.length === 0) {
      const proceed = await confirm({
        title: 'Export tanpa transaksi',
        description: `Tidak ada transaksi ${activeGroup} pada ${periodLabel}. Tetap unduh file kosong?`,
        confirmLabel: 'Unduh file',
      })
      if (!proceed) return
    }
    try {
      const blob = await exportTransactions({
        startDate: period.startDate,
        endDate: period.endDate,
        unitUsahaId: activeGroup === 'BUMDES' ? null : activeUnitId,
      })
      triggerBlobDownload(
        blob,
        `Transaksi_${activeGroup}_${period.startDate}_sd_${period.endDate}.xlsx`,
      )
    } catch {
      notify('Gagal export Excel')
    }
  }

  const doExportAll = async () => {
    if (
      !(await confirm({
        title: 'Export semua transaksi',
        description:
          'Export SEMUA transaksi dari seluruh unit dan periode ke satu file Excel multi-sheet?',
        confirmLabel: 'Export semua',
      }))
    )
      return
    try {
      const blob = await exportTransactions({ allData: true })
      const today = new Date().toISOString().slice(0, 10)
      triggerBlobDownload(blob, `Transaksi_Semua_Data_${today}.xlsx`)
    } catch {
      notify('Gagal export semua data')
    }
  }

  return (
    <div className="space-y-6" data-testid="transactions-page">
      {user?.blocked_periods && user.blocked_periods.length > 0 && (
        <Card className="fade-in border-destructive/30 bg-destructive/5" data-testid="tx-blocked-banner">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">
              <b>Periode terkunci:</b> {user.blocked_periods.slice().sort().join(', ')}. Anda
              tidak dapat menambah/mengubah/menghapus transaksi pada periode tersebut.
            </p>
          </CardContent>
        </Card>
      )}

      {refFilter && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/40 p-4">
          <p className="text-sm">
            Menampilkan {items.length === 0 ? '0 transaksi' : `${items.length} transaksi`} terkait
            mutasi/penyesuaian stok dari Inventory.
            {items.length === 0 &&
              ' Kemungkinan mutasi ini tidak berdampak nilai (tidak ada jurnal yang diposting).'}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={clearRefFilter}>
            Tampilkan semua transaksi
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label mb-1">JOURNAL ENTRY</p>
          <h1 className="font-heading page-h1 text-3xl font-bold">Transaksi Keuangan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Input transaksi cepat — laporan terbentuk otomatis. Pagination server-side.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {user?.role === 'admin' && (
            <Button
              data-testid="btn-connect-drive"
              onClick={() => void connectDrive()}
              variant="outline"
              className="flex-1 sm:flex-none"
              title={driveStatus?.email ? `Terhubung: ${driveStatus.email}` : 'Belum terhubung'}
            >
              <HardDrive
                className={driveStatus?.connected ? 'text-green-600' : 'text-amber-500'}
              />
              {driveStatus?.connected ? 'Drive Terhubung' : 'Hubungkan Drive'}
            </Button>
          )}
          {canImport && (
            <>
              <Button
                data-testid="btn-download-template"
                onClick={() =>
                  void downloadTxTemplate()
                    .then((b) => triggerBlobDownload(b, 'Template-Transaksi-BUMDes.xlsx'))
                    .catch(() => notify('Gagal download template'))
                }
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                <Download /> Download Template
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                data-testid="import-file-input"
                onChange={(e) => void onFileChange(e)}
              />
              <Button
                data-testid="btn-import-excel"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                <FileUp /> Impor Excel
              </Button>
            </>
          )}
          <Button
            data-testid="btn-export-tx-excel"
            onClick={() => void doExportExcel()}
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            <FileSpreadsheet /> Export Excel
          </Button>
          <Button
            data-testid="btn-export-tx-all"
            onClick={() => void doExportAll()}
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            <FileSpreadsheet /> Export Semua Data
          </Button>
          <Button
            data-testid="btn-new-tx"
            onClick={openCreate}
            disabled={!canWrite}
            className="flex-1 sm:flex-none"
          >
            <Plus /> Tambah Transaksi
          </Button>
        </div>
      </div>

      {importResult && (
        <Card className="fade-in bg-primary/5" data-testid="import-result">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-heading mb-1 font-semibold">Hasil Impor</h4>
                <p className="text-sm">
                  Berhasil: <b>{importResult.inserted}</b> dari <b>{importResult.total_rows}</b>{' '}
                  baris.
                </p>
                {importResult.errors && importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-destructive">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>
                        Baris {err.row}: {err.error}
                      </li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li>+ {importResult.errors.length - 10} error lainnya</li>
                    )}
                  </ul>
                )}
              </div>
              <Button onClick={() => setImportResult(null)} variant="outline" size="sm">
                Tutup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && canWrite && user && (
        <FormDialog key={editingId ?? `create-${formKey}`} title={editingId ? 'Ubah Transaksi' : 'Tambah Transaksi'} onClose={() => { setShowForm(false); setEditingId(null); setFormError('') }} error={formError}>{({ cancel, run }) => <>
          <TxFormCard
            key={editingId ?? `create-${formKey}`}
            editingId={editingId}
            defaultValues={formDefaults}
            units={units}
            types={types}
            accounts={accounts}
            user={user}
            isPengelola={isPengelola}
            onSubmit={(v, again) => run(() => submit(v, again))}
            onCancel={cancel}
          />
        </>}</FormDialog>
      )}

      <Card data-testid="tx-filters">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div>
              <label className="label" htmlFor="tx-group-select">
                Kelompok
              </label>
              <Select
                value={activeGroup}
                onValueChange={setActiveGroup}
                disabled={isPengelola}
              >
                <SelectTrigger id="tx-group-select" data-testid="tx-group-select">
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
                onChange={setPeriod}
                defaultMode="monthly"
                data-testid="tx-period-filter"
              />
            </div>
            <div className="self-center rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
              Tampilkan: {periodLabel} · {activeGroup}
            </div>
            {canBulkDelete && selected.size > 0 && (
              <Button
                data-testid="btn-bulk-delete"
                onClick={() => void bulkDelete()}
                variant="destructive"
                size="sm"
                className="self-center"
              >
                <Trash2 className="size-3.5" /> Hapus {selected.size} Terpilih
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <TxTable
        rows={items}
        loading={loading}
        activeGroup={activeGroup}
        periodLabel={periodLabel}
        total={pageData?.total ?? items.length}
        offset={offset}
        limit={PAGE_SIZE}
        hasMore={hasMore}
        onPageChange={setOffset}
        units={units}
        accounts={accounts}
        user={user}
        canWrite={canWrite}
        canBulkDelete={canBulkDelete}
        selected={selected}
        setSelected={setSelected}
        onEdit={openEdit}
        onDelete={(id) => void del(id)}
        onUploadProof={(tx) => void onUploadProof(tx)}
        onDeleteProof={(tx, fid, name) => void onDeleteProof(tx, fid, name)}
      />
    </div>
  )
}
