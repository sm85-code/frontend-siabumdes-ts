import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ConfirmProvider'
import { getApiError } from '@/api/client'

type Controls = {
  cancel: () => void
  run: (action: () => void | Promise<void>) => Promise<void>
}

/** Keeps the table mounted while operational forms are edited. */
export default function FormDialog({
  title,
  onClose,
  error,
  children,
  compact = false,
}: {
  title: string
  onClose: () => void
  error?: string | null
  compact?: boolean
  children: (controls: Controls) => ReactNode
}) {
  const confirm = useConfirm()
  const dirty = useRef(false)
  const pending = useRef(false)
  const confirming = useRef(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const cancel = useCallback(async () => {
    if (pending.current || confirming.current) return
    confirming.current = true
    try {
      if (
        dirty.current &&
        !(await confirm({
          title: 'Batalkan perubahan?',
          description: 'Isian yang belum disimpan akan hilang.',
          confirmLabel: 'Buang perubahan',
          cancelLabel: 'Lanjutkan mengisi',
        }))
      )
        return
      onClose()
    } finally {
      confirming.current = false
    }
  }, [confirm, onClose])
  const run = useCallback(async (action: () => void | Promise<void>) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setFailure('')
    try {
      await action()
    } catch (e) {
      setFailure(getApiError(e))
      throw e
    } finally {
      pending.current = false
      setBusy(false)
    }
  }, [])
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void cancel()
      }}
    >
      <DialogContent
        closeDisabled={busy}
        aria-busy={busy}
        className={
          compact
            ? 'max-w-lg'
            : 'w-[calc(100%-1rem)] max-w-3xl max-h-[calc(100dvh-1rem)] p-0 gap-0 overflow-hidden grid-rows-[auto_minmax(0,1fr)]'
        }
      >
        <DialogHeader className={compact ? 'pr-7' : 'border-b px-5 py-4 pr-12 text-left'}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Lengkapi isian, lalu simpan. Tabel tetap tersedia setelah form ditutup.</DialogDescription>
        </DialogHeader>
        <div
          className={compact ? 'min-w-0' : 'min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5'}
          onInputCapture={() => {
            dirty.current = true
          }}
          onChangeCapture={() => {
            dirty.current = true
          }}
          onClickCapture={(event) => {
            const target = event.target as HTMLElement
            if (target.closest('[role="option"], [role="checkbox"], [role="switch"]')) dirty.current = true
          }}
        >
          {(failure || error) && (
            <p role="alert" className="mb-4 rounded-lg border border-destructive p-3 text-sm text-destructive">
              {failure || error}
            </p>
          )}
          <fieldset
            disabled={busy}
            className="min-w-0 border-0 p-0 m-0 [&_[data-slot=card]]:shadow-none [&_[data-slot=card]]:border-0 [&_[data-slot=card-header]]:hidden"
          >
            {/* Render prop passes event handlers; the refs are accessed only when a user acts. */}
            {/* oxlint-disable-next-line react/refs */}
            {children({
              cancel: () => {
                void cancel()
              },
              run,
            })}
          </fieldset>
        </div>
      </DialogContent>
    </Dialog>
  )
}
