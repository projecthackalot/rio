'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useActionState, useCallback, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatHandoverCode } from '@/domain/handoverCode'
import { consumeHandoverCodeAction, type ConsumeState } from '@/app/(app)/actions'

const QrScanner = dynamic(() => import('./qr-scanner'), {
  ssr: false,
  loading: () => (
    <p className="text-muted text-sm" role="status">
      Loading scanner…
    </p>
  ),
})

/** Receiver's side: scan with the camera or type the code. Typing always works. */
export function ConsumeForm() {
  const [state, action] = useActionState<ConsumeState, FormData>(consumeHandoverCodeAction, { status: 'idle' })
  const [scanning, setScanning] = useState(false)
  const [damage, setDamage] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onCode = useCallback((code: string) => {
    setScanning(false)
    if (inputRef.current) inputRef.current.value = formatHandoverCode(code)
    formRef.current?.requestSubmit()
  }, [])
  const onClose = useCallback(() => setScanning(false), [])

  return (
    <div className="space-y-6">
      {state.status === 'success' ? (
        <div className="space-y-4">
          <Notice tone="success" title="Handover complete">
            {state.message}
          </Notice>
          <div className="flex flex-wrap gap-3">
            {state.listingId && (
              <Link href={`/items/${state.listingId}`} className="text-forest font-medium underline underline-offset-4">
                View the item
              </Link>
            )}
            <Link href="/activity" className="text-forest font-medium underline underline-offset-4">
              Go to my activity
            </Link>
          </div>
        </div>
      ) : (
        state.status === 'error' && state.message && <Notice tone="error" title={state.message} />
      )}

      <div>
        {scanning ? (
          <QrScanner onCode={onCode} onClose={onClose} />
        ) : (
          <Button variant="secondary" onClick={() => setScanning(true)}>
            <Camera aria-hidden="true" className="size-4" />
            Scan with camera
          </Button>
        )}
      </div>

      <form ref={formRef} action={action} className="space-y-5" noValidate>
        <Field
          id="code"
          label="Handover code"
          hint="16 letters and numbers, shown under the other person’s QR code. Dashes and case don’t matter."
          errors={state.fieldErrors?.code}
        >
          {(a) => (
            <Input
              {...a}
              ref={inputRef}
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCD-EFGH-JKMN-PQRS"
              className="font-display text-xl tracking-wider uppercase"
              defaultValue={state.status === 'error' ? state.values?.code : undefined}
              key={state.status === 'success' ? 'reset' : 'code'}
            />
          )}
        </Field>
        <fieldset className="border-line rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">Receiving a rental back?</legend>
          <Checkbox name="reportDamage" label="The item came back damaged" checked={damage} onChange={(e) => setDamage(e.target.checked)} />
          {damage && (
            <Field
              id="damageNote"
              label="What’s damaged?"
              hint="A warden reviews this. The deposit stays held until they decide."
              errors={state.fieldErrors?.damageNote}
              className="mt-3"
            >
              {(a) => <Textarea {...a} name="damageNote" maxLength={1000} required />}
            </Field>
          )}
        </fieldset>
        <SubmitButton pendingLabel="Confirming…" className="w-full sm:w-auto">
          Confirm handover
        </SubmitButton>
      </form>
    </div>
  )
}
