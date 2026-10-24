import Link from 'next/link'
import { buttonClass } from './button'
import { Notice } from './feedback'

/**
 * Inline fallback for when the database can't be reached: the page keeps its
 * header, heading and navigation, and offers a retry instead of crashing into
 * the generic error screen.
 */
export function DataUnavailable({ title, retryHref, children }: { title: string; retryHref: string; children?: React.ReactNode }) {
  return (
    <div className="mt-8 max-w-xl">
      <Notice tone="error" title={title}>
        {children ?? 'The marketplace database didn’t respond as expected. This is a problem on our side, not something you did.'}
      </Notice>
      <Link href={retryHref} className={`${buttonClass('secondary')} mt-4`}>
        Try again
      </Link>
    </div>
  )
}
