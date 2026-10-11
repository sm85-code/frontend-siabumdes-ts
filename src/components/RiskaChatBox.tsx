import { useEffect, useState } from 'react'
import api from '@/api/client'
import { useAuth } from '@/lib/auth'

type Reply = { message: string; rows?: Record<string, string | number>[] }
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
  useEffect(() => {
    let live = true
    setEnabled(false)
    setEntries([])
    async function load() {
      try {
        const { data } = await api.get<{ enabled: boolean }>('/riska/availability')
        if (!live || !data.enabled) { if (live) setEnabled(false); return }
        const result = await api.get<Unit[]>('/riska/units')
        if (live) {
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
  if (!enabled) return null
  async function send() {
    if (!message.trim() || busy) return
    const text = message.trim()
    setMessage('')
    setBusy(true)
    setEntries(old => [...old, { role: 'user', message: text }])
    try {
      const { data } = await api.post<Reply>('/riska/chat', { message: text, unit_usaha_id: unitId || null })
      setEntries(old => [...old, { role: 'riska', ...data }])
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (status === 403) setEnabled(false)
      setEntries(old => [...old, { role: 'riska', message: 'Permintaan tidak dapat diproses. Periksa akses dan coba lagi.' }])
    } finally { setBusy(false) }
  }
  return <aside className="fixed bottom-20 right-4 z-50 max-w-[calc(100vw-2rem)] sm:bottom-4" aria-label="Asisten Riska">
    {open && <section className="mb-2 flex w-96 max-w-full flex-col rounded-xl border bg-background p-3 shadow-xl">
      <h2 className="font-semibold">💻 Riska (SIABUMDES)</h2>
      <p className="text-xs text-muted-foreground">Saldo kas dan laba rugi bulan berjalan. Pembukuan per entitas.</p>
      <label className="my-2 text-sm">Entitas
        <select className="ml-2 max-w-full rounded border bg-background p-1" value={unitId}
          onChange={e => { setUnitId(e.target.value); setEntries([]) }} disabled={busy || user?.role === 'pengelola'}>
          {user?.role !== 'pengelola' && <option value="">BUMDES Pusat</option>}
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      <div className="max-h-80 space-y-2 overflow-auto" role="log" aria-live="polite">
        {entries.map((entry, i) => <div key={i} className={`rounded-lg p-2 text-sm ${entry.role === 'user' ? 'ml-8 bg-blue-600 text-white' : 'mr-4 bg-gray-100 text-gray-900'}`}>
          {entry.role === 'riska' && <strong className="block">💻 Riska (SIABUMDES)</strong>}
          <p>{entry.message}</p>
          {!!entry.rows?.length && <div className="overflow-auto"><table className="mt-2 w-full border-collapse">
            <thead><tr>{Object.keys(entry.rows[0]).map(k => <th className="border p-1 text-left" key={k}>{k}</th>)}</tr></thead>
            <tbody>{entry.rows.map((row, j) => <tr key={j}>{Object.entries(row).map(([k, v]) => <td className="border p-1" key={k}>
              {['amount', 'saldo'].includes(k) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(v)) : String(v)}
            </td>)}</tr>)}</tbody>
          </table></div>}
        </div>)}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); void send() }}>
        <input aria-label="Pesan untuk Riska" className="min-w-0 flex-1 rounded border bg-background p-2" maxLength={1000}
          value={message} onChange={e => setMessage(e.target.value)} disabled={busy} />
        <button className="rounded bg-blue-600 px-3 text-white" disabled={busy || !message.trim()}>{busy ? '…' : 'Kirim'}</button>
      </form>
    </section>}
    <button className="float-right rounded-full bg-blue-600 px-4 py-3 text-white shadow-lg" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? 'Tutup Riska' : '💻 Riska'}
    </button>
  </aside>
}
