import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { fmtRp } from '@/api/client'
import TableShell from '@/components/TableShell'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import HelpHint from '@/components/HelpHint'
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from 'lucide-react'
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
  sub,
  hint,
  onClick,
  cta,
  testId,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  hint?: ReactNode
  onClick?: () => void
  cta?: string
  testId?: string
}) {
  const clickable = Boolean(onClick)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }
  return (
    <Card
      className={`h-full${clickable ? ' cursor-pointer border-primary/40 transition hover:border-primary hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : ''}`}
      data-testid={testId ?? 'inventory-stat'}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Buka ${label}` : undefined}
      onClick={onClick}
      onKeyDown={clickable ? onKeyDown : undefined}
    >
      <CardContent className="flex h-full flex-col p-4 lg:p-3">
        <div className="flex min-h-7 items-center gap-1">
          <p className="label truncate text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
          {hint ? (
            <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <HelpHint label={`Info ${label}`}>{hint}</HelpHint>
            </span>
          ) : null}
        </div>
        <p className="font-heading mt-1 truncate text-xl font-bold tabular-nums sm:text-2xl lg:text-lg">{value}</p>
        <p className="mt-auto truncate pt-1 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {sub ?? '\u00a0'}
        </p>
        {clickable && cta ? (
          <span className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm lg:py-1 lg:text-xs font-semibold text-primary-foreground shadow-sm">
            <Plus className="size-4" aria-hidden />
            {cta}
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}

type RekapRow = { key: string; sku: string; name: string; qty: number; value: number; count: number }

function rekapBy(movements: InventoryMovement[], direction: 'in' | 'out', keep: (m: InventoryMovement) => boolean = () => true): RekapRow[] {
  const map = new Map<string, RekapRow>()
  for (const m of movements) {
    if (m.direction !== direction || m.finance_status === 'cancelled' || !keep(m)) continue
    const key = String(m.product_id || m.sku || m.id)
    const r = map.get(key) ?? { key, sku: m.sku || '-', name: m.product_name || '-', qty: 0, value: 0, count: 0 }
    r.qty += num(m.quantity)
    r.value += num(direction === 'out' && m.sale_value != null ? m.sale_value : m.total_value)
    r.count += 1
    map.set(key, r)
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}

function RekapTable({ title, hint, rows, empty, testId }: { title: string; hint: string; rows: RekapRow[]; empty: string; testId: string }) {
  const tot = rows.reduce((s, r) => ({ qty: s.qty + r.qty, value: s.value + r.value, count: s.count + r.count }), { qty: 0, value: 0, count: 0 })
  return (
    <Card className="overflow-hidden p-0" data-testid={testId}>
      <div className="p-4 pb-2">
        <h3 className="font-heading flex items-center gap-1 text-lg font-semibold">
          {title}
          <HelpHint>{hint}</HelpHint>
        </h3>
        <p className="font-heading mt-1 text-xl font-bold tabular-nums" data-testid={`${testId}-total`}>{fmtRp(tot.value)}</p>
        <p className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {tot.qty.toLocaleString('id-ID')} unit · {tot.count} trx · {rows.length} SKU
        </p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <TableShell minWidth={560}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nama Produk</TableHead>
                <TableHead className="num">Trx</TableHead>
                <TableHead className="num">Qty</TableHead>
                <TableHead className="num">Nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{empty}</TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium whitespace-nowrap">{r.sku}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="num">{r.count}</TableCell>
                    <TableCell className="num">{r.qty.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="num whitespace-nowrap">{fmtRp(r.value)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableShell>
      </div>
    </Card>
  )
}

interface InventorySummaryProps {
  products?: InventoryProduct[]
  movements?: InventoryMovement[]
  valuation?: InventoryValuation | null
  movementReport?: InventoryMovementReport | null
  onOpenTab?: (tab: 'stock-in' | 'stock-out') => void
}

/**
 * Inventory Summary dashboard — KPI, tabel.
 */
export default function InventorySummary({
  products = [],
  movements = [],
  valuation = null,
  movementReport = null,
  onOpenTab,
}: InventorySummaryProps) {
  const skuCount = valuation?.summary?.sku_count ?? products.length
  const totalQty =
    valuation?.summary?.total_qty ??
    products.reduce((s, p) => s + Number(p.qty_on_hand || 0), 0)
  const totalValue = Number(
    valuation?.summary?.total_value ??
      products.reduce((s, p) => s + Number(p.stock_value || 0), 0),
  )

  const lowStockCount = useMemo(
    () => products.filter((p) => Number(p.qty_on_hand || 0) <= 5).length,
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

  const isModalAwal = (m: InventoryMovement) => m.payment_method === 'modal_awal'
  const rekapIn = useMemo(() => rekapBy(movements, 'in', (m) => !isModalAwal(m)), [movements])
  const rekapModal = useMemo(() => rekapBy(movements, 'in', isModalAwal), [movements])
  const rekapOut = useMemo(() => rekapBy(movements, 'out'), [movements])

  const outQty = movementReport?.stock_out?.qty ?? 0
  const inQty = movementReport?.stock_in?.qty ?? 0

  return (
    <div className="space-y-6" data-testid="inventory-summary">
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6 lg:gap-3" data-testid="inventory-stats">
        <Stat label="SKU aktif" value={skuCount} sub="produk" hint="Jumlah produk di katalog." />
        <Stat label="Total stok" value={totalQty} sub="unit" hint="Qty on hand seluruh SKU." />
        <Stat label="Nilai persediaan" value={fmtRp(totalValue)} sub="Qty × HPP" hint="Qty × HPP seluruh SKU." />
        <Stat label="Stok tipis" value={lowStockCount} sub="SKU" hint="SKU dengan qty ≤ 5." />
        <Stat
          label="Stock in"
          value={`${inQty} unit`}
          sub={`${fmtRp(Number(movementReport?.stock_in?.value || 0))} · ${movementReport?.stock_in?.count ?? 0} trx`}
          hint="Barang masuk pada periode laporan yang dipilih. Ketuk kartu untuk input Stock In."
          onClick={onOpenTab ? () => onOpenTab('stock-in') : undefined}
          cta="Input Stock In"
          testId={onOpenTab ? 'shortcut-stock-in' : undefined}
        />
        <Stat
          label="Stock out"
          value={`${outQty} unit`}
          sub={`${fmtRp(Number(movementReport?.stock_out?.sale_value ?? movementReport?.stock_out?.value ?? 0))} · ${movementReport?.stock_out?.count ?? 0} trx`}
          hint="Barang keluar pada periode laporan yang dipilih. Ketuk kartu untuk input Stock Out."
          onClick={onOpenTab ? () => onOpenTab('stock-out') : undefined}
          cta="Input Stock Out"
          testId={onOpenTab ? 'shortcut-stock-out' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <RekapTable
          title="Rekap Pembelian / Stock In"
          hint="Barang masuk dari pembelian reguler (kas/utang) per SKU. Tidak termasuk Belanja Modal Awal."
          rows={rekapIn}
          empty="Belum ada stock in."
          testId="rekap-stock-in"
        />
        <RekapTable
          title="Rekap Belanja Modal Awal"
          hint="Barang masuk yang dibeli dari modal awal, per SKU."
          rows={rekapModal}
          empty="Belum ada belanja modal awal."
          testId="rekap-modal-awal"
        />
        <RekapTable
          title="Rekap Penjualan / Stock Out"
          hint="Barang keluar per SKU, nilai = harga jual (pemakaian internal pakai HPP)."
          rows={rekapOut}
          empty="Belum ada stock out."
          testId="rekap-stock-out"
        />
      </div>

      <Card className="overflow-hidden p-0" data-testid="inventory-all-sku">
        <div className="flex flex-wrap items-start gap-2 p-4 pb-2">
          <div>
            <h3 className="font-heading flex items-center gap-1 text-lg font-semibold">
              Daftar seluruh SKU
              <HelpHint>Semua produk di katalog, termasuk stok 0. Nilai persediaan = Stok × HPP.</HelpHint>
            </h3>
            <p className="font-heading mt-1 text-xl font-bold tabular-nums">{fmtRp(allSkuTotal)}</p>
            <p className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {allSku.reduce((s, r) => s + r.qty, 0).toLocaleString('id-ID')} unit · {allSku.length} SKU
            </p>
          </div>
          <Input
            type="search"
            aria-label="Cari SKU/produk/kategori"
            placeholder="Cari SKU/produk/kategori"
            className="ml-auto w-full sm:w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
        <TableShell minWidth={760}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
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
                allSku.map(({ p, qty, hpp, value }) => (
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
                ))
              )}
            </TableBody>
          </Table>
        </TableShell>
        </div>
      </Card>
    </div>
  )
}
