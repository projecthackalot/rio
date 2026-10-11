'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, Input } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleState, type ActionState } from '@/lib/action-state'
import { login, requestPasswordReset, sendMagicLink, signup, updatePassword } from '@/app/auth/actions'

function FormError({ state }: { state: ActionState }) {
  if (state.status !== 'error' || !state.message) return null
  return <Notice tone="error" title={state.message} />
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, idleState)
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ''} />
      <Field id="email" label="Email" errors={state.fieldErrors?.email}>
        {(a) => <Input {...a} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />}
      </Field>
      <Field id="password" label="Password" errors={state.fieldErrors?.password}>
        {(a) => <Input {...a} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <div className="flex justify-end text-sm">
        <Link href="/auth/forgot-password" className="text-forest font-medium underline underline-offset-4">
          Forgot password?
        </Link>
      </div>
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  )
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signup, idleState)
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ''} />
      <Field id="fullName" label="Full name" errors={state.fieldErrors?.fullName}>
        {(a) => <Input {...a} name="fullName" autoComplete="name" required maxLength={80} defaultValue={state.values?.fullName} />}
      </Field>
      <Field id="email" label="Email" hint="Use the address you check: we’ll send a confirmation link." errors={state.fieldErrors?.email}>
        {(a) => <Input {...a} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />}
      </Field>
      <Field id="password" label="Password" hint="At least 8 characters, with a letter and a number." errors={state.fieldErrors?.password}>
        {(a) => <Input {...a} name="password" type="password" autoComplete="new-password" required minLength={8} />}
      </Field>
      <Field id="confirmPassword" label="Confirm password" errors={state.fieldErrors?.confirmPassword}>
        {(a) => <Input {...a} name="confirmPassword" type="password" autoComplete="new-password" required />}
      </Field>
      <p className="text-muted text-sm">New accounts are student accounts. Wardens and staff are set up by a campus administrator.</p>
      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  )
}

export function MagicLinkForm({ next }: { next?: string }) {
  const [state, action] = useActionState(sendMagicLink, idleState)
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ''} />
      <Field id="email" label="Email" errors={state.fieldErrors?.email}>
        {(a) => <Input {...a} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />}
      </Field>
      <SubmitButton className="w-full" pendingLabel="Sending link…">
        Email me a sign-in link
      </SubmitButton>
    </form>
  )
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, idleState)
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError state={state} />
      <Field id="email" label="Email" errors={state.fieldErrors?.email}>
        {(a) => <Input {...a} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />}
      </Field>
      <SubmitButton className="w-full" pendingLabel="Sending link…">
        Send reset link
      </SubmitButton>
    </form>
  )
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePassword, idleState)
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError state={state} />
      <Field id="password" label="New password" hint="At least 8 characters, with a letter and a number." errors={state.fieldErrors?.password}>
        {(a) => <Input {...a} name="password" type="password" autoComplete="new-password" required minLength={8} />}
      </Field>
      <Field id="confirmPassword" label="Confirm new password" errors={state.fieldErrors?.confirmPassword}>
        {(a) => <Input {...a} name="confirmPassword" type="password" autoComplete="new-password" required />}
      </Field>
      <SubmitButton className="w-full" pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  )
}
