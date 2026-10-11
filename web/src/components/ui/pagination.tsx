import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Server-rendered pagination that preserves the current query string. */
export function Pagination({
  page,
  pageCount,
  basePath,
  params,
}: {
  page: number
  pageCount: number
  basePath: string
  params: Record<string, string | undefined>
}) {
  if (pageCount <= 1) return null
  const href = (p: number) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') qs.set(k, v)
    if (p > 1) qs.set('page', String(p))
    const s = qs.toString()
    return s ? `${basePath}?${s}` : basePath
  }
  const linkCls =
    'inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-line bg-chalk px-3 text-sm font-medium hover:border-line-strong'
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkCls} rel="prev">
          <ChevronLeft aria-hidden="true" className="size-4" /> Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-muted text-sm" aria-live="polite">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={cn(linkCls)} rel="next">
          Next <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
