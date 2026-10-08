import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TxTable from './TxTable'
import type { Transaction, User } from '@/types'

const tx: Transaction = {
  id: 'yield', date: '2026-10-09', unit_usaha_id: 'u4',
  transaction_type: 'pendapatan_bagi_hasil_unit4', description: 'Pembayaran Imbal Hasil',
  amount: '30000', debit_account_code: 'cash', credit_account_code: 'income', reference: 'YIELD:p:2026:01',
}
const noop = () => {}
function markup(proofs: Transaction['proofs'], user: User, canWrite = true) {
  return renderToStaticMarkup(<TxTable rows={[{ ...tx, proofs }]} loading={false} activeGroup="UU04"
    periodLabel="Oktober" total={1} offset={0} limit={25} hasMore={false} onPageChange={noop}
    units={[]} accounts={[]} user={user} canWrite={canWrite} canBulkDelete selected={new Set()}
    setSelected={noop} onEdit={noop} onDelete={noop} onUploadProof={noop} onDeleteProof={noop} />)
}
const admin: User = { id: 'admin', username: 'admin', name: 'Admin', role: 'admin' }
describe('proof access on automatic Imbal Hasil transactions', () => {
  it('allows upload and X without exposing edit or transaction delete', () => {
    expect(markup([], admin)).toContain('upload-proof-yield')
    const html = markup([{ file_id: 'proof', file_name: 'bukti.pdf' }], admin)
    expect(html).toContain('del-proof-yield-proof')
    expect(html).toContain('add-proof-yield')
    expect(html).not.toContain('edit-tx-yield')
    expect(html).not.toContain('del-tx-yield')
  })
  it('restricts proof controls to authorized users and their assigned unit', () => {
    expect(markup([], { ...admin, role: 'pengelola', unit_usaha_id: 'u4' })).toContain('upload-proof-yield')
    expect(markup([], { ...admin, role: 'pengelola', unit_usaha_id: 'u3' })).not.toContain('upload-proof-yield')
    expect(markup([{ file_id: 'proof' }], admin, false)).not.toContain('del-proof-yield-proof')
  })
})
