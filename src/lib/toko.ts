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

function monthInfo(period: string) {
  const [y, m] = period.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const firstDow = new Date(y, m - 1, 1).getDay() // 0 = Minggu, 6 = Sabtu
  const firstSaturday = 1 + ((6 - firstDow + 7) % 7)
  return { last, firstSaturday }
}

/** True bila Sabtu minggu ke-5 masih jatuh di bulan periode. */
export function week5HasSaturday(period: string): boolean {
  const { last, firstSaturday } = monthInfo(period)
  return firstSaturday + 28 <= last
}

/** Minggu ke-5 tanpa Sabtu: tanggal bebas, asalkan masih dalam bulan periode. */
export function isFreeWeek(period: string, week: number): boolean {
  return week === 5 && !week5HasSaturday(period)
}

/**
 * Default tanggal popup: hari Sabtu minggu ke-N dalam periode.
 * Minggu ke-1 = tanggal 1 s.d. Sabtu pertama; minggu berikutnya Minggu–Sabtu.
 * Bila bulan tidak punya Sabtu ke-5, minggu ke-5 default ke hari setelah
 * Sabtu minggu ke-4 (atau akhir bulan bila tidak ada sisa hari).
 */
export function defaultWeekDate(period: string, week: number): string {
  const { last, firstSaturday } = monthInfo(period)
  const saturday = firstSaturday + (week - 1) * 7
  const day = saturday <= last ? saturday : Math.min(firstSaturday + 22, last)
  return `${period}-${String(day).padStart(2, '0')}`
}

/** Semua minggu: tanggal bebas asalkan dalam bulan periode (null = valid). */
export function validateEntryDate(period: string, tanggal: string): string | null {
  if (!tanggal.startsWith(`${period}-`)) return 'Tanggal transaksi harus berada dalam periode bulan yang dipilih.'
  return null
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

/** Minggu ke-n periode: Senin–Sabtu mulai Senin pertama bulan (Minggu ikut minggu sebelumnya). */
export function tradeWeek(period: string, d: Date): number | null {
  const [y, m] = period.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  first.setDate(1 + ((8 - first.getDay()) % 7))
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((day.getTime() - first.getTime()) / 86400000)
  if (diff < 0) return null
  const w = Math.floor(diff / 7) + 1
  return w <= WEEKS.length ? w : null
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

/** Baris per keterangan per minggu (Senin–Sabtu, sama dengan Perduitan #2) untuk transaksi terpilih. */
export function buildJournalRows(recs: JournalRec[], period: string, keep: (r: JournalRec) => boolean): TxRow[] {
  return buildTradeRows(recs.filter((r) => r.counted && keep(r)).map((r) => ({
    id: r.id, name: r.keterangan || `${r.debit.name} / ${r.credit.name}`, total_amount: r.nominal, created_at: null, transaction_date: r.tanggal,
  })), period)
}

export const isPiutangUtangUsaha = (r: JournalRec) => [r.debit.pos, r.credit.pos].some((p) => p === 'piutang' || p === 'utang')
