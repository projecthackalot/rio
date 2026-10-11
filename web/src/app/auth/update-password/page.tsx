import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AuthCard } from '@/components/auth/auth-card'
import { UpdatePasswordForm } from '@/components/auth/auth-forms'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { getViewer } from '@/lib/auth/dal'

export const metadata: Metadata = { title: 'Choose a new password' }

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
      <UpdatePassword />
    </Suspense>
  )
}

async function UpdatePassword() {
  const viewer = await getViewer()
  if (!viewer) {
    return (
      <AuthCard title="This link has expired">
        <Notice tone="warning" title="Your password reset session isn’t active.">
          Reset links work once and expire after a while. Request a fresh one to continue.
        </Notice>
        <Link href="/auth/forgot-password" className="text-forest mt-5 inline-block font-medium underline underline-offset-4">
          Send a new reset link
        </Link>
      </AuthCard>
    )
  }
  return (
    <AuthCard title="Choose a new password" intro={`For ${viewer.email ?? 'your account'}.`}>
      <UpdatePasswordForm />
    </AuthCard>
  )
}
