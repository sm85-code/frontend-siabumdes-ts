/** API / form money: number today, string after BE Decimal→str serialization. */
export type MoneyInput = number | string | null | undefined

/**
 * Coerce money from API/forms to a finite number for display/math.
 * Accepts number or numeric string (plain "1500.5", en "1,500.50", id-ID "1.500,50").
 * Empty / null / undefined / non-numeric → 0.
 */
export function parseMoney(value: MoneyInput): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value).trim()
  if (!raw) return 0
  let s = raw.replace(/Rp\.?/gi, '').replace(/\s/g, '')
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234.567,89
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234,567.89
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    const parts = s.split(',')
    if (parts.length === 2 && parts[1].length <= 2 && !parts[0].includes('.')) {
      s = `${parts[0]}.${parts[1]}`
    } else {
      s = s.replace(/,/g, '')
    }
  } else if ((s.match(/\./g) || []).length > 1) {
    // 1.234.567 (id-ID thousands, no decimal)
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
