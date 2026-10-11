import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronLeft, Leaf, MapPin } from 'lucide-react'
import { CategoryArt } from '@/components/brand/category-art'
import { PriceTag } from '@/components/brand/price-tag'
import { ActionButton } from '@/components/ui/action-button'
import { Badge, SandboxBadge, StatusBadge, UrgencyBadge } from '@/components/ui/badges'
import { ButtonLink } from '@/components/ui/button'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { CONDITIONS } from '@/domain/catalog'
import { estimateRentalImpact, estimateTransferImpact, formatKg, hasImpactEstimate } from '@/domain/impact'
import { formatINR } from '@/domain/money'
import {
  DECAY_END_BEFORE_DEPARTURE_MS,
  STAFF_CUTOFF_BEFORE_DEPARTURE_MS,
  currentPricePaise,
  isStaffRoutable,
  isWithinTradingWindow,
  urgency,
} from '@/domain/pricing'
import { DAMAGE_DEDUCTION_BPS, RENTAL_PERIODS, RENTAL_PERIOD_KEYS, RENT_TO_OWN_CREDIT_BPS, canRentBeforeDeparture, quoteRental } from '@/domain/rental'
import { getViewer, hasRole, type Viewer } from '@/lib/auth/dal'
import { getMyInvolvement } from '@/lib/data/activity'
import { getListing, getOwnerName, type ListingDetail } from '@/lib/data/listings'
import { listingMediaUrl } from '@/lib/env'
import { formatDateTime, formatTime } from '@/lib/format'
import { claimListingAction, routeToStaffAction, setAvailabilityAction, startRentalAction } from '../../actions'
import { requestNow } from '@/lib/time'

type Params = Promise<{ id: string }>

export const metadata: Metadata = { title: 'Item' }

export default function ItemPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ItemSkeleton />}>
      <Item params={params} />
    </Suspense>
  )
}

function ItemSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]" aria-busy="true">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-1/2" />
      </div>
    </div>
  )
}

async function Item({ params }: { params: Params }) {
  const { id } = await params
  const [listing, viewer] = await Promise.all([getListing(id), getViewer()])
  if (!listing) notFound()
  const now = await requestNow()
  const [ownerName, involvement] = await Promise.all([
    viewer ? getOwnerName(listing.owner_id) : Promise.resolve(null),
    viewer ? getMyInvolvement(listing.id, viewer.id) : Promise.resolve(null),
  ])

  const dep = listing.departure_at ? new Date(listing.departure_at).getTime() : null
  const current = currentPricePaise(
    { startPaise: listing.start_price_paise, floorPaise: listing.floor_price_paise, listedAt: new Date(listing.listed_at), departureAt: dep },
    now,
  )
  const isOwner = viewer?.id === listing.owner_id

  return (
    <article>
      <Link href="/marketplace" className="text-muted hover:text-ink inline-flex min-h-11 items-center gap-1 text-sm font-medium">
        <ChevronLeft aria-hidden="true" className="size-4" /> Marketplace
      </Link>
      <div className="mt-2 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
        <Gallery listing={listing} />

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap gap-2">
              {listing.status !== 'ACTIVE' && <StatusBadge status={listing.status} />}
              {listing.status === 'ACTIVE' && <UrgencyBadge urgency={urgency(dep, now)} />}
              <Badge>{CONDITIONS[listing.condition].label}</Badge>
              {listing.is_rentable && <Badge tone="forest">Also for rent</Badge>}
            </div>
            <h1 className="mt-3 text-4xl">{listing.title}</h1>
            <p className="text-muted mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{listing.category.name}</span>
              {listing.hostel && (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-4" /> {listing.hostel.name}
                </span>
              )}
              {ownerName && <span>Listed by {isOwner ? 'you' : ownerName}</span>}
            </p>
          </div>

          <PriceTag
            size="detail"
            currentPaise={current}
            startPaise={listing.start_price_paise}
            floorPaise={listing.floor_price_paise}
            listedAt={listing.listed_at}
            departureAt={listing.departure_at}
            now={now}
          />
          <p className="text-muted -mt-3 text-sm">Price as of {formatTime(now)}. The exact price is fixed by the server at the moment you claim.</p>

          <ActionsPanel listing={listing} viewer={viewer} now={now} currentPaise={current} involvement={involvement} />

          <Timeline listing={listing} />
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-2xl">
            About this item
          </h2>
          <p className="mt-3 whitespace-pre-line">{listing.description || 'The owner hasn’t added a description.'}</p>
          <p className="text-muted mt-4 text-sm">
            Condition: <span className="text-ink font-medium">{CONDITIONS[listing.condition].label}</span>. {CONDITIONS[listing.condition].description}
          </p>
        </section>
        <div className="space-y-8">
          {listing.is_rentable && <RentalTerms startPaise={listing.start_price_paise} />}
          <ImpactPanel slug={listing.category_slug} rentable={listing.is_rentable} />
        </div>
      </div>
    </article>
  )
}

