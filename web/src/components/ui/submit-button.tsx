'use client'

import { useFormStatus } from 'react-dom'
import type { ComponentProps } from 'react'
import { Button } from './button'

/** Submit button that disables itself and announces progress while its form is pending. */
export function SubmitButton({ children, pendingLabel, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" aria-disabled={pending || props.disabled} disabled={pending || props.disabled} {...props}>
      {pending ? (
        <>
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          <span>{pendingLabel ?? 'Working…'}</span>
        </>
      ) : (
        children
      )}
    </Button>
  )
}
