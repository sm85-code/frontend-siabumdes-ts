import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import api, { fmtRp } from '@/api/client'
import { useSort } from '@/lib/useSort'
import TableShell from '@/components/TableShell'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import HelpHint from '@/components/HelpHint'
import { Plus } from 'lucide-react'
import { stockValueDates } from '@/lib/toko'
import type {
  InventoryMovement,
  InventoryMovementReport,
  InventoryProduct,
  InventoryValuation,
} from '@/types'

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
  const { sorted, headerProps, sortIndicator } = useSort(rows, 'value', 'desc')
  const head = (k: string, label: string, numeric = false) => (
    <TableHead {...headerProps(k)} className={`cursor-pointer select-none whitespace-nowrap${numeric ? ' num' : ''}`}>{label}{sortIndicator(k)}</TableHead>
  )
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
                <TableHead>No.</TableHead>
                {head('sku', 'SKU')}
                {head('name', 'Nama Produk')}
                {head('count', 'Trx', true)}
                {head('qty', 'Qty', true)}
                {head('value', 'Nilai', true)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{empty}</TableCell>
                </TableRow>
              ) : (
                sorted.map((r, i) => (
                  <TableRow key={r.key}>
                    <TableCell>{i + 1}</TableCell>
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

type SisaRow = { product_id: string; sku: string; name: string; unit: string; qty: number; hpp: string | number; value: string | number }

function SisaTable({ title, hint, rows, empty, testId }: { title: string; hint: string; rows: SisaRow[]; empty: string; testId: string }) {
  const data = useMemo(() => rows.map((r) => ({ ...r, hpp: num(r.hpp), value: num(r.value) })), [rows])
  const { sorted, headerProps, sortIndicator } = useSort(data, 'value', 'desc')
  const total = data.reduce((s, r) => s + r.value, 0)
  const head = (k: string, label: string, numeric = false) => (
    <TableHead {...headerProps(k)} className={`cursor-pointer select-none whitespace-nowrap${numeric ? ' num' : ''}`}>{label}{sortIndicator(k)}</TableHead>
  )
  return (
    <Card className="overflow-hidden p-0" data-testid={testId}>
      <div className="p-4 pb-2">
        <h3 className="font-heading flex items-center gap-1 text-lg font-semibold">{title}<HelpHint>{hint}</HelpHint></h3>
        <p className="font-heading mt-1 text-xl font-bold tabular-nums" data-testid={`${testId}-total`}>{fmtRp(total)}</p>
        <p className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {data.reduce((s, r) => s + r.qty, 0).toLocaleString('id-ID')} unit · {data.length} SKU
        </p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <TableShell minWidth={640}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>No.</TableHead>
                {head('sku', 'SKU')}
                {head('name', 'Nama Produk')}
                {head('qty', 'Sisa Qty', true)}
                {head('unit', 'Satuan')}
                {head('hpp', 'HPP', true)}
                {head('value', 'Nilai', true)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{empty}</TableCell></TableRow>
              ) : sorted.map((r, i) => (
                <TableRow key={r.product_id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{r.sku}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="num">{r.qty.toLocaleString('id-ID')}</TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell className="num whitespace-nowrap">{fmtRp(r.hpp)}</TableCell>
                  <TableCell className="num whitespace-nowrap">{fmtRp(r.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </div>
    </Card>
  )
}

const LOW_STOCK = 5

function LowStockTable({ products }: { products: InventoryProduct[] }) {
  const data = useMemo(() => products
    .map((p) => ({ id: p.id, sku: p.sku || '-', name: p.name || '-', qty: num(p.qty_on_hand), unit: p.unit_of_measure || '' }))
    .filter((r) => r.qty <= LOW_STOCK), [products])
  const { sorted, headerProps, sortIndicator } = useSort(data, 'qty', 'asc')
  const head = (k: string, label: string, numeric = false) => (
    <TableHead {...headerProps(k)} className={`cursor-pointer select-none whitespace-nowrap${numeric ? ' num' : ''}`}>{label}{sortIndicator(k)}</TableHead>
  )
  return (
    <Card className="overflow-hidden p-0" data-testid="stok-tipis">
      <div className="p-4 pb-2">
        <h3 className="font-heading flex items-center gap-1 text-lg font-semibold">Stok Tipis<HelpHint>SKU dengan stok ≤ {LOW_STOCK} saat ini (tidak ikut filter bulan).</HelpHint></h3>
        <p className="font-heading mt-1 text-xl font-bold tabular-nums" data-testid="stok-tipis-total">{data.length} SKU</p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <TableShell minWidth={520}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>No.</TableHead>
                {head('sku', 'SKU')}
                {head('name', 'Nama Produk')}
                {head('qty', 'Stok', true)}
                {head('unit', 'Satuan')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>Tidak ada stok tipis.</TableCell></TableRow>
              ) : sorted.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{r.sku}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className={`num ${r.qty === 0 ? 'text-destructive' : ''}`}>{r.qty.toLocaleString('id-ID')}</TableCell>
                  <TableCell>{r.unit}</TableCell>
                </TableRow>
              ))}
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
    () => products.filter((p) => Number(p.qty_on_hand || 0) <= LOW_STOCK).length,
    [products],
  )

  const isModalAwal = (m: InventoryMovement) => m.payment_method === 'modal_awal'
  // Filter bulan: berlaku untuk kartu Stock in/out dan semua tabel di Ringkasan.
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const range = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    return { date_from: `${month}-01`, date_to: `${month}-${String(last).padStart(2, '0')}` }
  }, [month])
  // Nilai persediaan per tanggal (qty × HPP saat ini, dimundurkan ke tanggal) — sama dengan Stok di Neraca Manajemen Toko.
  const posDates = useMemo(() => stockValueDates(month), [month])
  const [posValues, setPosValues] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    let alive = true
    const params = new URLSearchParams()
    params.append('dates', posDates.week)
    params.append('dates', posDates.month)
    api.get('/v1/uu05_inventory/reports/valuation-as-of', { params })
      .then((r) => {
        if (!alive) return
        const out: Record<string, number> = {}
        for (const v of r.data?.values ?? []) out[v.date] = Number(v.value)
        setPosValues(out)
      })
      .catch(() => { if (alive) setPosValues(null) })
    return () => { alive = false }
  }, [posDates, products, movements])
  const fmtTgl = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  const monthValue = posValues?.[posDates.month] ?? totalValue
  const [moves, setMoves] = useState<InventoryMovement[] | null>(null)
  const [report, setReport] = useState<InventoryMovementReport | null>(null)
  const [sisa, setSisa] = useState<{ reguler: SisaRow[]; modal_awal: SisaRow[] } | null>(null)
  useEffect(() => {
    let alive = true
    const base = '/v1/uu05_inventory'
    api.get(`${base}/movements`, { params: { ...range, limit: 2000 } })
      .then((r) => { if (alive) setMoves(Array.isArray(r.data) ? r.data : []) })
      .catch(() => { if (alive) setMoves([]) })
    api.get(`${base}/reports/movements`, { params: range })
      .then((r) => { if (alive) setReport(r.data) })
      .catch(() => { if (alive) setReport(null) })
    api.get(`${base}/reports/remaining-by-source`, { params: { as_of: range.date_to } })
      .then((r) => { if (alive) setSisa(r.data) })
      .catch(() => { if (alive) setSisa({ reguler: [], modal_awal: [] }) })
    return () => { alive = false }
  }, [range, products, movements])
  // Pengaman: pastikan hanya mutasi bertanggal (movement_date) di bulan terpilih.
  const list = useMemo(() => (moves ?? []).filter((m) => {
    const d = String(m.movement_date ?? '').slice(0, 10)
    return d >= range.date_from && d <= range.date_to
  }), [moves, range])
  // Rekap Belanja Modal Awal: selalu seluruh riwayat (tidak ikut filter bulan).
  const [allIn, setAllIn] = useState<InventoryMovement[]>([])
  useEffect(() => {
    let alive = true
    api.get('/v1/uu05_inventory/movements', { params: { direction: 'in', limit: 2000 } })
      .then((r) => { if (alive) setAllIn(Array.isArray(r.data) ? r.data : []) })
      .catch(() => { if (alive) setAllIn([]) })
    return () => { alive = false }
  }, [products, movements])
  const rekapModal = useMemo(() => rekapBy(allIn, 'in', isModalAwal), [allIn])
  const rekapReguler = useMemo(() => rekapBy(list, 'in', (m) => !isModalAwal(m)), [list])
  const rekapOut = useMemo(() => rekapBy(list, 'out'), [list])
  const rep = report ?? movementReport
  const outQty = rep?.stock_out?.qty ?? 0
  const inQty = rep?.stock_in?.qty ?? 0

  return (
    <div className="space-y-6" data-testid="inventory-summary">
      <div className="flex items-center gap-2">
        <label htmlFor="ringkasan-bulan" className="text-sm font-medium">Bulan</label>
        <Input id="ringkasan-bulan" type="month" className="w-44" value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <HelpHint label="Tentang filter bulan">Kartu Stock in/out, Rekap Belanja Reguler, dan Rekap Penjualan mengikuti tanggal transaksi di bulan ini; Rekap Belanja Modal Awal selalu seluruh riwayat. Sisa Stok = posisi akhir bulan. Nilai persediaan = posisi akhir bulan (atau hari ini bila bulan belum selesai). Kartu SKU aktif (termasuk total stok) dan stok tipis selalu posisi saat ini.</HelpHint>
      </div>
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-3 xl:grid-cols-5" data-testid="inventory-stats">
        <Stat
          label="Stock in"
          value={`${inQty} unit`}
          sub={`${fmtRp(Number(rep?.stock_in?.value || 0))} · ${rep?.stock_in?.count ?? 0} trx`}
          hint="Barang masuk pada periode laporan yang dipilih. Ketuk kartu untuk input Stock In."
          onClick={onOpenTab ? () => onOpenTab('stock-in') : undefined}
          cta="Input Stock In"
          testId={onOpenTab ? 'shortcut-stock-in' : undefined}
        />
        <Stat
          label="Stock out"
          value={`${outQty} unit`}
          sub={`${fmtRp(Number(rep?.stock_out?.sale_value ?? rep?.stock_out?.value ?? 0))} · ${rep?.stock_out?.count ?? 0} trx`}
          hint="Barang keluar pada periode laporan yang dipilih. Ketuk kartu untuk input Stock Out."
          onClick={onOpenTab ? () => onOpenTab('stock-out') : undefined}
          cta="Input Stock Out"
          testId={onOpenTab ? 'shortcut-stock-out' : undefined}
        />
        <Stat label="SKU aktif" value={skuCount} sub={`produk · ${totalQty} unit stok`} hint="Jumlah produk di katalog dan total qty on hand seluruh SKU (posisi saat ini)." />
        <Stat label="Stok tipis" value={lowStockCount} sub="SKU" hint="SKU dengan qty ≤ 5." />
        <Stat label="Nilai persediaan" value={fmtRp(monthValue)} sub={`per ${fmtTgl(posDates.month)}`}
          hint="Qty × HPP seluruh SKU per akhir bulan terpilih, atau hari ini bila bulan belum selesai." testId="inventory-stat-nilai" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <SisaTable
          title="Sisa Stok (Belanja Modal Awal)"
          hint="Stok tersedia saat ini yang berasal dari Belanja Modal Awal. Barang keluar dihitung FIFO: memakai stok masuk terlama dulu."
          rows={sisa?.modal_awal ?? []}
          empty="Tidak ada sisa stok dari belanja modal awal."
          testId="sisa-modal-awal"
        />
        <SisaTable
          title="Sisa Stok (Belanja Reguler)"
          hint="Stok tersedia saat ini yang berasal dari pembelian reguler (kas/utang). Barang keluar dihitung FIFO: memakai stok masuk terlama dulu."
          rows={sisa?.reguler ?? []}
          empty="Tidak ada sisa stok dari belanja reguler."
          testId="sisa-reguler"
        />
        <RekapTable
          title="Rekap Belanja Modal Awal"
          hint="Seluruh riwayat barang masuk dari modal awal per SKU (tidak ikut filter bulan)."
          rows={rekapModal}
          empty="Belum ada belanja modal awal."
          testId="rekap-modal-awal"
        />
        <RekapTable
          title="Rekap Belanja Reguler"
          hint="Riwayat barang masuk dari pembelian reguler (kas/utang), per SKU. Tidak termasuk Belanja Modal Awal."
          rows={rekapReguler}
          empty="Belum ada belanja reguler."
          testId="rekap-reguler"
        />
      </div>

      <RekapTable
        title="Rekap Penjualan / Stock Out"
        hint="Barang keluar per SKU, nilai = harga jual (pemakaian internal pakai HPP)."
        rows={rekapOut}
        empty="Belum ada stock out."
        testId="rekap-stock-out"
      />
      <LowStockTable products={products} />
    </div>
  )
}
