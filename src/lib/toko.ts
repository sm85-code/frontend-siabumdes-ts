import { parseMoney } from '@/lib/money'

export type TokoJenis = 'pemasukan' | 'pengeluaran'
export const WEEKS = [1, 2, 3, 4, 5] as const
export type TokoItem = { id: string; name: string; jenis: TokoJenis; keterangan: string; position: number; has_entries?: boolean }
export type TokoEntry = { id: string; item_id: string; period: string; week: number; tanggal: string; nominal: string }

export type TxRow = {
  key: string
  item: TokoItem | null
  uraian: string | null
  w1: number | null
  w2: number | null
  w3: number | null
  w4: number | null
  w5: number | null
  jumlah: number | null
  entries: Record<number, TokoEntry | undefined>
  [k: string]: unknown
}

/** Tabel Pemasukan/Pengeluaran: max(5, jumlah item Data berjenis tsb) baris. */
export const DEFAULT_TX_ROWS = 5
export const DEFAULT_DATA_ROWS = 5

export function currentPeriod(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Jumlah minggu periode (Senin–Sabtu) = jumlah Senin di bulan itu (4 atau 5). */
export function weekCount(period: string): number {
  const [y, m] = period.split('-').map(Number)
  const firstMonday = 1 + ((8 - new Date(y, m - 1, 1).getDay()) % 7)
  return Math.min(WEEKS.length, Math.floor((new Date(y, m, 0).getDate() - firstMonday) / 7) + 1)
}

/** True bila periode punya Minggu ke-5 (Senin ke-5 masih di bulan periode). */
export function week5HasSaturday(period: string): boolean {
  return weekCount(period) >= 5
}

/** Minggu ke-N yang tidak ada di periode (mis. Minggu ke-5 Okt 2026). */
export function isFreeWeek(period: string, week: number): boolean {
  return week > weekCount(period)
}

/** Senin minggu ke-N (YYYY-MM-DD). */
export function weekStart(period: string, w: number): string {
  const [y, m, d] = weekEnd(period, w).split('-').map(Number)
  return ymd(new Date(y, m - 1, d - 6))
}

/** Default tanggal popup: Sabtu minggu ke-N (Senin–Sabtu); minggu yang tidak ada -> Sabtu minggu terakhir. */
export function defaultWeekDate(period: string, week: number): string {
  const [y, m, d] = weekEnd(period, Math.min(week, weekCount(period))).split('-').map(Number)
  return ymd(new Date(y, m - 1, d - 1))
}

/** Tanggal harus di dalam Senin–Minggu minggu ke-N periode (null = valid). */
export function validateEntryDate(period: string, week: number, tanggal: string): string | null {
  if (isFreeWeek(period, week)) return `Periode ${period} hanya punya ${weekCount(period)} minggu (Senin–Sabtu).`
  const start = weekStart(period, week)
  const end = weekEnd(period, week)
  if (tanggal < start || tanggal > end) return `Tanggal Minggu ke-${week} harus antara ${start} dan ${end} (Senin–Sabtu, hari Minggu ikut).`
  return null
}

/**
 * Baris Catatan Toko untuk Laba Rugi, dikelompokkan menurut TANGGAL isian (minggu Senin–Sabtu),
 * bukan nomor minggu yang tersimpan — benar walau isian lama masih bernomor minggu lama.
 * entries boleh berisi isian periode ini dan periode berikutnya (1–4 Okt ikut Minggu ke-4 Sep).
 */
export function buildTxRowsByDate(items: TokoItem[], entries: TokoEntry[], jenis: TokoJenis, period: string): TxRow[] {
  return items
    .filter((it) => it.jenis === jenis)
    .map((it) => {
      const row: TxRow = { ...emptyTxRow(it.id), item: it, uraian: it.name }
      for (const e of entries) {
        if (e.item_id !== it.id) continue
        const w = tradeWeek(period, new Date(`${e.tanggal}T00:00:00`))
        if (!w) continue
        const k = `w${w}` as 'w1'
        const v = parseMoney(e.nominal)
        row[k] = (row[k] ?? 0) + v
        row.jumlah = (row.jumlah ?? 0) + v
      }
      return row
    })
}

/** Baris tabel transaksi dari item berjenis tertentu (data asli saja, tanpa baris kosong). */
export function buildTxRows(items: TokoItem[], entries: TokoEntry[], jenis: TokoJenis): TxRow[] {
  return items
    .filter((it) => it.jenis === jenis)
    .map((it) => {
      const byWeek: Record<number, TokoEntry | undefined> = {}
      for (const e of entries) if (e.item_id === it.id) byWeek[e.week] = e
      const vals = WEEKS.map((w) => (byWeek[w] ? parseMoney(byWeek[w]!.nominal) : null))
      const filled = vals.filter((v): v is number => v != null)
      return {
        key: it.id,
        item: it,
        uraian: it.name,
        w1: vals[0], w2: vals[1], w3: vals[2], w4: vals[3], w5: vals[4],
        jumlah: filled.length ? filled.reduce((a, b) => a + b, 0) : null,
        entries: byWeek,
      }
    })
}

export function emptyTxRow(key: string): TxRow {
  return { key, item: null, uraian: null, w1: null, w2: null, w3: null, w4: null, w5: null, jumlah: null, entries: {} }
}

/** Jumlah vertikal per kolom Minggu + total Jumlah. */
export function txTotals(rows: TxRow[]) {
  const sum = (k: 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'jumlah') => rows.reduce((a, r) => a + (r[k] ?? 0), 0)
  return { w1: sum('w1'), w2: sum('w2'), w3: sum('w3'), w4: sum('w4'), w5: sum('w5'), jumlah: sum('jumlah') }
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n)
}

