'use client'

import { useEffect } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'

/** Error boundary for app pages. Shows a reference, never the raw error. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[ui-error]', error.digest ?? error.name)
  }, [error])

  return (
    <div role="alert" className="max-w-xl py-10">
      <p className="font-display text-clay text-6xl font-bold">500</p>
      <h1 className="mt-4 text-4xl">Something went wrong on our side</h1>
      <p className="text-muted mt-3">
        Your data is safe: any transaction either completed fully or not at all. Try again, or come back in a minute.
        {error.digest && (
          <>
            {' '}
            Reference: <code className="bg-stone rounded px-1">{error.digest}</code>
          </>
        )}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/dashboard" variant="secondary">
          Go to home
        </ButtonLink>
      </div>
    </div>
  )
}
