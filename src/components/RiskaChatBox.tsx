import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '@/api/client'
import { useAuth } from '@/lib/auth'

type Reply = { message: string; rows?: Record<string, string | number>[]; money_columns?: string[]; valuation?: string; draft_id?: string; preview?: { unit: string; operation: string; item: string; tanggal: string; details?: Record<string, string>; rows: Record<string, string | number>[] }; parties?: Record<string, { id: string; name: string }[]> }
type Entry = Reply & { role: 'user' | 'riska' }
type Unit = { id: string; code: string; name: string }

export default function RiskaChatBox() {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const [unitId, setUnitId] = useState('')
  const [message, setMessage] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let initial = true
    async function load() {
      try {
        const { data } = await api.get<{ enabled: boolean }>('/riska/availability')
        if (!live || !data.enabled) { if (live) setEnabled(false); return }
        const result = await api.get<Unit[]>('/riska/units')
        if (live) {
          if (initial) { setEntries([]); setPendingDraft(null); initial = false }
          setUnits(result.data)
          setUnitId(previous => user?.role === 'pengelola' ? result.data[0]?.id || '' : result.data.some(u => u.id === previous) ? previous : '')
          setEnabled(true)
        }
      } catch { if (live) setEnabled(false) }
    }
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => { live = false; window.clearInterval(timer) }
  }, [user?.id, user?.role])
  useEffect(() => {
    if (!open || !enabled || !window.matchMedia('(max-width: 639px)').matches) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open, enabled])
  if (!enabled) return null
  async function sendMessage(shortcut?: string) {
    const text = (shortcut ?? message).trim()
    if (!text || busy || pendingDraft) return
    if (!shortcut) setMessage('')
    setBusy(true)
    setEntries(old => [...old, { role: 'user', message: text }])
    try {
      const { data } = await api.post<Reply>(/^(imbal|masuk|keluar|rusak)\s/i.test(text) ? '/riska/drafts' : '/riska/chat', { message: text, unit_usaha_id: unitId || null })
      if (data.draft_id) setPendingDraft(data.draft_id)
      setEntries(old => [...old, { role: 'riska', ...data, rows: data.preview?.rows || data.rows }])
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (status === 403) setEnabled(false)
      const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      setEntries(old => [...old, { role: 'riska', message: typeof detail === 'string' ? detail : 'Permintaan tidak dapat diproses. Periksa format, akses, COA, dan stok.' }])
    } finally { setBusy(false) }
  }
  async function confirm(draftId: string, execute: boolean) {
    if (busy || pendingDraft !== draftId) return
    setBusy(true)
    try {
      const { data } = execute ? await api.post<Reply>(`/riska/drafts/${draftId}/execute`) : await api.delete<Reply>(`/riska/drafts/${draftId}`)
      setPendingDraft(null)
      setEntries(old => [...old, { role: 'riska', ...data }])
    } catch (error) {
      const response = (error as { response?: { status?: number; data?: { detail?: string } } }).response
      if (response?.status === 403) setEnabled(false)
      if (response?.status === 409) setPendingDraft(null)
      setEntries(old => [...old, { role: 'riska', message: response?.data?.detail || 'Eksekusi belum terkonfirmasi. Periksa halaman transaksi sebelum mencoba lagi.' }])
    } finally { setBusy(false) }
  }
  return createPortal(<aside className={open
    ? 'fixed inset-0 z-50 h-dvh w-full bg-white sm:inset-auto sm:bottom-4 sm:right-4 sm:h-auto sm:w-96 sm:bg-transparent'
    : 'fixed bottom-20 right-4 z-50 sm:bottom-4'} aria-label="Asisten Riska">
    {open && <section className="flex h-full min-h-0 w-full flex-col rounded-none bg-white p-3 text-gray-900 sm:h-[min(40rem,calc(100dvh-2rem))] sm:rounded-xl sm:border sm:bg-background sm:text-foreground sm:shadow-xl">
      <header className="flex shrink-0 items-center justify-between gap-2 pb-2">
        <h2 className="font-semibold">💻 Riska (SIABUMDES)</h2>
        <button type="button" className="min-h-11 rounded-lg border px-3 text-sm font-semibold" onClick={() => setOpen(false)}>Tutup Riska ✕</button>
      </header>
      <p className="text-xs text-muted-foreground">Saldo kas dan laba rugi bulan berjalan. Pembukuan per entitas.</p>
      {user?.role === 'pengelola' && <details className="max-h-32 shrink-0 overflow-y-auto text-xs"><summary>Bantuan: cara bertanya dan mencatat</summary>
        <p>Untuk melihat keuangan, boleh bertanya dengan beberapa cara:</p>
        <p>cek saldo kas</p>
        <p>berapa total pendapatan bulan ini?</p>
        <p>tampilkan laba rugi bulan berjalan</p>
        <p>Kata “berapa”, “lihat”, “tampilkan”, atau “cek” di awal boleh dipakai atau tidak. Kata “total” juga boleh ditambahkan sebelum pendapatan. Pilih unit di pemilih, bukan di dalam pesan.</p>
        <p>Untuk mencatat barang masuk atau keluar, pembayaran memakai tunai. Ketik “stok” untuk melihat SKU barang dan ID pemasok/customer. Ketik “mitra” untuk melihat ID mitra. Salin kode atau ID dari daftar itu; tidak perlu menghafalnya.</p>
        <p>Jika SKU mengandung spasi, bungkus dengan tanda kutip ganda. Contoh: produk="Daster Arab Jumbo" bisa dipakai jika SKU di daftar memang “Daster Arab Jumbo”. Nama barang saja belum dapat menggantikan SKU.</p>
        <p>Tanda kutip juga menjaga customer="Bu Hajah Ani" tetap terbaca sebagai satu nilai, tetapi sistem masih mencari ID customer. Untuk memilih Bu Hajah Ani, salin ID pada namanya dari daftar, bukan nama orangnya. Aturan yang sama berlaku untuk mitra dan pemasok.</p>
        <p>Tulis uang polos tanpa titik ribuan: nominal=300000, bukan nominal=300.000. Jika ada sen, gunakan titik desimal: harga=25000.50.</p>
        <p>Tulis kata perintah imbal, masuk, keluar, dan rusak dengan huruf kecil. Isi semua bagian seperti contoh. Ganti ID, SKU, tanggal, jumlah barang, dan nominal sesuai catatan Anda. Tanggal ditulis tahun-bulan-hari.</p>
        <p>imbal mitra=ID tanggal=2026-10-11 bulan=10 tahun=2026 nominal=300000</p>
        <p>masuk produk=SKU qty=1 harga=25000 pemasok=ID tanggal=2026-10-11</p>
        <p>keluar produk=SKU qty=1 harga=35000 customer=ID tanggal=2026-10-11</p>
        <p>rusak produk=SKU qty=1 tanggal=2026-10-11</p>
        <p>qty berarti jumlah barang. harga berarti harga satu barang. Periksa draf sebelum memilih “Ya, Eksekusi Sekarang”; jika belum benar, pilih “Batal”.</p>
      </details>}
      <label className="my-2 shrink-0 text-sm">Entitas
        <select className="ml-2 max-w-full rounded border bg-background p-1" value={unitId}
          onChange={e => { setUnitId(e.target.value); setEntries([]) }} disabled={busy || !!pendingDraft || user?.role === 'pengelola'}>
          {user?.role !== 'pengelola' && <option value="">BUMDES Pusat</option>}
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      <div className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain break-words" role="log" aria-live="polite">
        {entries.map((entry, i) => <div key={i} className={`rounded-lg p-2 text-sm ${entry.role === 'user' ? 'ml-8 bg-blue-600 text-white' : 'mr-4 bg-gray-100 text-gray-900'}`}>
          {entry.role === 'riska' && <strong className="block">💻 Riska (SIABUMDES)</strong>}
          <p>{entry.message}</p>
          {entry.preview?.details && <p>{Object.entries(entry.preview.details).map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>}
          {entry.preview && <p>{entry.preview.unit} · {entry.preview.operation} · {entry.preview.item} · {entry.preview.tanggal}</p>}
          {entry.valuation && <p className="font-bold">Valuasi: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(entry.valuation))}</p>}
          {entry.parties && Object.entries(entry.parties).map(([kind, parties]) => <details key={kind}><summary>{kind}</summary>{parties.map(p => <p key={p.id}>{p.name}: {p.id}</p>)}</details>)}
          {entry.draft_id && <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={busy || pendingDraft !== entry.draft_id} className="rounded bg-blue-600 p-2 text-white disabled:opacity-40" onClick={() => void confirm(entry.draft_id!, true)}>Ya, Eksekusi Sekarang</button>
            <button disabled={busy || pendingDraft !== entry.draft_id} className="rounded border p-2 disabled:opacity-40" onClick={() => void confirm(entry.draft_id!, false)}>Batal</button>
          </div>}
          {!!entry.rows?.length && <div className="overflow-auto"><table className="mt-2 w-full border-collapse">
            <thead><tr>{Object.keys(entry.rows[0]).map(k => <th className="border p-1 text-left" key={k}>{k}</th>)}</tr></thead>
            <tbody>{entry.rows.map((row, j) => <tr key={j} className={row.Status === 'Kritis' ? 'bg-red-100 font-semibold text-red-800' : ''}>{Object.entries(row).map(([k, v]) => <td className="border p-1" key={k}>
              {(['amount', 'saldo', ...(entry.money_columns || [])].includes(k) && Number.isFinite(Number(v))) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(v)) : String(v)}
            </td>)}</tr>)}</tbody>
          </table></div>}
        </div>)}
      </div>
      <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto pb-2" aria-label="Pintasan Riska">
        {[
          { label: '📊 Cek Laba Rugi', command: 'cek laba rugi' },
          { label: '💰 Cek Saldo Kas', command: 'cek saldo kas' },
          { label: '🏢 Performa Unit Usaha', command: 'performa' },
        ].map(shortcut => <button type="button" key={shortcut.command}
          className="min-h-11 shrink-0 whitespace-nowrap rounded-full border bg-gray-100 px-3 text-sm text-gray-900 disabled:opacity-40"
          disabled={busy || !!pendingDraft} onClick={() => void sendMessage(shortcut.command)}>{shortcut.label}</button>)}
      </div>
      <form className="flex shrink-0 gap-2 pb-[env(safe-area-inset-bottom)]" onSubmit={e => { e.preventDefault(); void sendMessage() }}>
        <input aria-label="Pesan untuk Riska" className="min-h-11 min-w-0 flex-1 rounded border bg-background p-2 text-base" maxLength={1000}
          value={message} onChange={e => setMessage(e.target.value)} disabled={busy || !!pendingDraft} />
        <button className="rounded bg-blue-600 px-3 text-white" disabled={busy || !!pendingDraft || !message.trim()}>{busy ? '…' : 'Kirim'}</button>
      </form>
    </section>}
    {!open && <button className="float-right rounded-full bg-blue-600 px-4 py-3 text-white shadow-lg" aria-expanded={open} onClick={() => setOpen(!open)}>
      💻 Riska
    </button>}
  </aside>, document.body)
}
