'use client'

import { useActionState } from 'react'
import { Star } from 'lucide-react'
import { Notice } from '@/components/ui/feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleState } from '@/lib/action-state'
import { rateTransactionAction } from '@/app/(app)/actions'

/** One-time seller rating for a completed purchase or returned rental. Stars are radio buttons (keyboard-friendly). */
export function RatingForm({ claimId, rentalId }: { claimId?: string; rentalId?: string }) {
  const [state, action] = useActionState(rateTransactionAction.bind(null, { claimId, rentalId }), idleState)
  if (state.status === 'success') return <Notice tone="success" title={state.message} />
  const name = `stars-${claimId ?? rentalId}`
  return (
    <form action={action} className="border-line space-y-3 border-t pt-4">
      {state.status === 'error' && state.message && <Notice tone="error" title={state.message} />}
      <fieldset>
        <legend className="text-sm font-medium">Rate the seller</legend>
        <div className="mt-1 flex flex-row-reverse justify-end gap-1 [&_label:has(input:checked)_svg]:fill-current [&_label:has(input:checked)~label_svg]:fill-current [&_label:hover_svg]:fill-current [&_label:hover~label_svg]:fill-current">
          {/* Stars are in reverse DOM order, so "~ label" reaches every lower star: the chosen star and all below it fill. */}
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="has-[:focus-visible]:outline-forest cursor-pointer rounded p-1 has-[:focus-visible]:outline">
              <input type="radio" name="stars" value={n} required className="sr-only" aria-label={`${n} star${n === 1 ? '' : 's'}`} id={`${name}-${n}`} />
              <Star aria-hidden="true" className="text-clay size-7" />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium" htmlFor={`${name}-comment`}>
        Comment <span className="text-muted font-normal">(optional, shown publicly without your name)</span>
      </label>
      <input id={`${name}-comment`} name="comment" maxLength={300} className="border-line-strong bg-chalk min-h-11 w-full rounded-lg border px-3" />
      <SubmitButton size="sm" pendingLabel="Saving…">
        Submit rating
      </SubmitButton>
    </form>
  )
}
