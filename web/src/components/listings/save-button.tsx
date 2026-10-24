'use client'

import { useActionState } from 'react'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toggleSavedAction, type SavedState } from '@/app/(app)/actions'

/**
 * Save / unsave a listing. A real, separate control (not part of the card's
 * link), with its pressed state exposed to assistive tech. Persists per user.
 */
export function SaveButton({
  listingId,
  title,
  initialSaved,
  returnTo,
  variant = 'icon',
}: {
  listingId: string
  title: string
  initialSaved: boolean
  returnTo: string
  variant?: 'icon' | 'labelled'
}) {
  const [state, action, pending] = useActionState<SavedState, FormData>(toggleSavedAction.bind(null, listingId, returnTo), { saved: initialSaved })
  const label = state.saved ? `Remove ${title} from saved items` : `Save ${title}`

  return (
    <form action={action} className={variant === 'icon' ? 'contents' : undefined}>
      <button
        type="submit"
        aria-pressed={state.saved}
        aria-label={label}
        title={state.saved ? 'Saved' : 'Save'}
        disabled={pending}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-70',
          variant === 'icon'
            ? 'bg-chalk/95 border-line text-ink hover:bg-chalk size-11 rounded-full border shadow-sm'
            : 'border-line-strong bg-chalk hover:bg-stone min-h-11 rounded-lg border px-4',
          state.saved && 'text-clay',
        )}
      >
        <Heart aria-hidden="true" className="size-5" fill={state.saved ? 'currentColor' : 'none'} />
        {variant === 'labelled' && <span>{state.saved ? 'Saved' : 'Save'}</span>}
      </button>
      {state.error && (
        <span role="alert" className="sr-only">
          {state.error}
        </span>
      )}
    </form>
  )
}
