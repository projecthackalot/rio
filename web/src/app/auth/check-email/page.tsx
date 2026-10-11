import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { MailCheck } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'
import { Skeleton } from '@/components/ui/feedback'

export const metadata: Metadata = { title: 'Check your email' }

type SP = Promise<Record<string, string | string[] | undefined>>

const COPY: Record<string, { title: string; body: string }> = {
  signup: { title: 'Confirm your email', body: 'We sent a confirmation link. Open it to activate your account and sign in.' },
  magiclink: { title: 'Check your inbox', body: 'If an account exists for this address, a one-time sign-in link is on its way.' },
  recovery: { title: 'Check your inbox', body: 'If an account exists for this address, we sent a link to choose a new password.' },
}

export default function CheckEmailPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full max-w-md" />}>
      <CheckEmail searchParams={searchParams} />
    </Suspense>
  )
}

async function CheckEmail({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const type = typeof sp.type === 'string' && sp.type in COPY ? sp.type : 'signup'
  const email = typeof sp.email === 'string' ? sp.email.slice(0, 200) : null
  const copy = COPY[type]
  return (
    <AuthCard title={copy.title}>
      <div role="status" className="flex gap-4">
        <MailCheck aria-hidden="true" className="text-forest size-8 shrink-0" />
        <div className="space-y-2">
          <p>{copy.body}</p>
          {email && (
            <p className="text-muted text-sm">
              Sent to <span className="text-ink font-medium">{email}</span>. Links expire, so use it soon. If it hasn’t arrived in a few minutes, check spam.
            </p>
          )}
        </div>
      </div>
      <Link href="/auth/login" className="text-forest mt-6 inline-block font-medium underline underline-offset-4">
        Back to sign in
      </Link>
    </AuthCard>
  )
}
