import type { HTMLAttributes } from 'react'

interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number
  label?: string | null
  column?: boolean
}

export default function Spinner({
  size = 32,
  label = 'Memuat...',
  column = false,
  className = '',
  ...rest
}: SpinnerProps) {
  const outerBorder = Math.max(3, Math.round(size * 0.1))
  const innerSize = Math.round(size * 0.7)
  const innerBorder = Math.max(2, Math.round(size * 0.08))

  return (
    <span
      className={`spinner-wrap ${column ? 'spinner-wrap--column' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
      data-testid="spinner"
      {...rest}
    >
      <span className="spinner-rings" style={{ width: size, height: size }} aria-hidden="true">
        <span
          className="spinner-ring spinner-ring--outer"
          style={{ width: size, height: size, borderWidth: outerBorder }}
        />
        <span
          className="spinner-ring spinner-ring--inner"
          style={{
            width: innerSize,
            height: innerSize,
            borderWidth: innerBorder,
            top: (size - innerSize) / 2,
            left: (size - innerSize) / 2,
          }}
        />
      </span>
      {label ? <span className="spinner-label">{label}</span> : <span className="sr-only">Memuat...</span>}
    </span>
  )
}
