import { describe, expect, it } from 'vitest'
import { buildTxRows, defaultWeekDate, isFreeWeek, validateEntryDate, txTotals, fmtNumber, type TokoItem, type TokoEntry } from '@/lib/toko'

const items: TokoItem[] = [
  { id: 'a', name: 'Penjualan', jenis: 'pemasukan', keterangan: '', position: 1 },
  { id: 'b', name: 'Listrik', jenis: 'pengeluaran', keterangan: '', position: 2 },
  { id: 'c', name: 'Sewa', jenis: 'pemasukan', keterangan: '', position: 3 },
]
const entries: TokoEntry[] = [
  { id: '1', item_id: 'a', period: '2026-10', week: 1, tanggal: '2026-10-01', nominal: '1500000.00' },
  { id: '2', item_id: 'a', period: '2026-10', week: 3, tanggal: '2026-10-15', nominal: '500000' },
  { id: '3', item_id: 'c', period: '2026-10', week: 3, tanggal: '2026-10-16', nominal: '250000' },
  { id: '4', item_id: 'b', period: '2026-10', week: 2, tanggal: '2026-10-08', nominal: '99000' },
]

describe('manajemen toko helpers', () => {
  it('routes Data items to the table matching their jenis', () => {
    expect(buildTxRows(items, entries, 'pemasukan').map((r) => r.uraian)).toEqual(['Penjualan', 'Sewa'])
    expect(buildTxRows(items, entries, 'pengeluaran').map((r) => r.uraian)).toEqual(['Listrik'])
  })
  it('sums horizontally and vertically', () => {
    const rows = buildTxRows(items, entries, 'pemasukan')
    expect(rows[0].jumlah).toBe(2_000_000)
    expect(rows[0].w2).toBeNull()
    expect(txTotals(rows)).toMatchObject({ w1: 1_500_000, w3: 750_000, jumlah: 2_250_000 })
  })
  it('defaults to the Saturday of week N, clamped to the month', () => {
    // Oktober 2026: tgl 1 = Kamis, Sabtu pertama = 3
    expect(defaultWeekDate('2026-10', 1)).toBe('2026-10-03')
    expect(defaultWeekDate('2026-10', 2)).toBe('2026-10-10')
    expect(defaultWeekDate('2026-10', 5)).toBe('2026-10-31')
    // Agustus 2026: tgl 1 = Sabtu
    expect(defaultWeekDate('2026-08', 1)).toBe('2026-08-01')
    // Februari 2026: Sabtu 7,14,21,28 → tidak ada sisa hari → akhir bulan
    expect(defaultWeekDate('2026-02', 5)).toBe('2026-02-28')
    // November 2026: Sabtu 7,14,21,28 → minggu ke-5 default 29
    expect(defaultWeekDate('2026-11', 5)).toBe('2026-11-29')
  })
  it('week 5 without Saturday is free but must stay in the month', () => {
    expect(isFreeWeek('2026-11', 5)).toBe(true)
    expect(isFreeWeek('2026-10', 5)).toBe(false)
    expect(isFreeWeek('2026-11', 4)).toBe(false)
  })
  it('every week accepts any date in the selected month only', () => {
    expect(validateEntryDate('2026-11', '2026-11-02')).toBeNull()
    expect(validateEntryDate('2026-11', '2026-12-01')).toMatch(/periode bulan/)
    expect(validateEntryDate('2026-10', '2026-09-30')).toMatch(/periode bulan/)
  })
  it('formats with Indonesian thousands separator', () => {
    expect(fmtNumber(1500000)).toBe('1.500.000')
  })
})

describe('buildJournalRows', () => {
  it('mengelompokkan transaksi manual per minggu dan melewati yang tidak dihitung', async () => {
    const { buildJournalRows } = await import('./toko')
    const base = { debit: { code: '1', name: 'Kas', pos: 'kas' as const }, credit: { code: '2', name: 'Pendapatan', pos: 'pendapatan' as const } }
    const rows = buildJournalRows([
      { ...base, id: 'a', tanggal: '2026-10-06', keterangan: 'Sewa', nominal: '100', jenis: 'pemasukan', counted: true },
      { ...base, id: 'b', tanggal: '2026-10-07', keterangan: 'Sewa', nominal: '50', jenis: 'pemasukan', counted: true },
      { ...base, id: 'c', tanggal: '2026-10-07', keterangan: 'X', nominal: '9', jenis: 'pemasukan', counted: false },
    ], '2026-10', (r) => r.jenis === 'pemasukan')
    expect(rows).toHaveLength(1)
    expect(rows[0].w1).toBe(150)
  })
})

describe('kasNoteLines', () => {
  it('menampilkan kas awal, pos tidak nol, dan kas akhir', async () => {
    const { kasNoteLines } = await import('./toko')
    const lines = kasNoteLines({ kas_awal: '2124500', masuk_penjualan_tunai: '700000', keluar_pembelian_tunai: '3000000', masuk_perduitan: '0', kas_akhir: '-175500' }, 'Kas awal 30 Sep 2026', 'Kas akhir')
    expect(lines).toEqual(['Kas awal 30 Sep 2026: Rp 2.124.500', '+ Penjualan tunai: Rp 700.000', '− Pembelian tunai/modal awal: Rp 3.000.000', 'Kas akhir: (Rp 175.500)'])
  })
})

describe('diffNoteItems', () => {
  it('hanya pos dua sumber yang berbeda, dengan transaksi manual penyebab', async () => {
    const { diffNoteItems } = await import('./toko')
    const items = diffNoteItems({ kas: '1', stok: '9000000', utang: '0', piutang: '5' }, { kas: '9', stok: '8500000', utang: '0', piutang: '0' }, {
      stok: [{ id: 'x', tanggal: '2026-10-05', reference: 'R1', keterangan: 'Salah input', debit: '1.1.01.15 Kas', credit: '1.1.05.15 Persediaan', nominal: '500000' }],
    }, '9000000')
    expect(items.map((i) => i.text)).toEqual(['Stok Barang: Manajemen Stok Rp 9.000.000; menu Transaksi Rp 8.500.000; selisih Rp 500.000'])
    expect(items[0].details[0]).toContain('D 1.1.01.15 Kas / K 1.1.05.15 Persediaan · Rp 500.000')
  })
})
