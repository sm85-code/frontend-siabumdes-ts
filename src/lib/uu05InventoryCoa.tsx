import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** COA UU05 untuk transaksi inventory. */
export const UU05_INVENTORY_COA = [
  { code: '1.1.01.15', name: 'Kas/Bank - UU05' },
  { code: '1.1.05.15', name: 'Persediaan Barang Dagangan' },
  { code: '1.1.05.51', name: 'Penyesuaian Nilai Persediaan' },
  { code: '1.1.03.15', name: 'Piutang Usaha' },
  { code: '2.1.01.15', name: 'Utang Usaha' },
  { code: '4.1.01.15', name: 'Pendapatan Usaha' },
  { code: '5.1.01.15', name: 'Harga Pokok Penjualan Barang Dagangan' },
  { code: '6.2.01.52', name: 'Beban Penjualan Barang' },
  { code: '6.2.99.52', name: 'Beban Kerugian Barang' },
]

export const KAS_ACCOUNT_CODE = '1.1.01.15'
export const PERSEDIAAN_ACCOUNT_CODE = '1.1.05.15'
export const PENYESUAIAN_NILAI_PERSEDIAAN_ACCOUNT_CODE = '1.1.05.51'
export const PIUTANG_ACCOUNT_CODE = '1.1.03.15'
export const UTANG_ACCOUNT_CODE = '2.1.01.15'
export const PENDAPATAN_ACCOUNT_CODE = '4.1.01.15'
export const HPP_ACCOUNT_CODE = '5.1.01.15'
export const BEBAN_PENJUALAN_BARANG_ACCOUNT_CODE = '6.2.01.52'
export const BEBAN_KERUGIAN_BARANG_ACCOUNT_CODE = '6.2.99.52'

export function CoaSelect({
  value,
  onChange,
  required = true,
  id,
  disabled = false,
}: {
  value?: string
  onChange: (e: { target: { value: string } }) => void
  required?: boolean
  id?: string
  disabled?: boolean
}) {
  return (
    <Select
      required={required}
      disabled={disabled}
      value={value || '__none__'}
      onValueChange={(v) => onChange({ target: { value: v === '__none__' ? '' : v } })}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="— pilih akun —" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— pilih akun —</SelectItem>
        {UU05_INVENTORY_COA.map((a) => (
          <SelectItem key={a.code} value={a.code}>
            {a.code} — {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
