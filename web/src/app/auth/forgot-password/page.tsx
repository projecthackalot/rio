import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { ForgotPasswordForm } from '@/components/auth/auth-forms'

export const metadata: Metadata = { title: 'Reset password' }

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      intro="Enter your account email and we’ll send a link to choose a new password."
      footer={
        <Link href="/auth/login" className="text-forest font-medium underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
