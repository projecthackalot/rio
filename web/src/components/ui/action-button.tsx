'use client'

import { useActionState, useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './button'
import { Notice } from './feedback'
import { SubmitButton } from './submit-button'
import { idleState, type ActionState } from '@/lib/action-state'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'clay'

interface ActionButtonProps {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  label: string
  pendingLabel?: string
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** When set, the action only runs after the person confirms in a modal dialog. */
  confirm?: { title: string; body: ReactNode; confirmLabel?: string }
  children?: ReactNode // extra form fields
}

/**
 * A Server Action behind a button, with pending state, an accessible result
 * message (role=status / role=alert) and an optional confirmation dialog
 * built on the native <dialog> element (focus trap, Esc to close, focus return).
 */
export function ActionButton({ action, label, pendingLabel, variant = 'primary', size = 'md', className, confirm, children }: ActionButtonProps) {
  const [state, formAction] = useActionState(action, idleState)
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Button labels contain spaces, which are invalid in ids: derive a stable id instead.
  const titleId = useId()
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (state.status !== 'idle' && dialogRef.current?.open) {
      dialogRef.current.close()
      openerRef.current?.focus()
    }
  }, [state])

  const submit = (
    <SubmitButton
      variant={confirm ? (variant === 'danger' ? 'danger' : 'primary') : variant}
      size={size}
      className={confirm ? undefined : className}
      pendingLabel={pendingLabel}
    >
      {confirm?.confirmLabel ?? label}
    </SubmitButton>
  )

  return (
    <div className="space-y-3">
      {confirm ? (
        <>
          <Button ref={openerRef} variant={variant} size={size} className={className} onClick={() => dialogRef.current?.showModal()}>
            {label}
          </Button>
          <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            className="rounded-card border-line bg-chalk text-ink backdrop:bg-ink/40 m-auto w-[min(32rem,calc(100vw-2rem))] border p-0"
          >
            {/* Extra fields (children) sit above the buttons, inside the same form. */}
            <form action={formAction} className="space-y-4 p-6">
              <h2 id={titleId} className="text-2xl">
                {confirm.title}
              </h2>
              <div className="text-muted">{confirm.body}</div>
              {children}
              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
                  Go back
                </Button>
                {submit}
              </div>
            </form>
          </dialog>
        </>
      ) : (
        <form action={formAction} className="contents">
          {children}
          {submit}
        </form>
      )}
      {state.status === 'error' && state.message && <Notice tone="error" title={state.message} />}
      {state.status === 'success' && state.message && <Notice tone="success" title={state.message} />}
    </div>
  )
}
