import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import api, { getApiError } from '@/api/client'
import { notify } from '@/lib/feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ShareRow = { id: string; effective_from: string; share_pengelola: number; share_bumdes: number; created_by: string }
type ShareResp = { period: string; effective: { share_pengelola: number; share_bumdes: number; source: string }; history: ShareRow[] }

const nextMonth = () => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Proporsi bagi hasil Pengelola/BUMDes unit ini, berlaku mulai bulan tertentu (riwayat). Ubah: admin. */
export default function UnitBagiHasilSection({ unitId, isAdmin }: { unitId: string; isAdmin: boolean }) {
  const [data, setData] = useState<ShareResp | null>(null)
  const [from, setFrom] = useState(nextMonth())
  const [peng, setPeng] = useState('30')
  const [busy, setBusy] = useState(false)
  const load = async () => {
    try { setData((await api.get<ShareResp>(`/unit-usaha/${unitId}/bagi-hasil-shares`)).data) }
    catch (e) { notify(getApiError(e), { type: 'error' }) }
  }
  useEffect(() => { void load() }, [unitId]) // eslint-disable-line react-hooks/exhaustive-deps
  const p = Number(peng)
  const valid = peng.trim() !== '' && p >= 0 && p <= 100 && /^\d{4}-\d{2}$/.test(from)
  const save = async () => {
    if (!valid) return
    setBusy(true)
    try {
      await api.post(`/unit-usaha/${unitId}/bagi-hasil-shares`, { effective_from: from, share_pengelola: p, share_bumdes: 100 - p })
      notify('Proporsi bagi hasil disimpan')
      await load()
    } catch (e) { notify(getApiError(e), { type: 'error' }) } finally { setBusy(false) }
  }
  const remove = async (r: ShareRow) => {
    setBusy(true)
    try { await api.delete(`/unit-usaha/${unitId}/bagi-hasil-shares/${r.id}`); await load() }
    catch (e) { notify(getApiError(e), { type: 'error' }) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-2 border-t pt-3" data-testid="unit-bagi-hasil">
      <p className="text-sm font-semibold">Proporsi Bagi Hasil</p>
      {data && <p className="text-sm">Berlaku bulan ini: Pengelola {data.effective.share_pengelola}% · BUMDes {data.effective.share_bumdes}%
        {data.effective.source === 'default' ? ' (default Profil BUMDes)' : ''}</p>}
      {data && data.history.length > 0 && (
        <ul className="space-y-1 text-sm">
          {[...data.history].reverse().map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span className="tabular-nums">Mulai {r.effective_from}: Pengelola {r.share_pengelola}% · BUMDes {r.share_bumdes}%</span>
              {isAdmin && <Button type="button" variant="ghost" size="icon" className="size-7" disabled={busy}
                aria-label={`Hapus proporsi mulai ${r.effective_from}`} title="Hapus" onClick={() => void remove(r)}><Trash2 className="size-4" /></Button>}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && (
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <div><Label htmlFor="bh-from">Berlaku mulai</Label><Input id="bh-from" type="month" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label htmlFor="bh-peng">Pengelola (%)</Label><Input id="bh-peng" type="number" min={0} max={100} step="0.01" value={peng} onChange={(e) => setPeng(e.target.value)} /></div>
          <Button type="button" disabled={busy || !valid} onClick={() => void save()}>Simpan</Button>
          <p className="help-text col-span-3">BUMDes = {valid ? 100 - p : '–'}%. Hanya bisa mulai bulan yang belum tutup buku dan belum ditransfer bagi hasilnya; bulan sebelumnya tidak berubah.</p>
        </div>
      )}
    </div>
  )
}
