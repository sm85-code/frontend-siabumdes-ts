import { describe, expect, it } from 'vitest'
import { formatNumericInput, parseNumericInput } from './numericInput'

describe('grouped numeric entry', () => {
  it('groups amounts without rounding or losing fractional digits', () => {
    expect(formatNumericInput('1000000')).toBe('1.000.000')
    expect(formatNumericInput('-1234567.50')).toBe('-1.234.567,50')
    expect(formatNumericInput('9999999999999999.99')).toBe('9.999.999.999.999.999,99')
    expect(formatNumericInput('12.')).toBe('12,')
  })
  it('keeps a plain numeric value after deleting or inserting digits around separators', () => {
    expect(parseNumericInput('1.00')).toBe('100')
    expect(parseNumericInput('12.3456')).toBe('123456')
    expect(parseNumericInput('1.234.567,50')).toBe('1234567.50')
    expect(parseNumericInput('-1.000')).toBe('-1000')
    expect(parseNumericInput(',5')).toBe('0.5')
    expect(parseNumericInput('-,5')).toBe('-0.5')
    expect(parseNumericInput('0001000')).toBe('1000')
    expect(parseNumericInput('')).toBe('')
    expect(parseNumericInput('-')).toBe('-')
  })
  it('accepts currency paste and decimal dot paste, but rejects invalid mixed input', () => {
    expect(parseNumericInput('Rp 1.234.567,89', true)).toBe('1234567.89')
    expect(parseNumericInput('1234.50', true)).toBe('1234.50')
    expect(parseNumericInput('1.234.567', true)).toBe('1234567')
    expect(parseNumericInput('12abc')).toBeNull()
    expect(parseNumericInput('1,2,3')).toBeNull()
  })
})
