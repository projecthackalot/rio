import type { Metadata } from 'next'
import { isFrameworkError } from '@/lib/errors'
import { DataUnavailable } from '@/components/ui/data-unavailable'
import Link from 'next/link'
import { Suspense } from 'react'
import { SearchX, SlidersHorizontal } from 'lucide-react'
import { ListingCard } from '@/components/listings/listing-card'
import { ListingGridSkeleton } from '@/components/listings/listing-grid-skeleton'
import { ButtonLink, buttonClass } from '@/components/ui/button'
import { Checkbox, Input, Select } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { CATEGORIES, CONDITIONS, CONDITION_KEYS } from '@/domain/catalog'
import { PAGE_SIZE, SORTS, getMarketplace, getSavedIds, parseFilters, type MarketplaceFilters } from '@/lib/data/listings'
import { Notice } from '@/components/ui/feedback'
import { formatTime } from '@/lib/format'
import { requestNow } from '@/lib/time'

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Hostel essentials from students moving out. Prices drop as each owner’s departure nears.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default function MarketplacePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl">Marketplace</h1>
          <p className="text-muted mt-3 text-lg">
            Everything here is already on campus. Prices fall towards each seller’s floor as their departure gets closer.
          </p>
        </div>
        <ButtonLink href="/sell/new" variant="secondary">
          List an item
        </ButtonLink>
      </div>
      <Suspense fallback={<MarketplaceFallback />}>
        <MarketplaceResults searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

function MarketplaceFallback() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="hidden lg:block" />
      <ListingGridSkeleton />
    </div>
  )
}

async function MarketplaceResults({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseFilters(await searchParams)
  const now = await requestNow()
  let result: Awaited<ReturnType<typeof getMarketplace>>
  try {
    result = await getMarketplace(filters, now)
  } catch (error) {
    // Framework control-flow errors carry a digest and must propagate.
    if (isFrameworkError(error)) throw error
    console.error('[marketplace]', error instanceof Error ? error.message : 'query failed')
    return (
      <DataUnavailable title="Listings couldn’t be loaded" retryHref={`/marketplace${queryString(filters)}`}>
        The marketplace database didn’t respond as expected. This is a problem on our side, not with your search.
      </DataUnavailable>
    )
  }
  const { items, total } = result
  const savedIds = await getSavedIds(items.map((i) => i.id))
  const returnTo = `/marketplace${queryString(filters)}`
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const active = activeFilterCount(filters)

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Phones and tablets: a collapsible panel. Desktop: an always-visible sidebar. */}
      <aside aria-label="Filters" className="min-w-0">
        <details className="group rounded-card border-line bg-chalk border lg:hidden" open={active > 0 ? true : undefined}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-medium [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal aria-hidden="true" className="size-4" /> Filters{active ? ` (${active} on)` : ''}
            </span>
            <span className="text-muted text-sm group-open:hidden">Show</span>
            <span className="text-muted hidden text-sm group-open:inline">Hide</span>
          </summary>
          <FilterForm filters={filters} idPrefix="m-" />
        </details>
        <div className="hidden lg:block">
          <FilterForm filters={filters} idPrefix="d-" />
        </div>
      </aside>

      <section aria-labelledby="results-heading" className="min-w-0">
        <CategoryChips filters={filters} />
        {filters.rangeSwapped && (
          <Notice className="mb-4" tone="info" title={`Showing ₹${filters.min} to ₹${filters.max}`}>
            The minimum price was higher than the maximum, so we swapped them.
          </Notice>
        )}
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results-heading" className="text-muted font-sans text-base font-medium" aria-live="polite">
            {total === 0 ? 'No items found' : `${total} ${total === 1 ? 'item' : 'items'} available`}
          </h2>
          <p className="text-muted text-sm">Prices as of {formatTime(now)}</p>
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon={<SearchX aria-hidden="true" className="size-6" />}
            title={active ? 'Nothing matches those filters' : 'Nothing listed yet'}
            action={
              active ? (
                <Link href="/marketplace" className={buttonClass('secondary')}>
                  Clear filters
                </Link>
              ) : (
                <Link href="/sell/new" className={buttonClass()}>
                  List the first item
                </Link>
              )
            }
          >
            {active ? 'Try a wider price range or a different category.' : 'When students list things they’re leaving behind, they’ll show up here.'}
          </EmptyState>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.id} className="flex">
                <ListingCard item={item} now={now} save={{ saved: savedIds.has(item.id), returnTo }} />
              </li>
            ))}
          </ul>
        )}
        <Pagination
          page={filters.page}
          pageCount={pageCount}
          basePath="/marketplace"
          params={{
            q: filters.q,
            category: filters.category,
            condition: filters.condition,
            min: filters.min?.toString(),
            max: filters.max?.toString(),
            rentable: filters.rentable ? '1' : undefined,
            sort: filters.sort === 'ending' ? undefined : filters.sort,
          }}
        />
      </section>
    </div>
  )
}

