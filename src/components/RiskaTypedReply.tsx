import { useEffect, useMemo, useState, type ReactNode } from 'react'

type Props = {
  message: string
  animate: boolean
  onProgress: () => void
  onComplete: () => void
  children: ReactNode
}

/** Presentation only: the full, validated backend reply is already available. */
export default function RiskaTypedReply({ message, animate, onProgress, onComplete, children }: Props) {
  const characters = useMemo(() => Array.from(
    new Intl.Segmenter('id', { granularity: 'grapheme' }).segment(message), part => part.segment,
  ), [message])
  const [visible, setVisible] = useState(() =>
    !animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? characters.length : 0,
  )
  const complete = visible >= characters.length

  useEffect(() => {
    if (complete) return
    let frame = 0
    let started: number | null = null
    const duration = Math.max(600, Math.min(characters.length * 18, 5_000))
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    function finish() { setVisible(characters.length) }
    function tick(time: number) {
      started ??= time
      const progress = Math.min(1, Math.max(0, (time - started - 250) / duration))
      setVisible(Math.floor(characters.length * progress))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }
    function preferenceChanged() { if (preference.matches) finish() }
    frame = window.requestAnimationFrame(tick)
    preference.addEventListener('change', preferenceChanged)
    return () => { window.cancelAnimationFrame(frame); preference.removeEventListener('change', preferenceChanged) }
  }, [characters, complete])

  useEffect(() => {
    onProgress()
    if (complete) onComplete()
  }, [visible, complete, onProgress, onComplete])

  return <div aria-busy={!complete}>
    <p className="whitespace-pre-wrap" aria-hidden="true">
      {characters.slice(0, visible).join('')}
      {!complete && <span className="ml-0.5 inline-block animate-pulse" aria-hidden="true">▍</span>}
    </p>
    <p className="sr-only">{message}</p>
    {!complete && <button type="button" className="min-h-11 text-xs text-gray-600 underline" onClick={() => setVisible(characters.length)}>Tampilkan langsung</button>}
    {complete && children}
  </div>
}
