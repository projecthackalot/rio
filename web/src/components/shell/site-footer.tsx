import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-line border-t pb-24 md:pb-0">
      <div className="text-muted mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-md space-y-2">
          <p className="font-display text-forest text-lg font-semibold">rio</p>
          <p>
            A Level 1 pilot. Every balance, payment, deposit and refund on RIO is simulated sandbox money; no real money moves. Impact figures are estimates
            from category coefficients, not measurements.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="space-y-1">
            <li>
              <Link className="hover:text-ink inline-flex min-h-9 items-center" href="/marketplace">
                Marketplace
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink inline-flex min-h-9 items-center" href="/#how-it-works">
                How it works
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink inline-flex min-h-9 items-center" href="/#rules">
                Pricing rules
              </Link>
            </li>
          </ul>
        </nav>
        <ul className="space-y-1">
          <li>
            <Link className="hover:text-ink inline-flex min-h-9 items-center" href="/auth/signup">
              Create account
            </Link>
          </li>
          <li>
            <Link className="hover:text-ink inline-flex min-h-9 items-center" href="/auth/login">
              Sign in
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}
