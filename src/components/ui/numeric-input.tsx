import * as React from 'react'
import { formatNumericInput, parseNumericInput } from '@/lib/numericInput'

export default function NumericInput({
  value,
  defaultValue,
  onChange,
  onBlur,
  ref,
  min,
  max,
  step,
  ...props
}: React.ComponentProps<'input'>) {
  const [local, setLocal] = React.useState(String(defaultValue ?? ''))
  const raw = value === undefined ? local : String(value ?? '')
  const display = formatNumericInput(raw)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const cursor = React.useRef<number | null>(null)
  React.useImperativeHandle(ref, () => inputRef.current!, [])
  const validity = React.useCallback(
    (input: HTMLInputElement, next: string) => {
      const number = Number(next)
      let message = ''
      if (next && !/^-?\d+(?:\.\d*)?$/.test(next)) message = 'Masukkan angka yang valid.'
      else if (next && !Number.isFinite(number)) message = 'Nilai angka terlalu besar.'
      else if (next && min != null && number < Number(min))
        message = `Nilai minimal ${formatNumericInput(String(min))}.`
      else if (next && max != null && number > Number(max))
        message = `Nilai maksimal ${formatNumericInput(String(max))}.`
      else if (next && step !== 'any') {
        const interval = Number(step ?? 1)
        const units = (number - Number(min ?? 0)) / interval
        if (interval > 0 && Math.abs(units - Math.round(units)) > 0.000001)
          message = `Gunakan kelipatan ${formatNumericInput(String(interval))}.`
      }
      input.setCustomValidity(message)
    },
    [min, max, step],
  )
  React.useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    validity(input, raw)
    if (cursor.current != null && document.activeElement === input) {
      let position = display.length,
        remaining = cursor.current
      while (position > 0 && remaining > 0) {
        position--
        if (/[\d,-]/.test(display[position])) remaining--
      }
      input.setSelectionRange(position, position)
      cursor.current = null
    }
  }, [display, raw, validity])
  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode={props.inputMode ?? 'decimal'}
      value={display}
      onChange={(event) => {
        const input = event.currentTarget
        let typed = input.value
        const position = input.selectionStart ?? typed.length
        // Accept a decimal dot from mobile keyboards; displayed dots remain grouping separators.
        if ((event.nativeEvent as InputEvent).data === '.' && typed[position - 1] === '.')
          typed = `${typed.slice(0, position - 1)},${typed.slice(position)}`
        const native = event.nativeEvent as InputEvent
        const next = parseNumericInput(typed, native.inputType === 'insertFromPaste' || (native.data?.length ?? 0) > 1)
        if (next === null) {
          input.value = display
          return
        }
        cursor.current = (typed.slice(position).match(/[\d,-]/g) ?? []).length
        validity(input, next)
        if (value === undefined) setLocal(next)
        // Consumers (including Controller) receive the unformatted value, never the display string.
        onChange?.({ ...event, target: { ...event.target, value: next }, currentTarget: { ...input, value: next } })
      }}
      onBlur={(event) =>
        onBlur?.({
          ...event,
          target: { ...event.target, value: raw },
          currentTarget: { ...event.currentTarget, value: raw },
        })
      }
    />
  )
}
