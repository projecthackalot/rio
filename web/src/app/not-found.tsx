import type { Metadata } from 'next'
import { SiteFooter } from '@/components/shell/site-footer'
import { SiteHeader } from '@/components/shell/site-header'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-20 outline-none sm:px-6">
        <p className="font-display text-forest text-7xl font-bold">404</p>
        <h1 className="mt-4 text-4xl">This page isn’t here</h1>
        <p className="text-muted mt-3 max-w-lg">The item may have been sold, withdrawn or never existed, or the link is mistyped.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Go home
          </ButtonLink>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
