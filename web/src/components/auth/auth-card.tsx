import type { ReactNode } from 'react'
import { signInWithGoogle } from '@/app/auth/actions'

export function AuthCard({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="w-full max-w-md">
      <h1 className="text-4xl">{title}</h1>
      {intro && <p className="text-muted mt-3">{intro}</p>}
      <div className="rounded-card border-line bg-chalk mt-8 border p-6 sm:p-8">{children}</div>
      {footer && <div className="text-muted mt-6 text-center text-sm">{footer}</div>}
    </div>
  )
}

export function GoogleButton({ next, label = 'Continue with Google' }: { next?: string; label?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next ?? ''} />
      <button
        type="submit"
        className="border-line-strong bg-chalk hover:bg-stone inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border px-4 font-medium"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
        </svg>
        {label}
      </button>
    </form>
  )
}

export function Divider({ label = 'or' }: { label?: string }) {
  return (
    <div className="text-muted my-6 flex items-center gap-3 text-sm" role="separator">
      <span className="bg-line h-px flex-1" />
      {label}
      <span className="bg-line h-px flex-1" />
    </div>
  )
}
