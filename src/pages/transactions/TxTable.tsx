import { Paperclip, Link2, Pencil, Receipt, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { fmtDate, fmtRp } from '@/api/client'
import { pageWindow, rangeLabel } from '@/lib/pagination'
import Spinner from '@/components/Spinner'
import TableShell from '@/components/TableShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSort } from '@/lib/useSort'
import type { Account, Transaction, UnitUsaha, User } from '@/types'
import { can } from '@/config/roles'

interface Props {
  rows: Transaction[]
  loading: boolean
  activeGroup: string
  periodLabel: string
  total: number
  offset: number
  limit: number
  hasMore: boolean
  onPageChange: (offset: number) => void
  units: UnitUsaha[]
  accounts: Account[]
  user: User | null
  canWrite: boolean
  canBulkDelete: boolean
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => void
  onUploadProof: (tx: Transaction) => void
  onDeleteProof: (tx: Transaction, fileId: string, fileName: string) => void
}

export default function TxTable({
  rows,
  loading,
  activeGroup,
  periodLabel,
  total,
  offset,
  limit,
  hasMore,
  onPageChange,
  units,
  accounts,
  user,
  canWrite,
  canBulkDelete,
  selected,
  setSelected,
  onEdit,
  onDelete,
  onUploadProof,
  onDeleteProof,
}: Props) {
  const sortState = useSort(rows as unknown as Record<string, unknown>[], 'date', 'desc')
  const sorted = sortState.sorted as unknown as Transaction[]

  const [inventoryLabels, setInventoryLabels] = useState<Record<string, {description:string; document_id:string|null; document_number:string|null}>>({})
  const inventoryReferences = rows.filter(t => t.reference?.startsWith('stock-') || t.reference?.startsWith('purchase-pay:') || t.reference?.startsWith('sale-pay:')).map(t => t.reference).join('|')
  useEffect(() => {
    if(!inventoryReferences || (user?.role === 'pengelola' && !units.some(u => u.id === user.unit_usaha_id && u.code === 'UU05'))) { setInventoryLabels({}); return }
    let current = true
    api.post('/v1/uu05_inventory/documents/transaction-links', { references:inventoryReferences.split('|') }).then(r => { if(current) setInventoryLabels(r.data) }).catch(() => { if(current) setInventoryLabels({}) })
    return () => { current = false }
  },[inventoryReferences,user?.role,user?.unit_usaha_id,units])

  const unitOf = (id: string | null) => units.find((u) => u.id === id)
  const accName = (c: string) => accounts.find((a) => a.code === c)?.name || c
  const isPengelola = user?.role === 'pengelola'
  const canManageProofs = (tx: Transaction) => {
    if (!canWrite) return false
    if (isPengelola) return tx.unit_usaha_id === user?.unit_usaha_id
    return true
  }

  const canEditRow = (tx: Transaction) => canManageProofs(tx) && !tx.reference?.startsWith('YIELD:')

  const selectable = sorted.filter(tx => !tx.reference?.startsWith('YIELD:'))
  const toggleSel = (id: string) => {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setSelected(n)
  }

  const { page, pageCount, prevOffset, nextOffset, canPrev, canNext } = pageWindow(
    total,
    limit,
    offset,
  )

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="space-y-0.5 border-b bg-primary/10 p-4">
        <CardTitle className="font-heading text-base font-semibold" data-testid="tx-table-title">
          Transaksi {activeGroup === 'BUMDES' ? 'BUMDes' : activeGroup} — {periodLabel}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {total} transaksi · halaman {page}/{pageCount}. Edit/hapus transaksi Imbal Hasil melalui menu Imbal Hasil. Bukti opsional dapat diunggah atau dihapus dengan tombol X di sini.
        </p>
      </CardHeader>
      <TableShell minWidth={720} data-testid="tx-table">
        <Table data-testid="tx-table">
          <TableHeader>
            <TableRow>
              {canBulkDelete && (
                <TableHead style={{ width: 32 }}>
                  <Checkbox
                    data-testid="tx-select-all"
                    checked={selectable.length > 0 && selectable.every((r) => selected.has(r.id))}
                    onCheckedChange={(checked) => {
                      if (checked) setSelected(new Set(selectable.map((r) => r.id)))
                      else setSelected(new Set())
                    }}
                  />
                </TableHead>
              )}
              <TableHead {...sortState.headerProps('date')}>
                Tanggal{sortState.sortIndicator('date')}
              </TableHead>
              {activeGroup !== 'BUMDES' && <TableHead>Unit</TableHead>}
              <TableHead {...sortState.headerProps('description')}>
                Keterangan{sortState.sortIndicator('description')}
              </TableHead>
              <TableHead {...sortState.headerProps('debit_account_code')}>
                Debit{sortState.sortIndicator('debit_account_code')}
              </TableHead>
              <TableHead {...sortState.headerProps('credit_account_code')}>
                Kredit{sortState.sortIndicator('credit_account_code')}
              </TableHead>
              <TableHead
                {...sortState.headerProps('amount')}
                className={`text-right ${sortState.headerProps('amount').className}`}
              >
                Jumlah{sortState.sortIndicator('amount')}
              </TableHead>
              <TableHead>Bukti</TableHead>
              {canWrite && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={99} className="py-6 text-center">
                  <Spinner className="justify-center" />
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={99} className="py-10 text-center">
                  <Receipt className="mx-auto mb-2 size-8 text-muted-foreground" />
                  <div className="text-muted-foreground">
                    Belum ada transaksi <b>{activeGroup}</b> pada <b>{periodLabel}</b>.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((t) => {
                const proofs = t.proofs || []
                const editable = canEditRow(t)
                const manageProofs = canManageProofs(t)
                return (
                  <TableRow key={t.id}>
                    {canBulkDelete && (
                      <TableCell>
                        <Checkbox
                          data-testid={`sel-tx-${t.id}`}
                          disabled={t.reference?.startsWith('YIELD:')}
                          checked={selected.has(t.id)}
                          onCheckedChange={() => toggleSel(t.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>{fmtDate(t.date)}</TableCell>
                    {activeGroup !== 'BUMDES' && (
                      <TableCell>
                        <Badge variant="secondary">{unitOf(t.unit_usaha_id)?.code}</Badge>
                      </TableCell>
                    )}
                    <TableCell className="min-w-56 max-w-sm whitespace-normal break-words">
                      {inventoryLabels[t.reference]?.description || t.description}
                      {inventoryLabels[t.reference]?.document_id && <Link className="mt-1 block text-xs text-primary underline" to={`/inventory?document=${inventoryLabels[t.reference].document_id}`}>{inventoryLabels[t.reference].document_number}</Link>}
                    </TableCell>
                    <TableCell className="text-xs">{accName(t.debit_account_code)}</TableCell>
                    <TableCell className="text-xs">{accName(t.credit_account_code)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtRp(t.amount)}
                    </TableCell>
                    <TableCell>
                      {proofs.length === 0 ? (
                        manageProofs ? (
                          <button
                            type="button"
                            data-testid={`upload-proof-${t.id}`}
                            onClick={() => onUploadProof(t)}
                            className="flex items-center gap-1 text-xs text-muted-foreground"
                          >
                            <Paperclip className="size-3.5" /> Upload
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )
                      ) : (
                        <div className="flex flex-col gap-1">
                          {proofs.map((p) => (
                            <div key={p.file_id} className="flex items-center gap-1.5">
                              <a
                                href={p.url || '#'}
                                target="_blank"
                                rel="noreferrer"
                                data-testid={`view-proof-${t.id}-${p.file_id}`}
                                className="flex max-w-[180px] items-center gap-1 truncate text-xs text-primary underline"
                                title={p.file_name}
                              >
                                <Link2 className="size-3.5" /> {p.file_name}
                              </a>
                              {manageProofs && (
                                <button
                                  type="button"
                                  data-testid={`del-proof-${t.id}-${p.file_id}`}
                                  onClick={() =>
                                    onDeleteProof(t, p.file_id, p.file_name || p.file_id)
                                  }
                                  title="Hapus bukti dari Google Drive"
                                  aria-label={`Hapus bukti ${p.file_name || p.file_id} dari Google Drive`}
                                  className="rounded p-1 hover:bg-red-50"
                                >
                                  <X className="size-3 text-destructive" />
                                </button>
                              )}
                            </div>
                          ))}
                          {manageProofs && proofs.length < 3 && (
                            <button
                              type="button"
                              data-testid={`add-proof-${t.id}`}
                              onClick={() => onUploadProof(t)}
                              className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
                            >
                              <Paperclip className="size-3" /> Tambah ({proofs.length}/3)
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex gap-1">
                          {editable && (
                            <Button
                              data-testid={`edit-tx-${t.id}`}
                              onClick={() => onEdit(t)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {!t.reference?.startsWith('YIELD:') && can(user, 'admin', 'direktur', 'bendahara') && (
                            <Button
                              data-testid={`del-tx-${t.id}`}
                              onClick={() => onDelete(t.id)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableShell>
      {total > limit && (
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!canPrev || loading}
            onClick={() => onPageChange(prevOffset)}
            data-testid="tx-prev-page"
          >
            Sebelumnya
          </Button>
          <span className="text-xs text-muted-foreground">
            {rangeLabel(total, limit, offset)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!(hasMore || canNext) || loading}
            onClick={() => onPageChange(nextOffset)}
            data-testid="tx-next-page"
          >
            Berikutnya
          </Button>
        </div>
      )}
    </Card>
  )
}
