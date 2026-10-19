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
  const bumdesPct = valid ? 100 - p : null
  return (
    <section className="space-y-3 border-t pt-4" data-testid="unit-bagi-hasil" aria-labelledby="bh-title">
      <h3 id="bh-title" className="text-sm font-semibold">Proporsi Bagi Hasil</h3>
      {data && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Berlaku bulan ini{data.effective.source === 'default' ? ' (default Profil BUMDes)' : ''}</p>
          <div className="mt-1.5 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium tabular-nums text-primary">Pengelola {data.effective.share_pengelola}%</span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium tabular-nums">BUMDes {data.effective.share_bumdes}%</span>
          </div>
        </div>
      )}
      {data && data.history.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Riwayat</p>
          <ul className="divide-y rounded-lg border">
            {[...data.history].reverse().map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Mulai {fmtBulan(r.effective_from)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">Pengelola {r.share_pengelola}% · BUMDes {r.share_bumdes}%</p>
                </div>
                {isAdmin && <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" disabled={busy}
                  aria-label={`Hapus proporsi mulai ${fmtBulan(r.effective_from)}`} title="Hapus" onClick={() => void remove(r)}><Trash2 className="size-4" /></Button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {isAdmin && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">Ubah proporsi</p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-1"><Label htmlFor="bh-from">Berlaku mulai</Label><Input id="bh-from" type="month" className="w-full" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <div className="space-y-1"><Label htmlFor="bh-peng">Pengelola (%)</Label><Input id="bh-peng" type="number" inputMode="decimal" min={0} max={100} step="0.01" className="w-full" value={peng} onChange={(e) => setPeng(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="bh-bumdes">BUMDes (%)</Label><Input id="bh-bumdes" readOnly tabIndex={-1} className="w-full bg-muted/50" value={bumdesPct ?? ''} placeholder="Otomatis" /></div>
            </div>
          </div>
          <Button type="button" variant="outline" className="w-full" disabled={busy || !valid} onClick={() => void save()}>Tambah Proporsi</Button>
          <p className="help-text">Hanya untuk bulan yang belum tutup buku/ditransfer; bulan sebelumnya tidak berubah.</p>
        </div>
      )}
    </section>
  )
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
function fmtBulan(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return m ? `${BULAN[m - 1]} ${y}` : ym
}
