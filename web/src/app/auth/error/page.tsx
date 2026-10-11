import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AuthCard } from '@/components/auth/auth-card'
import { Notice, Skeleton } from '@/components/ui/feedback'

export const metadata: Metadata = { title: 'Sign-in problem' }

type SP = Promise<Record<string, string | string[] | undefined>>

const REASONS: Record<string, string> = {
  link: 'That link is invalid or has expired. Links work once and expire after a short time.',
  oauth: 'Google sign-in didn’t complete. Check that Google sign-in is set up for this site and try again.',
  'oauth-denied': 'Google sign-in was cancelled.',
  'missing-code': 'The sign-in response was incomplete. Please start again.',
}

export default function AuthErrorPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<Skeleton className="h-56 w-full max-w-md" />}>
      <AuthError searchParams={searchParams} />
    </Suspense>
  )
}

async function AuthError({ searchParams }: { searchParams: SP }) {
  const reason = (await searchParams).reason
  const message = (typeof reason === 'string' && REASONS[reason]) || 'We couldn’t sign you in.'
  return (
    <AuthCard title="Couldn’t sign you in">
      <Notice tone="error" title={message} />
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-medium">
        <Link href="/auth/login" className="text-forest underline underline-offset-4">
          Try signing in again
        </Link>
        <Link href="/auth/forgot-password" className="text-forest underline underline-offset-4">
          Reset password
        </Link>
      </div>
    </AuthCard>
  )
}
