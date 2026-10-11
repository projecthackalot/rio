import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AuthCard, Divider, GoogleButton } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/auth-forms'
import { Skeleton } from '@/components/ui/feedback'
import { safeNext } from '@/lib/auth/redirect'

export const metadata: Metadata = { title: 'Sign in' }

type SP = Promise<Record<string, string | string[] | undefined>>

export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
      <Login searchParams={searchParams} />
    </Suspense>
  )
}

async function Login({ searchParams }: { searchParams: SP }) {
  const next = safeNext((await searchParams).next)
  const q = `?next=${encodeURIComponent(next)}`
  return (
    <AuthCard
      title="Welcome back"
      intro="Sign in to claim, rent and hand over items on your campus."
      footer={
        <>
          New to RIO?{' '}
          <Link href={`/auth/signup${q}`} className="text-forest font-medium underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <Divider label="or use email" />
      <LoginForm next={next} />
      <p className="mt-5 text-center text-sm">
        <Link href={`/auth/magic-link${q}`} className="text-forest font-medium underline underline-offset-4">
          Email me a sign-in link instead
        </Link>
      </p>
    </AuthCard>
  )
}
