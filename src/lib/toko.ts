import { parseMoney } from '@/lib/money'

export type TokoJenis = 'pemasukan' | 'pengeluaran'
export const WEEKS = [1, 2, 3, 4, 5] as const
export type TokoItem = { id: string; name: string; jenis: TokoJenis; keterangan: string; position: number }
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

export const DEFAULT_TX_ROWS = 10
export const DEFAULT_DATA_ROWS = 5

export function currentPeriod(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Tanggal awal minggu ke-N dalam periode (hari 1, 8, 15, 22, 29; dibatasi akhir bulan). */
export function defaultWeekDate(period: string, week: number): string {
  const [y, m] = period.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const day = Math.min(1 + (week - 1) * 7, last)
  return `${period}-${String(day).padStart(2, '0')}`
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