export type TradeRecord = { id: string; name: string | null; total_amount: string; created_at: string | null; transaction_date?: string | null }

/** Minggu ke-n periode: Senin–Sabtu mulai Senin pertama bulan (Minggu ikut minggu sebelumnya).
 * Hari sebelum Senin pertama (mis. 1–4 Okt 2026) -> null; ikut minggu terakhir periode sebelumnya. */
export function tradeWeek(period: string, d: Date): number | null {
  const [y, m] = period.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  first.setDate(1 + ((8 - first.getDay()) % 7))
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((day.getTime() - first.getTime()) / 86400000)
  if (diff < 0) return null
  const w = Math.floor(diff / 7) + 1
  // Sesudah minggu terakhir periode (mis. Senin pertama bulan berikutnya) bukan milik periode ini.
  return w <= weekCount(period) ? w : null
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Akhir minggu ke-w (hari Minggu, karena transaksi Minggu ikut minggu sebelumnya). */
export function weekEnd(period: string, w: number): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  d.setDate(1 + ((8 - d.getDay()) % 7) + (w - 1) * 7 + 6)
  return ymd(d)
}

/**
 * Tanggal posisi kartu nilai persediaan untuk bulan terpilih.
 * Mingguan: akhir minggu (Senin–Sabtu, Minggu ikut) yang memuat hari ini bila bulan berjalan,
 * selain itu minggu terakhir bulan itu. Bulanan: akhir bulan, atau hari ini bila bulan belum selesai.
 */
export function stockValueDates(period: string, today: Date = new Date()): { week: string; weekNo: number; weekPeriod: string; month: string } {
  const [y, m] = period.split('-').map(Number)
  const t = ymd(today)
  const monthEnd = ymd(new Date(y, m, 0))
  const month = monthEnd < t ? monthEnd : t
  const lastWeek = weekCount
  let weekPeriod = period
  let weekNo: number | null = month === t ? tradeWeek(period, today) : null
  if (weekNo == null && month === t) {
    // Hari sebelum Senin pertama ikut minggu terakhir bulan sebelumnya.
    const prev = new Date(y, m - 2, 1)
    weekPeriod = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    weekNo = lastWeek(weekPeriod)
  }
  if (weekNo == null) weekNo = lastWeek(period)
  return { week: weekEnd(weekPeriod, weekNo), weekNo, weekPeriod, month }
}

