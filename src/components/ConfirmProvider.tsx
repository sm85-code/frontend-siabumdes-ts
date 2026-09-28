import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface ConfirmRequest extends Required<ConfirmOptions> {
  resolve: (value: boolean) => void
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest({
        title: options.title || 'Konfirmasi tindakan',
        description: options.description || 'Apakah Anda yakin ingin melanjutkan?',
        confirmLabel: options.confirmLabel || 'Lanjutkan',
        cancelLabel: options.cancelLabel || 'Batal',
        destructive: Boolean(options.destructive),
        resolve,
      })
    })
  }, [])

  const close = (result: boolean) => {
    request?.resolve(result)
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(request)} onOpenChange={(open) => !open && close(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{request?.title}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {request?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              {request?.cancelLabel}
            </Button>
            <Button
              type="button"
              variant={request?.destructive ? 'destructive' : 'default'}
              onClick={() => close(true)}
            >
              {request?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm harus digunakan di dalam ConfirmProvider')
  return confirm
}
