import { toast } from 'sonner'

type NotifyOptions = Record<string, unknown> & { type?: 'default' | 'success' | 'error' | 'info' }

export function notify(message: unknown, options: NotifyOptions = {}) {
  const text = typeof message === 'string' ? message : 'Terjadi kesalahan.'
  const { type = 'default', ...toastOptions } = options
  if (type === 'success') return toast.success(text, toastOptions)
  if (type === 'error') return toast.error(text, toastOptions)
  if (type === 'info') return toast.info(text, toastOptions)
  return toast(text, toastOptions)
}

export const notifySuccess = (message: unknown, options?: NotifyOptions) =>
  notify(message, { ...options, type: 'success' })
export const notifyError = (message: unknown, options?: NotifyOptions) =>
  notify(message, { ...options, type: 'error' })
export const notifyInfo = (message: unknown, options?: NotifyOptions) =>
  notify(message, { ...options, type: 'info' })
