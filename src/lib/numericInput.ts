/** Display uses Indonesian separators; form state retains a plain decimal string. */
export function formatNumericInput(raw: string): string {
  const [integer, fraction] = raw.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return fraction === undefined ? grouped : `${grouped},${fraction}`
}

export function parseNumericInput(display: string, acceptDecimalDot = false): string | null {
  let value = display
    .trim()
    .replace(/^Rp\.?\s*/i, '')
    .replace(/\s/g, '')
  if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.')
  else if (!acceptDecimalDot || /^-?\d{1,3}(?:\.\d{3})+$/.test(value)) value = value.replace(/\./g, '')
  if (!/^-?\d*(?:\.\d*)?$/.test(value)) return null
  value = value.replace(/^(-?)\./, '$10.').replace(/^(-?)0+(?=\d)/, '$1')
  return value
}
