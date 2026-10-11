import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AuthCard } from '@/components/auth/auth-card'
import { MagicLinkForm } from '@/components/auth/auth-forms'
import { Skeleton } from '@/components/ui/feedback'
import { safeNext } from '@/lib/auth/redirect'

export const metadata: Metadata = { title: 'Email sign-in link' }

type SP = Promise<Record<string, string | string[] | undefined>>

export default function MagicLinkPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full max-w-md" />}>
      <MagicLink searchParams={searchParams} />
    </Suspense>
  )
}

async function MagicLink({ searchParams }: { searchParams: SP }) {
  const next = safeNext((await searchParams).next)
  return (
    <AuthCard
      title="Sign in by email"
      intro="We’ll email you a one-time link. It works for existing accounts only."
      footer={
        <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="text-forest font-medium underline underline-offset-4">
          Use a password instead
        </Link>
      }
    >
      <MagicLinkForm next={next} />
    </AuthCard>
  )
}
