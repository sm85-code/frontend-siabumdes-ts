import type { ComponentProps } from 'react'
import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/lib/theme'

export function Toaster(props: ComponentProps<typeof Sonner>) {
  const { mode } = useTheme()
  return (
    <Sonner
      theme={mode}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      {...props}
    />
  )
}
