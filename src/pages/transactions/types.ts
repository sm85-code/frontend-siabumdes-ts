export type TxFormState = {
  date: string
  unit_usaha_id: string
  transaction_type: string
  description: string
  amount: string
  debit_account_code: string
  credit_account_code: string
  reference: string
}

export const emptyTxForm = (): TxFormState => ({
  date: new Date().toISOString().slice(0, 10),
  unit_usaha_id: '',
  transaction_type: '',
  description: '',
  amount: '',
  debit_account_code: '',
  credit_account_code: '',
  reference: '',
})