/** Label minggu periode, mis. "Minggu 1 : 5 - 10 Oktober 2026" (Senin–Sabtu). */
export function tradeWeekLabel(period: string, w: number): string {
  const [y, m] = period.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  start.setDate(1 + ((8 - start.getDay()) % 7) + (w - 1) * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 5)
  const mon = (d: Date) => d.toLocaleDateString('id-ID', { month: 'long' })
  const left = start.getMonth() === end.getMonth() ? `${start.getDate()}`
    : start.getFullYear() === end.getFullYear() ? `${start.getDate()} ${mon(start)}` : `${start.getDate()} ${mon(start)} ${start.getFullYear()}`
  return `Minggu ${w} : ${left} - ${end.getDate()} ${mon(end)} ${end.getFullYear()}`
}

/** Agregasi per nama (customer/pemasok) per minggu periode. */
export function buildTradeRows(records: TradeRecord[], period: string): TxRow[] {
  const map = new Map<string, TxRow>()
  for (const r of records) {
    const d = r.transaction_date ? new Date(`${r.transaction_date}T00:00:00`) : r.created_at ? new Date(r.created_at) : null
    if (!d) continue
    const w = tradeWeek(period, d)
    if (!w) continue
    const name = r.name?.trim() || '-'
    const row = map.get(name) ?? { key: name, item: null, uraian: name, w1: null, w2: null, w3: null, w4: null, w5: null, jumlah: 0, entries: {}, ids: [] as string[] }
    ;(row.ids as string[]).push(r.id)
    const byWeek = ((row.idsByWeek as Record<number, string[]> | undefined) ?? (row.idsByWeek = {})) as Record<number, string[]>
    ;(byWeek[w] ??= []).push(r.id)
    const k = `w${w}` as 'w1'
    const v = parseMoney(r.total_amount)
    row[k] = (row[k] ?? 0) + v
    row.jumlah = (row.jumlah ?? 0) + v
    map.set(name, row)
  }
  return [...map.values()].sort((a, b) => (a.uraian ?? '').localeCompare(b.uraian ?? ''))
}

/** Transaksi manual menu Transaksi (unit 5) dari GET /v1/toko/journal. */
export type JournalPos = 'kas' | 'piutang_lainnya' | 'piutang' | 'utang' | 'stok' | 'pendapatan' | 'beban' | null
export type JournalRec = {
  id: string; tanggal: string; keterangan: string; nominal: string
  jenis: 'pemasukan' | 'pengeluaran' | 'mutasi'; counted: boolean
  debit: { code: string; name: string; pos: JournalPos }; credit: { code: string; name: string; pos: JournalPos }
}

/** Baris per keterangan per minggu (Senin–Sabtu, sama dengan Catatan Gudang) untuk transaksi terpilih. */
export function buildJournalRows(recs: JournalRec[], period: string, keep: (r: JournalRec) => boolean): TxRow[] {
  return buildTradeRows(recs.filter((r) => r.counted && keep(r)).map((r) => ({
    id: r.id, name: r.keterangan || `${r.debit.name} / ${r.credit.name}`, total_amount: r.nominal, created_at: null, transaction_date: r.tanggal,
  })), period)
}

export const isPiutangUtangUsaha = (r: JournalRec) => [r.debit.pos, r.credit.pos].some((p) => p === 'piutang' || p === 'utang')

/** Rincian pergerakan Kas dari /v1/toko/gl (kas_detail, dari jurnal); kas_akhir = Kas di Neraca. */
export type KasDetail = Record<string, string>

