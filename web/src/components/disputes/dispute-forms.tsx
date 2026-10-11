'use client'

import { useActionState } from 'react'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleState } from '@/lib/action-state'
import { openDisputeAction, resolveDisputeAction } from '@/app/(app)/disputes/actions'

export function OpenDisputeForm({ claimId, rentalId }: { claimId?: string; rentalId?: string }) {
  const [state, action] = useActionState(openDisputeAction, idleState)
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.status === 'error' && state.message && <Notice tone="error" title={state.message} />}
      {claimId && <input type="hidden" name="claimId" value={claimId} />}
      {rentalId && <input type="hidden" name="rentalId" value={rentalId} />}
      <Field
        id="reason"
        label="What went wrong?"
        hint="Be specific: what you expected, what happened, and what you’d like the warden to do."
        errors={state.fieldErrors?.reason}
      >
        {(a) => <Textarea {...a} name="reason" required minLength={10} maxLength={1000} rows={6} defaultValue={state.values?.reason} />}
      </Field>
      <Field
        id="evidence"
        label="Evidence"
        optional
        hint="A photo or PDF, up to 5 MB. Only the people involved and your hostel’s warden can see it."
        errors={state.fieldErrors?.evidence}
      >
        {(a) => <Input {...a} name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="py-2" />}
      </Field>
      <Notice tone="info" title="What happens next">
        The transaction is paused and any sandbox money stays held. A warden from the item’s hostel who isn’t involved will decide.
      </Notice>
      <SubmitButton pendingLabel="Submitting…">Open dispute</SubmitButton>
    </form>
  )
}

export function ResolveDisputeForm({ disputeId, options }: { disputeId: string; options: { value: string; label: string; detail: string }[] }) {
  const [state, action] = useActionState(resolveDisputeAction.bind(null, disputeId), idleState)
  if (state.status === 'success') return <Notice tone="success" title={state.message} />
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.status === 'error' && state.message && <Notice tone="error" title={state.message} />}
      <fieldset aria-describedby={state.fieldErrors?.outcome ? 'outcome-error' : undefined}>
        <legend className="text-sm font-medium">Decision</legend>
        <div className="mt-2 space-y-2">
          {options.map((o) => (
            <label
              key={o.value}
              className="border-line-strong has-[:checked]:border-forest has-[:checked]:bg-forest-tint flex cursor-pointer gap-3 rounded-lg border p-3"
            >
              <input type="radio" name="outcome" value={o.value} required className="accent-forest mt-1" defaultChecked={state.values?.outcome === o.value} />
              <span>
                <span className="block font-medium">{o.label}</span>
                <span className="text-muted block text-sm">{o.detail}</span>
              </span>
            </label>
          ))}
        </div>
        {state.fieldErrors?.outcome && (
          <p id="outcome-error" className="text-danger mt-2 text-sm font-medium">
            {state.fieldErrors.outcome.join(' ')}
          </p>
        )}
      </fieldset>
      <Field id="note" label="Reason for the decision" hint="Both parties will see this." errors={state.fieldErrors?.note}>
        {(a) => <Textarea {...a} name="note" required minLength={5} maxLength={1000} defaultValue={state.values?.note} />}
      </Field>
      <SubmitButton pendingLabel="Recording…">Record decision</SubmitButton>
    </form>
  )
}
