import { useEffect, useState } from 'react'
import api from '@/api/client'
import { Input } from '@/components/ui/input'

export type DocNumberKind = 'po' | 'invoice' | 'ma' | 'int'

interface Props {
  id: string
  kind: DocNumberKind
  /** Wajib untuk po/invoice; diabaikan untuk ma/int. */
  partnerId?: string
  date: string
}

/** No. Nota (otomatis): perkiraan nomor berikutnya, tidak memesan nomor. Nomor final diberikan saat simpan. */
export default function DocNumberPreview({ id, kind, partnerId, date }: Props) {
  const needsPartner = kind === 'po' || kind === 'invoice'
  const ready = Boolean(date) && (!needsPartner || Boolean(partnerId))
  const [preview, setPreview] = useState('')

  useEffect(() => {
    if (!ready) return
    let alive = true
    api
      .get('/v1/uu05_inventory/doc-number-preview', {
        params: { kind, movement_date: date, partner_id: needsPartner ? partnerId : undefined },
      })
      .then((r) => alive && setPreview(String(r.data?.doc_number ?? '')))
      .catch(() => alive && setPreview(''))
    return () => {
      alive = false
    }
  }, [ready, kind, date, partnerId, needsPartner])

  const value = ready ? preview : ''
  return (
    <div>
      <label className="label" htmlFor={id}>
        No. Nota (otomatis)
      </label>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        value={value}
        placeholder={ready ? 'Menghitung…' : needsPartner ? 'Pilih mitra & tanggal' : 'Pilih tanggal'}
        data-testid="doc-number-preview"
      />
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        Perkiraan; nomor final diberikan saat disimpan.
      </p>
    </div>
  )
}