export const KAS_LINES: [string, string, 1 | -1][] = [
  ['masuk_perduitan', 'Pemasukan Toko', 1],
  ['masuk_penjualan_tunai', 'Pemasukan Penjualan Stok', 1],
  ['masuk_pelunasan_piutang', 'Pelunasan piutang usaha', 1],
  ['masuk_pelunasan_kasbon', 'Pelunasan Kasbon', 1],
  ['masuk_transaksi', 'Menu Transaksi (debit Kas)', 1],
  ['keluar_perduitan', 'Pengeluaran Umum', -1],
  ['keluar_pembelian_modal_awal', 'Belanja Stok (Modal Awal)', -1],
  ['keluar_pembelian_reguler', 'Belanja Stok (Reguler)', -1],
  ['keluar_pembelian_tunai', 'Pembelian tunai/modal awal', -1], // data lama (/neraca)
  ['keluar_pelunasan_utang', 'Pembayaran utang usaha', -1],
  ['keluar_kasbon', 'Kasbon diberikan', -1],
  ['keluar_transaksi', 'Menu Transaksi (kredit Kas)', -1],
  // Arah kebalikan (koreksi/pembatalan) — jarang, tetap ditampilkan agar awal + mutasi = akhir.
  ['masuk_pembelian_tunai', 'Koreksi pembelian tunai', 1],
  ['masuk_pelunasan_utang', 'Koreksi pembayaran utang usaha', 1],
  ['keluar_penjualan_tunai', 'Koreksi penjualan tunai', -1],
  ['keluar_pelunasan_piutang', 'Koreksi pelunasan piutang usaha', -1],
]

const rp = (n: number) => (n < 0 ? `(Rp ${fmtNumber(Math.round(-n))})` : `Rp ${fmtNumber(Math.round(n))}`)

/** Baris teks catatan: kas awal, pos masuk (+) / keluar (−) yang tidak nol, kas akhir. */
export function kasNoteLines(detail: KasDetail, awalLabel: string, akhirLabel: string): string[] {
  const lines = [`${awalLabel}: ${rp(parseMoney(detail.kas_awal))}`]
  for (const [key, label, sign] of KAS_LINES) {
    const v = parseMoney(detail[key])
    if (v) lines.push(`${sign > 0 ? '+' : '−'} ${label}: ${rp(v)}`)
  }
  lines.push(`${akhirLabel}: ${rp(parseMoney(detail.kas_akhir))}`)
  return lines
}

/** Pembanding Neraca (saldo akun menu Transaksi) vs data operasional. */
const DIFF_ITEMS: [string, string, string][] = [
  ['stok', 'Stok Barang', 'Manajemen Gudang'],
  ['utang', 'Utang Usaha', 'sisa pembelian kredit (Manajemen Gudang)'],
]

export type Suspect = { id: string; tanggal: string; reference: string; keterangan: string; debit: string; credit: string; nominal: string }
export type DiffItem = { key: string; text: string; details: string[] }

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export function suspectLine(x: Suspect): string {
  return [fmtDate(x.tanggal), x.reference || null, x.keterangan || null, `D ${x.debit} / K ${x.credit}`, rp(parseMoney(x.nominal))]
    .filter(Boolean).join(' · ')
}

/** Catatan hanya untuk selisih ≥ Rp 1 antara Neraca (menu Transaksi) dan pembanding, beserta transaksi manual terkait. */
export function diffNoteItems(
  neraca: Record<string, string | undefined>, pembanding: Record<string, string | undefined>,
  suspects: Record<string, Suspect[]> = {},
): DiffItem[] {
  const out: DiffItem[] = []
  for (const [key, label, source] of DIFF_ITEMS) {
    if (pembanding[key] == null || neraca[key] == null) continue
    const a = parseMoney(neraca[key]), b = parseMoney(pembanding[key])
    if (Math.abs(a - b) < 1) continue
    out.push({ key, text: `${label}: menu Transaksi ${rp(a)}; ${source} ${rp(b)}; selisih ${rp(a - b)}`, details: (suspects[key] ?? []).map(suspectLine) })
  }
  return out
}

