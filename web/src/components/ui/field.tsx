import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

const control =
  'block w-full rounded-lg border border-line-strong bg-chalk px-3 py-2.5 text-base text-ink placeholder:text-muted/80 aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-tint/40 disabled:opacity-60'

interface FieldProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  errors?: string[]
  optional?: boolean
  children: (aria: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
  className?: string
}

/** Label + control + hint + error, wired with aria-describedby / aria-invalid. */
export function Field({ id, label, hint, errors, optional, children, className }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = errors?.length ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {label}
        {optional && <span className="text-muted font-normal"> (optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-muted text-sm">
          {hint}
        </p>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': errorId ? true : undefined })}
      {errorId && (
        <p id={errorId} className="text-danger flex items-start gap-1.5 text-sm font-medium">
          <span aria-hidden="true">!</span>
          {errors!.join(' ')}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-28', className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, 'pr-8', className)} {...props} />
}

export function Checkbox({ label, className, ...props }: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-center gap-3 text-sm', className)}>
      <input type="checkbox" className="accent-forest size-5" {...props} />
      <span>{label}</span>
    </label>
  )
}