/** Query string for the current filters (used for sign-in return and chip links). */
function queryString(f: MarketplaceFilters, override: Partial<Record<'category' | 'page', string | undefined>> = {}): string {
  const qs = new URLSearchParams()
  const set = (k: string, v: string | undefined) => v && qs.set(k, v)
  set('q', f.q)
  set('category', 'category' in override ? override.category : f.category)
  set('condition', f.condition)
  set('min', f.min?.toString())
  set('max', f.max?.toString())
  set('rentable', f.rentable ? '1' : undefined)
  set('sort', f.sort === 'ending' ? undefined : f.sort)
  set('page', 'page' in override ? override.page : f.page > 1 ? String(f.page) : undefined)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** One-tap category shortcuts. Horizontally scrollable on phones; keeps the other filters. */
function CategoryChips({ filters }: { filters: MarketplaceFilters }) {
  const chip = 'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap'
  const on = 'border-forest bg-forest text-chalk'
  const off = 'border-line bg-chalk text-ink hover:border-line-strong'
  return (
    <nav aria-label="Categories" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 pb-1">
        <li>
          <Link
            href={`/marketplace${queryString(filters, { category: undefined, page: undefined })}`}
            aria-current={filters.category ? undefined : 'true'}
            className={`${chip} ${filters.category ? off : on}`}
          >
            All
          </Link>
        </li>
        {CATEGORIES.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/marketplace${queryString(filters, { category: c.slug, page: undefined })}`}
              aria-current={filters.category === c.slug ? 'true' : undefined}
              className={`${chip} ${filters.category === c.slug ? on : off}`}
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function activeFilterCount(f: MarketplaceFilters) {
  return [f.q, f.category, f.condition, f.min, f.max, f.rentable || undefined].filter((v) => v !== undefined).length
}

/** Rendered twice (phone panel + desktop sidebar), so element ids are prefixed per instance. */
function FilterForm({ filters, idPrefix }: { filters: MarketplaceFilters; idPrefix: string }) {
  const id = (name: string) => `${idPrefix}${name}`
  return (
    <form
      method="get"
      action="/marketplace"
      role="search"
      aria-labelledby={id('filters-heading')}
      className="border-line space-y-5 border-t p-4 lg:border-0 lg:p-0"
    >
      <h2 id={id('filters-heading')} className="sr-only lg:not-sr-only lg:font-sans lg:text-base lg:font-semibold">
        Filters
      </h2>
      <div className="space-y-1.5">
        <label htmlFor={id('q')} className="block text-sm font-medium">
          Search
        </label>
        <Input id={id('q')} name="q" type="search" defaultValue={filters.q} placeholder="cooler, mattress…" maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={id('category')} className="block text-sm font-medium">
          Category
        </label>
        <Select id={id('category')} name="category" defaultValue={filters.category ?? ''}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={id('condition')} className="block text-sm font-medium">
          Condition
        </label>
        <Select id={id('condition')} name="condition" defaultValue={filters.condition ?? ''}>
          <option value="">Any condition</option>
          {CONDITION_KEYS.map((k) => (
            <option key={k} value={k}>
              {CONDITIONS[k].label}
            </option>
          ))}
        </Select>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Current price (₹)</legend>
        <div className="flex items-center gap-2">
          <label htmlFor={id('min')} className="sr-only">
            Minimum price in rupees
          </label>
          <Input id={id('min')} name="min" type="number" inputMode="numeric" min={0} max={100000} placeholder="Min" defaultValue={filters.min} />
          <span aria-hidden="true" className="text-muted">
            to
          </span>
          <label htmlFor={id('max')} className="sr-only">
            Maximum price in rupees
          </label>
          <Input id={id('max')} name="max" type="number" inputMode="numeric" min={0} max={100000} placeholder="Max" defaultValue={filters.max} />
        </div>
      </fieldset>
      <Checkbox name="rentable" value="1" defaultChecked={filters.rentable} label="Available to rent" />
      <div className="space-y-1.5">
        <label htmlFor={id('sort')} className="block text-sm font-medium">
          Sort by
        </label>
        <Select id={id('sort')} name="sort" defaultValue={filters.sort}>
          {Object.entries(SORTS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass('primary', 'md', 'flex-1')}>
          Apply filters
        </button>
        <Link href="/marketplace" className={buttonClass('ghost')}>
          Reset
        </Link>
      </div>
    </form>
  )
}