function Gallery({ listing }: { listing: ListingDetail }) {
  if (!listing.media.length) {
    return <CategoryArt slug={listing.category_slug} label={listing.category.name} className="rounded-card aspect-[4/3] w-full" />
  }
  const [first, ...rest] = listing.media
  return (
    <div className="space-y-3">
      <div className="rounded-card bg-forest-tint relative aspect-[4/3] overflow-hidden">
        <Image src={listingMediaUrl(first.storage_path)} alt={first.alt_text} fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
      </div>
      {rest.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {rest.map((m) => (
            <li key={m.id} className="rounded-media bg-forest-tint relative aspect-square overflow-hidden">
              <Image src={listingMediaUrl(m.storage_path)} alt={m.alt_text} fill sizes="(min-width: 1024px) 14vw, 30vw" className="object-cover" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Timeline({ listing }: { listing: ListingDetail }) {
  if (!listing.departure_at) {
    return <p className="text-muted text-sm">No departure set: this item keeps its price until the owner changes it.</p>
  }
  const dep = new Date(listing.departure_at).getTime()
  const rows = [
    ['Listed', formatDateTime(listing.listed_at)],
    ['Reaches floor price', formatDateTime(dep - DECAY_END_BEFORE_DEPARTURE_MS)],
    ['Claims close; staff routing opens', formatDateTime(dep - STAFF_CUTOFF_BEFORE_DEPARTURE_MS)],
    ['Owner departs', formatDateTime(dep)],
  ]
  return (
    <section aria-labelledby="timeline-heading" className="rounded-card border-line bg-chalk border p-5">
      <h2 id="timeline-heading" className="font-sans text-base font-semibold">
        Auction timeline
      </h2>
      <ol className="mt-3 space-y-2 text-sm">
        {rows.map(([label, when]) => (
          <li key={label} className="flex flex-wrap justify-between gap-x-4">
            <span className="text-muted">{label}</span>
            <span className="tabular font-medium">{when}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ActionsPanel({
  listing,
  viewer,
  now,
  currentPaise,
  involvement,
}: {
  listing: ListingDetail
  viewer: Viewer | null
  now: number
  currentPaise: number
  involvement: Awaited<ReturnType<typeof getMyInvolvement>> | null
}) {
  const dep = listing.departure_at ? new Date(listing.departure_at).getTime() : null
  const trading = isWithinTradingWindow(dep, now)

  if (!viewer) {
    return (
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={`/auth/login?next=/items/${listing.id}`} size="lg">
          Sign in to claim
        </ButtonLink>
        <ButtonLink href={`/auth/signup?next=/items/${listing.id}`} variant="secondary" size="lg">
          Create account
        </ButtonLink>
      </div>
    )
  }

  if (viewer.id === listing.owner_id) {
    return (
      <div className="rounded-card border-line bg-chalk space-y-3 border p-5">
        <p className="font-medium">This is your listing.</p>
        <div className="flex flex-wrap gap-3">
          {(listing.status === 'ACTIVE' || listing.status === 'WITHDRAWN') && (
            <ButtonLink href={`/items/${listing.id}/edit`} variant="secondary">
              Edit listing
            </ButtonLink>
          )}
          {listing.status === 'ACTIVE' && (
            <ActionButton
              action={setAvailabilityAction.bind(null, listing.id, false)}
              label="Hide from marketplace"
              variant="ghost"
              confirm={{
                title: 'Hide this listing?',
                body: 'Buyers won’t see it until you put it back. You can relist any time before your final hour.',
                confirmLabel: 'Hide listing',
              }}
            />
          )}
          {listing.status === 'WITHDRAWN' && trading && (
            <ActionButton action={setAvailabilityAction.bind(null, listing.id, true)} label="Put back on the marketplace" variant="primary" />
          )}
        </div>
        {listing.status !== 'ACTIVE' && listing.status !== 'WITHDRAWN' && (
          <p className="text-muted text-sm">
            Manage handovers for this item in{' '}
            <Link href="/activity" className="text-forest font-medium underline underline-offset-4">
              My activity
            </Link>
            .
          </p>
        )}
      </div>
    )
  }

  if (involvement?.claim?.mine || involvement?.rental?.mine) {
    return (
      <Notice tone="info" title={involvement.claim?.mine ? 'You’ve claimed this item.' : 'You’re renting this item.'}>
        Next steps and your handover code are in{' '}
        <Link href={involvement.rental?.mine ? `/rentals/${involvement.rental.id}` : '/activity'} className="font-medium underline underline-offset-4">
          {involvement.rental?.mine ? 'your rental' : 'My activity'}
        </Link>
        .
      </Notice>
    )
  }

  if (hasRole(viewer, ['warden']) && viewer.role !== 'student') {
    return isStaffRoutable(dep, now) && listing.status === 'ACTIVE' ? (
      <ActionButton action={routeToStaffAction.bind(null, listing.id)} label="Route to campus staff" variant="clay" />
    ) : (
      <p className="text-muted text-sm">Wardens and staff can’t buy or rent. Staff routing opens in the owner’s final hour.</p>
    )
  }
  if (viewer.role !== 'student') {
    return <p className="text-muted text-sm">Only student accounts can buy or rent items.</p>
  }

  if (listing.status !== 'ACTIVE') {
    return <Notice tone="info" title="This item isn’t available right now." />
  }
  if (!trading) {
    return (
      <Notice tone="warning" title="Trading has closed for this item.">
        The owner leaves within the hour, so it goes to campus staff instead of being sold.
      </Notice>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          action={claimListingAction.bind(null, listing.id)}
          label={`Claim for ${formatINR(currentPaise)}`}
          size="lg"
          pendingLabel="Claiming…"
          confirm={{
            title: 'Claim this item?',
            confirmLabel: 'Claim and hold payment',
            body: (
              <div className="space-y-2">
                <p>
                  About <strong className="text-ink">{formatINR(currentPaise)}</strong> of sandbox money will be held in escrow. The exact amount is set the
                  moment you confirm.
                </p>
                <p>The seller is paid only when you scan their handover code. You can cancel before then for a full refund.</p>
              </div>
            ),
          }}
        />
        <SandboxBadge />
      </div>
      {listing.is_rentable && <RentForm listing={listing} now={now} />}
    </div>
  )
}

function RentForm({ listing, now }: { listing: ListingDetail; now: number }) {
  const dep = listing.departure_at ? new Date(listing.departure_at).getTime() : null
  const options = RENTAL_PERIOD_KEYS.map((p) => ({ p, quote: quoteRental(listing.start_price_paise, p), eligible: canRentBeforeDeparture(dep, now, p) }))
  const firstEligible = options.find((o) => o.eligible.ok)?.p
  if (!firstEligible) {
    return (
      <p className="text-muted text-sm">Renting isn’t possible any more: the owner leaves too soon for even a one-day rental plus the 24-hour return buffer.</p>
    )
  }
  return (
    <div className="rounded-card border-line bg-chalk border p-5">
      <ActionButton action={startRentalAction.bind(null, listing.id)} label="Rent instead" variant="secondary" pendingLabel="Booking…">
        <fieldset className="mb-4">
          <legend className="font-semibold">Rent instead</legend>
          <p className="text-muted mt-1 text-sm">Rent and deposit are held now; rent goes to the owner at pickup. The deposit comes back when you return it.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {options.map(({ p, quote, eligible }) => (
              <label
                key={p}
                className="border-line-strong has-[:checked]:border-forest has-[:checked]:bg-forest-tint flex min-h-11 cursor-pointer flex-col rounded-lg border p-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <span className="flex items-center gap-2 font-medium">
                  <input type="radio" name="period" value={p} defaultChecked={p === firstEligible} disabled={!eligible.ok} className="accent-forest" />
                  {RENTAL_PERIODS[p].label}
                </span>
                <span className="tabular mt-1 text-sm">
                  {formatINR(quote.rentPaise)} rent + {formatINR(quote.depositPaise)} deposit
                </span>
                {!eligible.ok && <span className="text-clay mt-1 text-xs">Owner leaves too soon</span>}
              </label>
            ))}
          </div>
        </fieldset>
      </ActionButton>
    </div>
  )
}

function RentalTerms({ startPaise }: { startPaise: number }) {
  return (
    <section aria-labelledby="rent-heading" className="rounded-card border-line bg-chalk border p-5">
      <h2 id="rent-heading" className="font-sans text-base font-semibold">
        Rental terms
      </h2>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Rental prices by period</caption>
        <thead>
          <tr className="text-muted text-left">
            <th scope="col" className="py-1 font-medium">
              Period
            </th>
            <th scope="col" className="py-1 font-medium">
              Rent
            </th>
            <th scope="col" className="py-1 font-medium">
              Deposit
            </th>
          </tr>
        </thead>
        <tbody>
          {RENTAL_PERIOD_KEYS.map((p) => {
            const q = quoteRental(startPaise, p)
            return (
              <tr key={p} className="border-line border-t">
                <th scope="row" className="py-2 text-left font-medium">
                  {RENTAL_PERIODS[p].label}
                </th>
                <td className="tabular py-2">{formatINR(q.rentPaise)}</td>
                <td className="tabular py-2">{formatINR(q.depositPaise)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <ul className="text-muted mt-3 space-y-1 text-sm">
        <li>Like it? Buy it while renting: {RENT_TO_OWN_CREDIT_BPS / 100}% of the rent you paid comes off the current price, never below the floor.</li>
        <li>Damage on return can cost up to {DAMAGE_DEDUCTION_BPS / 100}% of the deposit, decided by a warden.</li>
      </ul>
    </section>
  )
}

function ImpactPanel({ slug, rentable }: { slug: string; rentable: boolean }) {
  if (!hasImpactEstimate(slug)) return null
  const sale = estimateTransferImpact(slug)
  const rental = estimateRentalImpact(slug)
  return (
    <section aria-labelledby="impact-heading" className="rounded-card border-forest/20 bg-forest-tint text-forest-strong border p-5">
      <h2 id="impact-heading" className="flex items-center gap-2 font-sans text-base font-semibold">
        <Leaf aria-hidden="true" className="size-4" /> Estimated impact
      </h2>
      <p className="mt-2 text-sm">
        Buying this instead of new avoids about <strong>{formatKg(sale.co2eAvoidedKg)} CO₂e</strong> and keeps {formatKg(sale.wasteDivertedKg)} out of waste.
        {rentable && <> A completed rental is estimated at {formatKg(rental.co2eAvoidedKg)} CO₂e.</>}
      </p>
      <p className="mt-2 text-xs">Estimates from category averages, not measurements of this item.</p>
    </section>
  )
}
