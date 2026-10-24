import Link from 'next/link'
import type { ReactNode } from 'react'

/** Shared layout for public reading pages: a measured column, clear heading order, optional notice. */
export function ContentPage({ title, lead, updated, children }: { title: string; lead: ReactNode; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="border-line border-b pb-8">
        <h1 className="text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.05]">{title}</h1>
        <p className="text-muted mt-4 text-lg sm:text-xl">{lead}</p>
        {updated && <p className="text-muted mt-3 text-sm">Last updated {updated}</p>}
      </header>
      <div className="mt-8 space-y-10">{children}</div>
    </article>
  )
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className="scroll-mt-24">
      <h2 id={id ? `${id}-h` : undefined} className="text-2xl sm:text-3xl">
        {title}
      </h2>
      <div className="[&_a]:text-forest mt-3 space-y-3 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  )
}

export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="border-amber/30 bg-amber-tint text-ink rounded-card border p-5">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-[0.95rem]">{children}</div>
    </aside>
  )
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="divide-line border-line divide-y border-y">
      {items.map((item) => (
        <details key={item.q} className="group py-1">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-2 font-medium [&::-webkit-details-marker]:hidden">
            {item.q}
            <span aria-hidden="true" className="text-muted text-xl transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="text-muted [&_a]:text-forest space-y-2 pb-4 [&_a]:font-medium [&_a]:underline">{item.a}</div>
        </details>
      ))}
    </div>
  )
}

export function NextLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <nav aria-label="Related pages" className="border-line border-t pt-6">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-forest inline-flex min-h-11 items-center font-medium underline underline-offset-4">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
