import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AuthCard, Divider, GoogleButton } from '@/components/auth/auth-card'
import { SignupForm } from '@/components/auth/auth-forms'
import { Skeleton } from '@/components/ui/feedback'
import { safeNext } from '@/lib/auth/redirect'

export const metadata: Metadata = { title: 'Create account' }

type SP = Promise<Record<string, string | string[] | undefined>>

export default function SignupPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] w-full max-w-md" />}>
      <Signup searchParams={searchParams} />
    </Suspense>
  )
}

async function Signup({ searchParams }: { searchParams: SP }) {
  const next = safeNext((await searchParams).next)
  return (
    <AuthCard
      title="Create your account"
      intro="List what you’re leaving behind, or pick up what the last batch left for you."
      footer={
        <>
          Already have an account?{' '}
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="text-forest font-medium underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton next={next} label="Sign up with Google" />
      <Divider label="or use email" />
      <SignupForm next={next} />
    </AuthCard>
  )
}
