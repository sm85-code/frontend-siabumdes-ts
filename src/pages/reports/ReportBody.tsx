import { fmtDate, fmtRp } from '@/api/client'
import TableShell from '@/components/TableShell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyData = Record<string, any>

export default function ReportBody({ active, data }: { active: string; data: AnyData }) {
  if (active === 'laba-rugi') {
    return (
      <TableShell minWidth={480}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama Akun</TableHead>
              <TableHead className="num">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold" style={{ background: 'var(--primary-light)' }}>
                PENDAPATAN
              </TableCell>
            </TableRow>
            {(data.pendapatan || []).map((it: AnyData) => (
              <TableRow key={it.code}>
                <TableCell>{it.code}</TableCell>
                <TableCell>{it.name}</TableCell>
                <TableCell className="num">{fmtRp(it.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell />
              <TableCell className="font-semibold">Total Pendapatan</TableCell>
              <TableCell className="num font-semibold">{fmtRp(data.total_pendapatan)}</TableCell>
            </TableRow>
            {data.has_hpp && (
              <>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold" style={{ background: 'var(--primary-light)' }}>
                    HARGA POKOK PENJUALAN
                  </TableCell>
                </TableRow>
                {(data.hpp || []).map((it: AnyData) => (
                  <TableRow key={it.code}>
                    <TableCell>{it.code}</TableCell>
                    <TableCell>{it.name}</TableCell>
                    <TableCell className="num">{fmtRp(it.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell />
                  <TableCell className="font-semibold">Total HPP</TableCell>
                  <TableCell className="num font-semibold">{fmtRp(data.total_hpp)}</TableCell>
                </TableRow>
                <TableRow style={{ background: 'var(--total-row-bg)' }}>
                  <TableCell />
                  <TableCell className="font-bold">LABA KOTOR</TableCell>
                  <TableCell className="num font-bold">{fmtRp(data.laba_kotor)}</TableCell>
                </TableRow>
              </>
            )}
            <TableRow>
              <TableCell colSpan={3} className="font-semibold" style={{ background: 'var(--primary-light)' }}>
                BEBAN
              </TableCell>
            </TableRow>
            {(data.beban || []).map((it: AnyData) => (
              <TableRow key={it.code}>
                <TableCell>{it.code}</TableCell>
                <TableCell>{it.name}</TableCell>
                <TableCell className="num">{fmtRp(it.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell />
              <TableCell className="font-semibold">Total Beban</TableCell>
              <TableCell className="num font-semibold">{fmtRp(data.total_beban)}</TableCell>
            </TableRow>
            <TableRow style={{ background: 'var(--total-row-bg)' }}>
              <TableCell />
              <TableCell className="font-bold" style={{ color: 'var(--primary-dark)' }}>
                LABA / (RUGI) BERSIH
              </TableCell>
              <TableCell className="num font-bold" style={{ color: 'var(--primary-dark)' }}>
                {fmtRp(data.laba_bersih)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableShell>
    )
  }

  if (active === 'neraca') {
    return (
      <>
        <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Per: {data.as_of}
        </p>
        <TableShell minWidth={480}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead className="num">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold" style={{ background: 'var(--primary-light)' }}>
                  ASET
                </TableCell>
              </TableRow>
              {(data.aset || []).map((it: AnyData) => (
                <TableRow key={`a-${it.code}`}>
                  <TableCell>{it.code}</TableCell>
                  <TableCell>{it.name}</TableCell>
                  <TableCell className="num">{fmtRp(it.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell />
                <TableCell className="font-semibold">Total Aset</TableCell>
                <TableCell className="num font-semibold">{fmtRp(data.total_aset)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold" style={{ background: 'var(--primary-light)' }}>
                  KEWAJIBAN
                </TableCell>
              </TableRow>
              {(data.kewajiban || []).map((it: AnyData) => (
                <TableRow key={`k-${it.code}`}>
                  <TableCell>{it.code}</TableCell>
                  <TableCell>{it.name}</TableCell>
                  <TableCell className="num">{fmtRp(it.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell />
                <TableCell className="font-semibold">Total Kewajiban</TableCell>
                <TableCell className="num font-semibold">{fmtRp(data.total_kewajiban)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold" style={{ background: 'var(--primary-light)' }}>
                  EKUITAS
                </TableCell>
              </TableRow>
              {(data.ekuitas || []).map((it: AnyData, i: number) => (
                <TableRow key={`e-${it.code}-${i}`}>
                  <TableCell>{it.code}</TableCell>
                  <TableCell>{it.name}</TableCell>
                  <TableCell className="num">{fmtRp(it.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell />
                <TableCell className="font-semibold">Total Ekuitas</TableCell>
                <TableCell className="num font-semibold">{fmtRp(data.total_ekuitas)}</TableCell>
              </TableRow>
              <TableRow style={{ background: 'var(--total-row-bg)' }}>
                <TableCell />
                <TableCell className="font-bold">TOTAL PASIVA</TableCell>
                <TableCell className="num font-bold">{fmtRp(data.total_pasiva)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableShell>
        <p
          className="mt-3 text-xs"
          style={{ color: data.balanced ? 'var(--status-success)' : 'var(--status-error)' }}
        >
          {data.balanced ? '✓ Neraca seimbang' : '⚠ Neraca belum seimbang — periksa transaksi.'}
        </p>
      </>
    )
  }

  if (active === 'arus-kas') {
    return (
      <TableShell minWidth={480}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="num">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold" style={{ background: 'var(--primary-light)' }}>
                KAS MASUK
              </TableCell>
            </TableRow>
            {(data.kas_masuk || []).map((it: AnyData, i: number) => (
              <TableRow key={`m-${it.date}-${i}`}>
                <TableCell>{it.date}</TableCell>
                <TableCell>{it.description}</TableCell>
                <TableCell className="num">{fmtRp(it.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell />
              <TableCell className="font-semibold">Total Kas Masuk</TableCell>
              <TableCell className="num font-semibold">{fmtRp(data.total_masuk)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold" style={{ background: 'var(--primary-light)' }}>
                KAS KELUAR
              </TableCell>
            </TableRow>
            {(data.kas_keluar || []).map((it: AnyData, i: number) => (
              <TableRow key={`k-${it.date}-${i}`}>
                <TableCell>{it.date}</TableCell>
                <TableCell>{it.description}</TableCell>
                <TableCell className="num">{fmtRp(it.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell />
              <TableCell className="font-semibold">Total Kas Keluar</TableCell>
              <TableCell className="num font-semibold">{fmtRp(data.total_keluar)}</TableCell>
            </TableRow>
            <TableRow style={{ background: 'var(--total-row-bg)' }}>
              <TableCell />
              <TableCell className="font-bold">ARUS KAS BERSIH</TableCell>
              <TableCell className="num font-bold">{fmtRp(data.arus_kas_bersih)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableShell>
    )
  }

  if (active === 'perubahan-ekuitas') {
    return (
      <TableShell minWidth={620}>
        <Table className="tbl-compact-mobile">
          <TableHeader>
            <TableRow>
              <TableHead>No.</TableHead>
              <TableHead>Uraian</TableHead>
              <TableHead className="num">Jumlah (Rp)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.rows || []).map((item: AnyData) =>
              item.kind === 'section' ? (
                <TableRow key={item.no} style={{ background: 'var(--total-row-bg)', fontWeight: 700 }}>
                  <TableCell>{item.no}</TableCell>
                  <TableCell
                    colSpan={2}
                    className="uppercase tracking-wide"
                    style={{ paddingLeft: 12 + (item.indent || 0) * 20 }}
                  >
                    {item.label}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow
                  key={item.no}
                  style={item.bold ? { background: 'var(--primary-light)', fontWeight: 700 } : undefined}
                >
                  <TableCell>{item.no}</TableCell>
                  <TableCell
                    className="max-w-xs"
                    style={{ paddingLeft: 12 + (item.indent || 0) * 20 }}
                  >
                    {item.label}
                  </TableCell>
                  <TableCell className="num">{fmtRp(item.amount)}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </TableShell>
    )
  }

  if (active === 'calk') {
    const INFO_LABELS: Record<string, string> = {
      nama: 'Nama Entitas',
      periode_awal: 'Periode Awal',
      periode_akhir: 'Periode Akhir',
    }
    const RINGKASAN_LABELS: Record<string, string> = {
      total_pendapatan: 'Total Pendapatan',
      total_beban: 'Total Beban',
      laba_bersih: 'Laba Bersih',
      total_aset: 'Total Aset',
      total_kewajiban: 'Total Kewajiban',
      total_ekuitas: 'Total Ekuitas',
      arus_kas_bersih: 'Arus Kas Bersih',
    }
    const titleCase = (s: string) =>
      s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const fmtInfoValue = (k: string, v: unknown) =>
      k === 'periode_awal' || k === 'periode_akhir' ? fmtDate(String(v)) : String(v ?? '')
    return (
      <div className="space-y-8">
        <p className="text-sm text-muted-foreground sm:text-base">
          Catatan ini menjelaskan informasi umum entitas, ringkasan kinerja keuangan, dan kebijakan
          akuntansi yang diterapkan pada penyusunan laporan keuangan periode berjalan.
        </p>
        <section>
          <h4 className="font-heading text-lg font-semibold">1. Informasi Umum</h4>
          <div className="mt-3 max-w-3xl">
            <TableShell minWidth={320}>
              <Table>
                <TableBody>
                  {Object.entries(data.informasi_umum || {}).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell style={{ width: '45%', color: 'var(--text-secondary)' }}>
                        {INFO_LABELS[k] || titleCase(k)}
                      </TableCell>
                      <TableCell className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fmtInfoValue(k, v)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          </div>
        </section>
        <section>
          <h4 className="font-heading text-lg font-semibold">2. Ringkasan Kinerja</h4>
          <div className="mt.3 max-w-3xl mt-3">
            <TableShell minWidth={320}>
              <Table>
                <TableBody>
                  {Object.entries(data.ringkasan_kinerja || {}).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell style={{ color: 'var(--text-secondary)' }}>
                        {RINGKASAN_LABELS[k] || titleCase(k)}
                      </TableCell>
                      <TableCell className="num font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fmtRp(Number(v))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          </div>
        </section>
        <section>
          <h4 className="font-heading text-lg font-semibold">3. Kebijakan Akuntansi</h4>
          <div className="max-w-3xl">
            {(data.kebijakan_akuntansi || []).map((k: string, i: number) => (
              <p key={i} className="mt-2 text-justify text-sm" style={{ color: 'var(--text-primary)' }}>
                {k}
              </p>
            ))}
          </div>
        </section>
      </div>
    )
  }

  return null
}
