import { Paperclip, Link2, Pencil, Receipt, Trash2, X } from 'lucide-react'
import { fmtDate, fmtRp } from '@/api/client'
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

  const unitOf = (id: string | null) => units.find((u) => u.id === id)
  const accName = (c: string) => accounts.find((a) => a.code === c)?.name || c
  const isPengelola = user?.role === 'pengelola'
  const canEditRow = (tx: Transaction) => {
    if (!canWrite) return false
    if (isPengelola) return tx.unit_usaha_id === user?.unit_usaha_id
    return true
  }

  const toggleSel = (id: string) => {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setSelected(n)
  }

  const page = Math.floor(offset / limit) + 1
  const pageCount = Math.max(1, Math.ceil(total / limit))

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="space-y-0.5 border-b bg-primary/10 p-4">
        <CardTitle className="font-heading text-base font-semibold" data-testid="tx-table-title">
          Transaksi {activeGroup} — {periodLabel}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {total} transaksi · halaman {page}/{pageCount}
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
                    checked={sorted.length > 0 && sorted.every((r) => selected.has(r.id))}
                    onCheckedChange={(checked) => {
                      if (checked) setSelected(new Set(sorted.map((r) => r.id)))
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
                return (
                  <TableRow key={t.id}>
                    {canBulkDelete && (
                      <TableCell>
                        <Checkbox
                          data-testid={`sel-tx-${t.id}`}
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
                    <TableCell className="max-w-xs truncate">{t.description}</TableCell>
                    <TableCell className="text-xs">{accName(t.debit_account_code)}</TableCell>
                    <TableCell className="text-xs">{accName(t.credit_account_code)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtRp(t.amount)}
                    </TableCell>
                    <TableCell>
                      {proofs.length === 0 ? (
                        editable ? (
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
                              {editable && (
                                <button
                                  type="button"
                                  data-testid={`del-proof-${t.id}-${p.file_id}`}
                                  onClick={() =>
                                    onDeleteProof(t, p.file_id, p.file_name || p.file_id)
                                  }
                                  title="Hapus bukti"
                                  className="rounded p-1 hover:bg-red-50"
                                >
                                  <X className="size-3 text-destructive" />
                                </button>
                              )}
                            </div>
                          ))}
                          {editable && proofs.length < 3 && (
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
                          {can(user, 'admin', 'direktur', 'bendahara') && (
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
            disabled={offset <= 0 || loading}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            data-testid="tx-prev-page"
          >
            Sebelumnya
          </Button>
          <span className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + limit, total)} dari {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore || loading}
            onClick={() => onPageChange(offset + limit)}
            data-testid="tx-next-page"
          >
            Berikutnya
          </Button>
        </div>
      )}
    </Card>
  )
}
