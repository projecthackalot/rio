import Link from 'next/link'
import { cn } from '@/lib/cn'

/** Wordmark: lowercase "rio" with a loop mark (an item staying in circulation). */
export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('text-forest inline-flex min-h-11 items-center gap-2 rounded-md', className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7">
        <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="52 17" strokeLinecap="round" />
        <path d="M24.5 6.5l1.2 6-5.8-1.6" fill="none" stroke="var(--color-clay)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-2xl font-bold tracking-tight">rio</span>
      <span className="sr-only">home</span>
    </Link>
  )
}
