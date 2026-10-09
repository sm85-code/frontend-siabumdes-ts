import type { Account, Transaction, UnitUsaha } from '@/types'

/** Render known legacy automatic labels without rewriting historical journals. */
export function automaticTransactionDescription(tx: Transaction, units: UnitUsaha[], accounts: Account[]) {
  const match = tx.reference?.match(/^(CLOSE|BAGIHASIL)-(\d{4})-(\d{2})-(BUMDES|UU\d+)$/)
  if (!match || tx.description.includes(' · ')) return tx.description
  const [, kind, year, month, group] = match
  const monthNumber = Number(month)
  if (monthNumber < 1 || monthNumber > 12) return tx.description
  const period = `${year}-${month}`
  const unit = units.find(u => u.code === group)
  const entity = group === 'BUMDES' ? 'BUMDes' : `Unit ${unit?.name || group}`
  const date = `${month}/${year}`
  const label = (action: string, detail: string, range = date) => [action, entity, range, detail].join(' · ')
  const accountName = (code: string) => accounts.find(a => a.code === code)?.name
  if (kind === 'CLOSE') {
    const closing = tx.description.match(/^Tutup (pendapatan|beban\/HPP) (.+) (\d{4}-\d{2})$/)
    if (closing?.[3] === period) {
      const code = closing[2]
      const name = accountName(code)
      return label('Tutup Buku', `${closing[1] === 'pendapatan' ? 'Pendapatan' : 'Beban/HPP'} — ${name ? `${name} (${code})` : code}`)
    }
    if (tx.description === `Alokasi laba unit ${period} ke utang bagi hasil`)
      return label('Alokasi Laba', accountName(tx.credit_account_code) || 'Utang Bagi Hasil Unit')
    const allocation = tx.description.match(/^Alokasi laba (\d{4}-\d{2}) ke (.+)$/)
    if (allocation?.[1] === period) {
      const targets: Record<string, string> = { utang_bagi_hasil_bumdes: 'Utang Bagi Hasil BUMDes', bagi_hasil_desa: 'PADes', laba_dicadangkan: 'Modal BUMDes' }
      return label('Alokasi Laba', accountName(tx.credit_account_code) || targets[allocation[2]] || allocation[2].replaceAll('_', ' '))
    }
    if (tx.description === `Transfer rugi ${period} ke saldo laba/rugi`)
      return label('Pemindahan Rugi', accountName(tx.debit_account_code) || 'Saldo Laba/Rugi')
  } else {
    const payment = tx.description.match(/^Pembayaran Bagi Hasil (.+) (\d{4}-\d{2})$/)
    if (payment?.[2] === period) {
      const range = group === 'BUMDES' ? `${String(Math.floor((monthNumber - 1) / 3) * 3 + 1).padStart(2, '0')}–${month}/${year}` : date
      return label('Transfer Bagi Hasil', payment[1] === 'BUMDES' ? 'BUMDes' : payment[1], range)
    }
    if (group !== 'BUMDES' && tx.description === `Penerimaan Bagi Hasil ${group} ${period}`)
      return ['Penerimaan Bagi Hasil', 'BUMDes', date, entity].join(' · ')
  }
  return tx.description
}
