import { useMemo, useState, type ReactNode } from 'react'
import { fmtRp, fmtDate } from '@/api/client'
import TableShell from '@/components/TableShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import HelpHint from '@/components/HelpHint'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type {
  InventoryMovement,
  InventoryMovementReport,
  InventoryProduct,
  InventoryValuation,
} from '@/types'

type SortKey = 'sku' | 'name' | 'category' | 'qty' | 'hpp' | 'value'
const num = (v: unknown) => Number(v || 0)

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="label mb-1">{label}</p>
        <p className="font-heading text-2xl font-bold">{value}</p>
        {hint ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface InventorySummaryProps {
  products?: InventoryProduct[]
  movements?: InventoryMovement[]
  valuation?: InventoryValuation | null
  movementReport?: InventoryMovementReport | null
}

/**
 * Inventory Summary dashboard — KPI, charts, tables.
 */
export default function InventorySummary({
  products = [],
  movements = [],
  valuation = null,
  movementReport = null,
}: InventorySummaryProps) {
  const skuCount = valuation?.summary?.sku_count ?? products.length
  const totalQty =
    valuation?.summary?.total_qty ??
    products.reduce((s, p) => s + Number(p.qty_on_hand || 0), 0)
  const totalValue = Number(
    valuation?.summary?.total_value ??
      products.reduce((s, p) => s + Number(p.stock_value || 0), 0),
  )

  const lowStock = useMemo(
    () =>
      [...products]
        .filter((p) => Number(p.qty_on_hand || 0) <= 5)
        .sort((a, b) => Number(a.qty_on_hand || 0) - Number(b.qty_on_hand || 0)),
    [products],
  )

  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('sku')
  const [sortAsc, setSortAsc] = useState(true)

  const allSku = useMemo(() => {
    const term = q.trim().toLowerCase()
    const rows = products
      .map((p) => {
        const qty = num(p.qty_on_hand)
        const hpp = num(p.cost_price)
        return { p, qty, hpp, value: qty * hpp }
      })
      .filter(({ p }) =>
        !term ||
        [p.sku, p.name, p.category_name].some((x) => String(x || '').toLowerCase().includes(term)),
      )
    const get = (r: (typeof rows)[number]): string | number => {
      switch (sortKey) {
        case 'sku': return r.p.sku || ''
        case 'name': return r.p.name || ''
        case 'category': return r.p.category_name || ''
        case 'qty': return r.qty
        case 'hpp': return r.hpp
        default: return r.value
      }
    }
    rows.sort((a, b) => {
      const x = get(a), y = get(b)
      const c = typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'id', { numeric: true })
      return sortAsc ? c : -c
    })
    return rows
  }, [products, q, sortKey, sortAsc])
  const allSkuTotal = allSku.reduce((s, r) => s + r.value, 0)

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(k === 'sku' || k === 'name' || k === 'category') }
  }
  const SortHead = ({ k, label, numeric }: { k: SortKey; label: string; numeric?: boolean }) => (
    <TableHead className={numeric ? 'num' : undefined} aria-sort={sortKey === k ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort(k)}>
        {label}
        {sortKey === k ? (sortAsc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </TableHead>
  )

  const recentOut = useMemo(
    () =>
      movements
        .filter((m) => m.direction === 'out' && m.finance_status !== 'cancelled')
        .slice(0, 8),
    [movements],
  )

  const outQty = movementReport?.stock_out?.qty ?? 0
  const inQty = movementReport?.stock_in?.qty ?? 0

  return (
    <div className="space-y-6" data-testid="inventory-summary">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="SKU aktif" value={skuCount} hint="Jumlah produk di katalog" />
        <Stat label="Total stok" value={totalQty} hint="Qty on hand seluruh SKU" />
        <Stat label="Nilai persediaan" value={fmtRp(totalValue)} hint="Qty × HPP" />
        <Stat label="Stok tipis" value={lowStock.length} hint="SKU dengan qty ≤ 5" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="label mb-1">Stock in (periode laporan)</p>
            <p className="font-heading text-xl font-bold">{inQty} unit</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {fmtRp(Number(movementReport?.stock_in?.value || 0))} ·{' '}
              {movementReport?.stock_in?.count ?? 0} transaksi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="label mb-1">Stock out (periode laporan)</p>
            <p className="font-heading text-xl font-bold">{outQty} unit</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {fmtRp(Number(movementReport?.stock_out?.value || 0))} ·{' '}
              {movementReport?.stock_out?.count ?? 0} transaksi
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden p-0" data-testid="inventory-all-sku">
        <div className="flex flex-wrap items-center gap-2 p-4 pb-2">
          <h3 className="font-heading flex items-center gap-1 text-lg font-semibold">
            Daftar seluruh SKU
            <HelpHint>Semua produk di katalog, termasuk stok 0. Nilai persediaan = Stok × HPP.</HelpHint>
          </h3>
          <Input
            type="search"
            aria-label="Cari SKU/produk/kategori"
            placeholder="Cari SKU/produk/kategori"
            className="ml-auto w-full sm:w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <TableShell minWidth={760}>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="sku" label="SKU" />
                <SortHead k="name" label="Nama Produk" />
                <SortHead k="category" label="Kategori" />
                <SortHead k="qty" label="Stok" numeric />
                <SortHead k="hpp" label="HPP" numeric />
                <SortHead k="value" label="Nilai Persediaan" numeric />
              </TableRow>
            </TableHeader>
            <TableBody>
              {allSku.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    {products.length === 0 ? 'Belum ada produk.' : 'Tidak ada yang cocok.'}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {allSku.map(({ p, qty, hpp, value }) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium whitespace-nowrap">{p.sku}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.category_name || '-'}</TableCell>
                      <TableCell className={`num whitespace-nowrap ${qty === 0 ? 'text-destructive' : ''}`}>
                        {qty.toLocaleString('id-ID')} {p.unit_of_measure || ''}
                      </TableCell>
                      <TableCell className="num whitespace-nowrap">{fmtRp(hpp)}</TableCell>
                      <TableCell className="num whitespace-nowrap">{fmtRp(value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={5}>Total ({allSku.length} SKU)</TableCell>
                    <TableCell className="num whitespace-nowrap">{fmtRp(allSkuTotal)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableShell>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card className="overflow-hidden p-0">
          <div className="p-4 pb-2">
            <h3 className="font-heading text-lg font-semibold">Peringatan stok tipis</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              SKU dengan qty on hand ≤ 5
            </p>
          </div>
          <TableShell minWidth={640}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="num">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Semua stok aman (&gt; 5).
                    </TableCell>
                  </TableRow>
                ) : (
                  lowStock.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.sku}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.category_name || '-'}</Badge>
                      </TableCell>
                      <TableCell
                        className={`num ${Number(p.qty_on_hand) === 0 ? 'font-semibold text-destructive' : ''}`}
                      >
                        {p.qty_on_hand}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableShell>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="p-4 pb-2">
          <h3 className="font-heading text-lg font-semibold">Stock out terbaru</h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Mutasi keluar terakhir
          </p>
        </div>
        <TableShell minWidth={640}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead className="num">Qty</TableHead>
                <TableHead className="num">Nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOut.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Belum ada stock out.
                  </TableCell>
                </TableRow>
              ) : (
                recentOut.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{fmtDate(m.movement_date)}</TableCell>
                    <TableCell>{m.sku}</TableCell>
                    <TableCell>{m.product_name}</TableCell>
                    <TableCell className="num">{m.quantity}</TableCell>
                    <TableCell className="num">{fmtRp(Number(m.total_value || 0))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableShell>
      </Card>
    </div>
  )
}