export const STOK_LINES: [string, string][] = [
  ['masuk_reguler', 'Belanja Reguler (Stock In)'],
  ['masuk_modal_awal', 'Barang masuk (Belanja Modal Awal)'],
  ['masuk_lainnya', 'Barang masuk lainnya'],
  ['keluar_penjualan', 'HPP Penjualan (Stock Out)'],
  ['keluar_internal', 'Penjualan Internal'],
  ['penyesuaian', 'Penyesuaian stok'],
  ['transaksi', 'Menu Transaksi (akun Persediaan)'],
]

/** Catatan pergerakan stok: stok awal, mutasi tidak nol (+/−), stok akhir, lalu pembanding. */
export function stokNoteLines(detail: Record<string, string>, awalLabel: string, akhirLabel: string, stokManajemen?: string,
  manajemenLabel = 'Nilai Persediaan Manajemen Gudang hari ini'): string[] {
  const lines = [`${awalLabel}: ${rp(parseMoney(detail.stok_awal))}`]
  for (const [key, label] of STOK_LINES) {
    const v = parseMoney(detail[key])
    if (v) lines.push(`${v > 0 ? '+' : '−'} ${label}: ${rp(Math.abs(v))}`)
  }
  const akhir = parseMoney(detail.stok_akhir)
  lines.push(`${akhirLabel}: ${rp(akhir)}`)
  if (detail.gl_persediaan != null) {
    const gl = parseMoney(detail.gl_persediaan)
    lines.push(`Persediaan di Laporan Keuangan: ${rp(gl)}${Math.abs(akhir - gl) >= 1 ? `; selisih ${rp(akhir - gl)}` : ' (sama)'}`)
  }
  if (stokManajemen != null) {
    const m = parseMoney(stokManajemen)
    lines.push(`${manajemenLabel}: ${rp(m)}${Math.abs(akhir - m) >= 1 ? `; selisih ${rp(akhir - m)}` : ' (sama)'}`)
  }
  return lines
}

/** Pergerakan stok dari GET /v1/uu05_inventory/movements (kolom yang dipakai saja). */
export type StockMoveRec = { id: string; sku?: string | null; product_name?: string | null; direction?: string | null; movement_kind?: string | null; quantity?: number | string | null; movement_date?: string | null }
export type SkuStockRow = { key: string; sku: string; name: string; weeks: Record<number, { in: number; out: number }>; totalIn: number; totalOut: number }

/** Qty In/Out per SKU per minggu (Senin–Sabtu, Minggu ikut) periode; urut SKU.
 * internal=false: tanpa pemakaian internal (In = stock in, Out = penjualan); internal=true: hanya pemakaian internal. */
export function buildSkuStockRows(moves: StockMoveRec[], period: string, internal = false): SkuStockRow[] {
  const map = new Map<string, SkuStockRow>()
  for (const m of moves) {
    if ((m.movement_kind === 'internal_use') !== internal) continue
    if (!m.movement_date || (m.direction !== 'in' && m.direction !== 'out')) continue
    const w = tradeWeek(period, new Date(`${m.movement_date}T00:00:00`))
    if (!w) continue
    const sku = m.sku?.trim() || '-'
    const row = map.get(sku) ?? { key: sku, sku, name: m.product_name ?? '', weeks: {}, totalIn: 0, totalOut: 0 }
    const cell = (row.weeks[w] ??= { in: 0, out: 0 })
    const qty = Number(m.quantity) || 0
    if (m.direction === 'in') { cell.in += qty; row.totalIn += qty } else { cell.out += qty; row.totalOut += qty }
    map.set(sku, row)
  }
  return [...map.values()].sort((a, b) => a.sku.localeCompare(b.sku))
}

/** Baris Laporan Arus (Kas/Stok) mingguan. */
export type FlowRow = { label: string; kind: 'saldo' | 'head' | 'detail' | 'subtotal'; w: (number | null)[]; jumlah: number | null }
/** Mutasi saldo per minggu dari kunci kumulatif ini = f × selisih; dir: blok Masuk/Keluar, 'both' dipecah per tanda. */
export type FlowLine = { key: string; label: string; f: 1 | -1; dir: 'in' | 'out' | 'both' }

