import Link from 'next/link'
import { isFrameworkError } from '@/lib/errors'
import { Search } from 'lucide-react'
import { CategoryArt } from '@/components/brand/category-art'
import { ListingCard } from '@/components/listings/listing-card'
import { buttonClass } from '@/components/ui/button'
import { CATEGORIES } from '@/domain/catalog'
import { getMarketplace, parseFilters } from '@/lib/data/listings'
import { requestNow } from '@/lib/time'

/** Plain GET form: works without JavaScript and lands on the marketplace with the query in the URL. */
export function HomeSearch() {
  return (
    <form method="get" action="/marketplace" role="search" className="flex w-full max-w-xl gap-2">
      <label htmlFor="home-q" className="sr-only">
        Search items
      </label>
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
        <input
          id="home-q"
          name="q"
          type="search"
          maxLength={80}
          placeholder="Search items"
          className="border-line-strong bg-chalk placeholder:text-muted/80 block min-h-12 w-full rounded-lg border py-2.5 pr-3 pl-10 text-base"
        />
      </div>
      <button type="submit" className={buttonClass('primary', 'lg', 'shrink-0')}>
        Search
      </button>
    </form>
  )
}

export function CategoryShortcuts() {
  return (
    <section aria-labelledby="cat-heading" className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
      <h2 id="cat-heading" className="text-2xl sm:text-3xl">
        Browse by category
      </h2>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map((c) => (
          <li key={c.slug} className="min-w-0">
            <Link
              href={`/marketplace?category=${c.slug}`}
              className="border-line bg-chalk hover:border-line-strong rounded-card flex h-full flex-col overflow-hidden border"
            >
              <CategoryArt slug={c.slug} label={c.name} className="aspect-[4/3] w-full" decorative />
              <span className="p-3 text-sm leading-snug font-medium">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Real listings whose owners leave soonest. Renders nothing when there are no
 * listings or the database is unreachable — never placeholder items.
 */
export async function LeavingSoon() {
  let items: Awaited<ReturnType<typeof getMarketplace>>['items'] = []
  let now = 0
  try {
    now = await requestNow()
    items = (await getMarketplace(parseFilters({ sort: 'ending' }), now)).items.slice(0, 4)
  } catch (error) {
    // Framework control-flow errors carry a digest and must propagate; data errors just hide the section.
    if (isFrameworkError(error)) throw error
    return null
  }
  if (!items.length) return null
  return (
    <section aria-labelledby="soon-heading" className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="soon-heading" className="text-2xl sm:text-3xl">
          Leaving soonest
        </h2>
        <Link href="/marketplace" className="text-forest font-medium underline underline-offset-4">
          See everything
        </Link>
      </div>
      <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id} className="flex min-w-0">
            <ListingCard item={item} now={now} />
          </li>
        ))}
      </ul>
    </section>
  )
}
