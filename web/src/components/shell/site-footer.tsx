import Link from 'next/link'

const GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Marketplace',
    links: [
      { href: '/marketplace', label: 'Browse items' },
      { href: '/sell/new', label: 'List an item' },
      { href: '/how-it-works', label: 'How it works' },
      { href: '/campus-impact', label: 'Campus impact' },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: '/help', label: 'Help and FAQ' },
      { href: '/trust-and-safety', label: 'Trust and safety' },
      { href: '/contact', label: 'Contact' },
      { href: '/accessibility', label: 'Accessibility' },
    ],
  },
  {
    title: 'RIO',
    links: [
      { href: '/about', label: 'About' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms and listing policy' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-line border-t pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-[1.6fr_repeat(3,minmax(0,1fr))]">
        <div className="text-muted max-w-sm space-y-2">
          <p className="font-display text-forest text-lg font-semibold">rio</p>
          <p>Simulated payment: no real money is transferred. Impact figures are estimates from category assumptions, not measurements.</p>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="text-ink font-sans text-sm font-semibold">{g.title}</h2>
            <ul className="mt-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link className="text-muted hover:text-ink inline-flex min-h-10 items-center" href={l.href}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  )
}