export const KAS_FLOW: FlowLine[] = KAS_LINES.map(([key, label, f]) => ({ key, label, f, dir: key.startsWith('masuk_') ? 'in' : 'out' }))
/** KAS_FLOW + baris debit Kas manual per keterangan (kunci masuk_trx:<keterangan>) setelah Pelunasan Kasbon. */
export function kasFlowLines(details: (Record<string, string> | undefined)[]): FlowLine[] {
  const keys = [...new Set(details.flatMap((d) => Object.keys(d ?? {}).filter((k) => k.startsWith('masuk_trx:'))))].sort()
  const extra: FlowLine[] = keys.map((key) => ({ key, label: key.slice('masuk_trx:'.length), f: 1, dir: 'in' }))
  const at = KAS_FLOW.findIndex((l) => l.key === 'masuk_pelunasan_kasbon') + 1
  return [...KAS_FLOW.slice(0, at), ...extra, ...KAS_FLOW.slice(at)]
}

export const STOK_FLOW: FlowLine[] = STOK_LINES.map(([key, label]) => ({
  key, label, f: 1, dir: key.startsWith('masuk_') ? 'in' : key.startsWith('keluar_') ? 'out' : 'both' }))

/**
 * details[i] = rincian kumulatif s.d. akhir Minggu ke-(i+1) (saldo awal sama untuk semua minggu); undefined = minggu
 * belum berjalan. Hasil: Awal, blok Masuk (rincian + subtotal), blok Keluar (rincian + subtotal), Akhir.
 * Awal minggu = akhir minggu sebelumnya; rincian tanpa nilai tidak ditampilkan.
 */
export function weeklyFlowRows(details: (Record<string, string> | undefined)[], awalKey: string, akhirKey: string,
  names: { awal: string; masuk: string; keluar: string; akhir: string }, lines: FlowLine[]): FlowRow[] {
  const n = (d: Record<string, string> | undefined, k: string) => (d ? parseMoney(d[k]) : 0)
  const idx = details.map((d, i) => (d ? i : -1)).filter((i) => i >= 0)
  if (!idx.length) return []
  const on = (i: number) => !!details[i]
  const delta = (l: FlowLine, i: number) => l.f * (n(details[i], l.key) - (i > 0 ? n(details[i - 1], l.key) : 0))
  const block = (dir: 'in' | 'out', title: string, sub: string): FlowRow[] => {
    const rows: FlowRow[] = []
    for (const l of lines) {
      if (l.dir !== dir && l.dir !== 'both') continue
      const w = details.map((_, i) => {
        if (!on(i)) return null
        const v = delta(l, i)
        return l.dir === 'both' ? Math.max(dir === 'in' ? v : -v, 0) : dir === 'in' ? v : -v
      })
      if (!w.some((v) => v)) continue
      const label = l.dir === 'both' ? `${l.label} (${dir === 'in' ? 'tambah' : 'kurang'})` : l.label
      rows.push({ label, kind: 'detail', w, jumlah: w.reduce<number>((a, v) => a + (v ?? 0), 0) })
    }
    const w = details.map((_, i) => (on(i) ? rows.reduce((a, r) => a + (r.w[i] ?? 0), 0) : null))
    return [{ label: title, kind: 'head', w: w.map(() => null), jumlah: null }, ...rows,
      { label: sub, kind: 'subtotal', w, jumlah: rows.reduce((a, r) => a + (r.jumlah ?? 0), 0) }]
  }
  return [
    { label: names.awal, kind: 'saldo', jumlah: n(details[idx[0]], awalKey),
      w: details.map((d, i) => (d ? (i === 0 || !details[i - 1] ? n(d, awalKey) : n(details[i - 1], akhirKey)) : null)) },
    ...block('in', names.masuk, `Jumlah ${names.masuk}`),
    ...block('out', names.keluar, `Jumlah ${names.keluar}`),
    { label: names.akhir, kind: 'saldo', w: details.map((d) => (d ? n(d, akhirKey) : null)), jumlah: n(details[idx[idx.length - 1]], akhirKey) },
  ]
}
