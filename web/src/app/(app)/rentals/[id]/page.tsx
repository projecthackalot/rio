import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronLeft } from 'lucide-react'
import { HandoverCodePanel } from '@/components/handover/handover-code-panel'
import { ActionButton } from '@/components/ui/action-button'
import { SandboxBadge, StatusBadge } from '@/components/ui/badges'
import { ButtonLink } from '@/components/ui/button'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { formatINR } from '@/domain/money'
import { currentPricePaise } from '@/domain/pricing'
import { RENTAL_PERIODS, RENT_TO_OWN_CREDIT_BPS, quoteRentToOwn, settleDeposit } from '@/domain/rental'
import { requireViewer } from '@/lib/auth/dal'
import { getNames, getRental } from '@/lib/data/activity'
import { formatDateTime, formatTime } from '@/lib/format'
import { cancelRentalAction, convertRentalAction } from '../../actions'
import { z } from 'zod'
import { requestNow } from '@/lib/time'

export const metadata: Metadata = { title: 'Rental' }

type Params = Promise<{ id: string }>
type SP = Promise<Record<string, string | string[] | undefined>>

export default function RentalPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Rental params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Rental({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const viewer = await requireViewer(`/rentals/${id}`)
  if (!z.uuid().safeParse(id).success) notFound()
  const rental = await getRental(id)
  if (!rental) notFound()
  const names = await getNames([rental.renter_id, rental.listing.owner_id])
  const isRenter = rental.renter_id === viewer.id
  const isOwner = rental.listing.owner_id === viewer.id
  const now = await requestNow()
  const current = currentPricePaise(
    {
      startPaise: rental.listing.start_price_paise,
      floorPaise: rental.listing.floor_price_paise,
      listedAt: new Date(rental.listing.listed_at),
      departureAt: rental.listing.departure_at ? new Date(rental.listing.departure_at) : null,
    },
    now,
  )
  const rto = quoteRentToOwn(current, rental.listing.floor_price_paise, rental.rent_paise)
  const damage = settleDeposit(rental.deposit_paise, true)

  return (
    <div className="space-y-8">
      <Link href="/activity#rentals" className="text-muted hover:text-ink inline-flex min-h-11 items-center gap-1 text-sm font-medium">
        <ChevronLeft aria-hidden="true" className="size-4" /> My activity
      </Link>
      {sp.notice === 'booked' && (
        <Notice tone="success" title="Rental booked. Rent and deposit are held (sandbox).">
          Meet the owner to collect it. They’ll show a pickup code for you to scan on the Handover page.
        </Notice>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted">{RENTAL_PERIODS[rental.period].label} rental</p>
          <h1 className="text-4xl">
            <Link href={`/items/${rental.listing.id}`} className="hover:underline">
              {rental.listing.title}
            </Link>
          </h1>
          <p className="text-muted mt-2">
            {isRenter ? `From ${names.get(rental.listing.owner_id) ?? 'the owner'}` : `Rented by ${names.get(rental.renter_id) ?? 'a student'}`}
          </p>
        </div>
        <StatusBadge status={rental.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="money-heading" className="rounded-card border-line bg-chalk border p-5">
          <div className="flex items-center justify-between">
            <h2 id="money-heading" className="font-sans text-base font-semibold">
              Payments
            </h2>
            <SandboxBadge />
          </div>
          <dl className="divide-line mt-3 divide-y text-sm">
            <Row term="Rent" value={formatINR(rental.rent_paise)} note={rental.picked_up_at ? 'Paid to the owner at pickup' : 'Held until pickup'} />
            <Row
              term="Deposit"
              value={formatINR(rental.deposit_paise)}
              note={rental.status === 'RETURNED' || rental.status === 'CONVERTED' ? 'Settled' : 'Held, refundable on return'}
            />
            {rental.damage_deduction_paise > 0 && (
              <Row term="Damage deduction" value={`−${formatINR(rental.damage_deduction_paise)}`} note="Decided by a warden" />
            )}
            {rental.converted_price_paise && <Row term="Bought for" value={formatINR(rental.converted_price_paise)} note="Rent-to-own" />}
          </dl>
          <dl className="text-muted mt-4 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Booked</dt>
              <dd className="tabular">{formatDateTime(rental.booked_at)}</dd>
            </div>
            {rental.picked_up_at && (
              <div className="flex justify-between gap-4">
                <dt>Picked up</dt>
                <dd className="tabular">{formatDateTime(rental.picked_up_at)}</dd>
              </div>
            )}
            {rental.due_at && (
              <div className="flex justify-between gap-4">
                <dt>Due back</dt>
                <dd className="tabular text-ink font-medium">{formatDateTime(rental.due_at)}</dd>
              </div>
            )}
            {rental.returned_at && (
              <div className="flex justify-between gap-4">
                <dt>Returned</dt>
                <dd className="tabular">{formatDateTime(rental.returned_at)}</dd>
              </div>
            )}
          </dl>
          {rental.status === 'ACTIVE' && (
            <p className="text-muted mt-4 text-sm">
              If damage is reported on return, a warden decides. The most that can be deducted is 25% of the deposit ({formatINR(damage.deductionPaise)}).
            </p>
          )}
        </section>

        {rental.status === 'ACTIVE' && isRenter && (
          <section aria-labelledby="rto-heading" className="rounded-card border-forest/20 bg-forest-tint text-forest-strong border p-5">
            <h2 id="rto-heading" className="font-sans text-base font-semibold">
              Keep it: rent-to-own
            </h2>
            <p className="mt-1 text-sm">{RENT_TO_OWN_CREDIT_BPS / 100}% of the rent you paid comes off today’s price, but never below the seller’s floor.</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Line term={`Current price (as of ${formatTime(now)})`} value={formatINR(rto.currentPricePaise)} />
              <Line
                term={`Credit earned (${RENT_TO_OWN_CREDIT_BPS / 100}% of ${formatINR(rto.rentPaidPaise)})`}
                value={`−${formatINR(rto.earnedCreditPaise)}`}
              />
              {rto.floorApplied && <Line term="Floor applies; credit capped at" value={`−${formatINR(rto.appliedCreditPaise)}`} />}
              <Line term={`Seller’s floor`} value={formatINR(rto.floorPaise)} muted />
              <div className="border-forest/20 flex justify-between gap-4 border-t pt-2 text-base font-semibold">
                <dt>You pay</dt>
                <dd className="tabular">{formatINR(rto.buyPricePaise)}</dd>
              </div>
              <Line term="Deposit refunded" value={`+${formatINR(rental.deposit_paise)}`} />
            </dl>
            <div className="mt-4">
              <ActionButton
                action={convertRentalAction.bind(null, rental.id, rental.listing.id)}
                label={`Buy for about ${formatINR(rto.buyPricePaise)}`}
                confirm={{
                  title: 'Buy this item?',
                  confirmLabel: 'Buy it',
                  body: 'The final price is recalculated by the server at the moment you confirm, using the same rule shown here. Your deposit is refunded in the same step.',
                }}
              />
            </div>
          </section>
        )}
      </div>

      <section aria-labelledby="next-heading" className="space-y-4">
        <h2 id="next-heading" className="text-2xl">
          Next step
        </h2>
        {rental.status === 'PENDING_PICKUP' && isOwner && <HandoverCodePanel purpose="RENTAL_PICKUP" subjectId={rental.id} />}
        {rental.status === 'PENDING_PICKUP' && isRenter && (
          <p>
            When you collect the item, scan the owner’s pickup code on the{' '}
            <Link href="/handover" className="text-forest font-medium underline underline-offset-4">
              Handover
            </Link>{' '}
            page.
          </p>
        )}
        {rental.status === 'ACTIVE' && isRenter && <HandoverCodePanel purpose="RENTAL_RETURN" subjectId={rental.id} />}
        {rental.status === 'ACTIVE' && isOwner && (
          <p>
            When the item comes back, scan the renter’s return code on the{' '}
            <Link href="/handover" className="text-forest font-medium underline underline-offset-4">
              Handover
            </Link>{' '}
            page. You can report damage there.
          </p>
        )}
        {rental.status === 'DISPUTED' && <Notice tone="warning" title="A warden is reviewing this rental. The deposit stays held until they decide." />}
        {['RETURNED', 'CANCELLED', 'CONVERTED'].includes(rental.status) && <p className="text-muted">This rental is closed.</p>}

        {rental.status === 'PENDING_PICKUP' && (
          <ActionButton
            action={cancelRentalAction.bind(null, rental.id, rental.listing.id)}
            label="Cancel rental"
            variant="ghost"
            confirm={{
              title: 'Cancel this rental?',
              confirmLabel: 'Cancel rental',
              body: 'Rent and deposit go back to the renter, and the item returns to the marketplace.',
            }}
          />
        )}
        {(rental.status === 'PENDING_PICKUP' || rental.status === 'ACTIVE') && (
          <ButtonLink href={`/disputes/new?rental=${rental.id}`} variant="ghost">
            Report a problem
          </ButtonLink>
        )}
      </section>
    </div>
  )
}

function Row({ term, value, note }: { term: string; value: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
      <dt className="font-medium">{term}</dt>
      <dd className="text-right">
        <span className="tabular font-semibold">{value}</span>
        <span className="text-muted block text-xs">{note}</span>
      </dd>
    </div>
  )
}

function Line({ term, value, muted }: { term: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${muted ? 'opacity-80' : ''}`}>
      <dt>{term}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  )
}
