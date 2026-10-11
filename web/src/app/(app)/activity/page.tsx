import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { HandoverCodePanel } from '@/components/handover/handover-code-panel'
import { ListingCard } from '@/components/listings/listing-card'
import { ActionButton } from '@/components/ui/action-button'
import { SandboxBadge, StatusBadge } from '@/components/ui/badges'
import { ButtonLink } from '@/components/ui/button'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { formatINR, formatSignedINR } from '@/domain/money'
import { RENTAL_PERIODS } from '@/domain/rental'
import { requireViewer } from '@/lib/auth/dal'
import { getActivity, getNames, type ClaimRow, type RentalRow } from '@/lib/data/activity'
import { getMyListings } from '@/lib/data/listings'
import { getLedger, getWalletBalance } from '@/lib/data/wallet'
import { formatDateTime } from '@/lib/format'
import { cancelClaimAction } from '../actions'
import { requestNow } from '@/lib/time'

export const metadata: Metadata = { title: 'My activity' }

type SP = Promise<Record<string, string | string[] | undefined>>

const LEDGER_LABELS: Record<string, string> = {
  OPENING_CREDIT: 'Sandbox opening credit',
  MIGRATED_BALANCE: 'Migrated sandbox balance',
  CLAIM_HOLD: 'Purchase held in escrow',
  CLAIM_REFUND: 'Escrow refunded',
  SALE_PAYOUT: 'Sale payout',
  RENT_CHARGE: 'Rent held',
  RENT_REFUND: 'Rent refunded',
  RENT_PAYOUT: 'Rental income',
  DEPOSIT_HOLD: 'Deposit held',
  DEPOSIT_REFUND: 'Deposit refunded',
  DAMAGE_PAYOUT: 'Damage deduction received',
  RTO_CHARGE: 'Rent-to-own purchase',
  RTO_PAYOUT: 'Rent-to-own sale',
}

export default function ActivityPage({ searchParams }: { searchParams: SP }) {
  return (
    <div>
      <h1 className="text-4xl sm:text-5xl">My activity</h1>
      <p className="text-muted mt-3 max-w-2xl">Purchases, sales, rentals and every sandbox transaction, in one place.</p>
      <Suspense fallback={<ActivitySkeleton />}>
        <Activity searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="mt-8 space-y-6" aria-busy="true">
      <Skeleton className="h-40" />
      <Skeleton className="h-64" />
    </div>
  )
}

async function Activity({ searchParams }: { searchParams: SP }) {
  const viewer = await requireViewer('/activity')
  const [sp, activity, listings, balance, ledger] = await Promise.all([
    searchParams,
    getActivity(viewer.id),
    getMyListings(viewer.id),
    getWalletBalance(),
    getLedger(100),
  ])
  const names = await getNames([
    ...activity.sold.map((c) => c.claimer_id),
    ...activity.bought.map((c) => c.listing.owner_id),
    ...activity.lending.map((r) => r.renter_id),
  ])
  const now = await requestNow()

  return (
    <div className="mt-8 space-y-12">
      {sp.notice === 'claimed' && (
        <Notice tone="success" title="Claimed. Payment is held in sandbox escrow.">
          Arrange a time with the seller. When you meet, scan their handover code on the{' '}
          <Link href="/handover" className="font-medium underline underline-offset-4">
            Handover
          </Link>{' '}
          page to complete the purchase.
        </Notice>
      )}

      <Section id="buying" title="Buying">
        {activity.bought.length === 0 ? (
          <Empty>
            You haven’t claimed anything.{' '}
            <Link className="text-forest font-medium underline underline-offset-4" href="/marketplace">
              Browse the marketplace
            </Link>
            .
          </Empty>
        ) : (
          <ul className="space-y-3">
            {activity.bought.map((c) => (
              <ClaimItem key={c.id} claim={c} counterparty={names.get(c.listing.owner_id)} role="buyer" />
            ))}
          </ul>
        )}
      </Section>

      <Section id="selling" title="Selling">
        {activity.sold.length === 0 ? (
          <Empty>No one has claimed your items yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {activity.sold.map((c) => (
              <ClaimItem key={c.id} claim={c} counterparty={names.get(c.claimer_id)} role="seller" />
            ))}
          </ul>
        )}
      </Section>

      <Section id="rentals" title="Rentals">
        {activity.renting.length + activity.lending.length === 0 ? (
          <Empty>No rentals yet. Items marked “Also for rent” can be borrowed by the day, week or month.</Empty>
        ) : (
          <ul className="space-y-3">
            {activity.renting.map((r) => (
              <RentalItem key={r.id} rental={r} label="You’re renting" />
            ))}
            {activity.lending.map((r) => (
              <RentalItem key={r.id} rental={r} label={`Rented by ${names.get(r.renter_id) ?? 'a student'}`} />
            ))}
          </ul>
        )}
      </Section>

      {activity.transfers.length > 0 && (
        <Section id="transfers" title="Handed to campus staff">
          <ul className="space-y-3">
            {activity.transfers.map((t) => (
              <li key={t.id} id={`transfer-${t.id}`} className="rounded-card border-line bg-chalk border p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/items/${t.listing.id}`} className="font-semibold hover:underline">
                    {t.listing.title}
                  </Link>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-muted mt-1 text-sm">Routed to staff {formatDateTime(t.routed_at)}.</p>
                {t.status === 'PENDING' && (
                  <div className="mt-4">
                    <HandoverCodePanel purpose="STAFF_CUSTODY" subjectId={t.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        id="listings"
        title="My listings"
        action={
          <ButtonLink href="/sell/new" size="sm">
            List an item
          </ButtonLink>
        }
      >
        {listings.length === 0 ? (
          <Empty>Nothing listed yet.</Empty>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <li key={l.id} className="flex">
                <ListingCard item={l} now={now} showStatus />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="wallet" title="Sandbox wallet" action={<SandboxBadge />}>
        <div className="rounded-card border-line bg-chalk border">
          <div className="border-line flex flex-wrap items-baseline justify-between gap-2 border-b p-5">
            <p className="text-muted">Current balance</p>
            <p className="font-display tabular text-3xl font-semibold">{balance === null ? 'Unavailable' : formatINR(balance)}</p>
          </div>
          <p className="border-line bg-amber-tint/50 text-amber border-b px-5 py-3 text-sm">
            Simulated money for the Level 1 pilot. Nothing here is a real payment, payout or refund.
          </p>
          {ledger.length === 0 ? (
            <p className="text-muted p-5">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto" role="region" aria-label="Sandbox transactions (scrollable)" tabIndex={0}>
              <table className="w-full min-w-[36rem] text-sm">
                <caption className="sr-only">Sandbox transactions, newest first</caption>
                <thead>
                  <tr className="text-muted text-left">
                    <th scope="col" className="px-5 py-3 font-medium">
                      When
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      What
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-line border-t">
                      <td className="text-muted px-5 py-3 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{LEDGER_LABELS[e.type] ?? e.type}</p>
                        {e.note && <p className="text-muted">{e.note}</p>}
                      </td>
                      <td className={`tabular px-5 py-3 text-right font-medium ${e.amount_paise > 0 ? 'text-forest' : 'text-ink'}`}>
                        {formatSignedINR(e.amount_paise)}
                      </td>
                      <td className="tabular text-muted px-5 py-3 text-right">{formatINR(e.balance_after_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

function Section({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-2xl">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card border-line-strong/50 text-muted border border-dashed p-5">{children}</p>
}

function ClaimItem({ claim, counterparty, role }: { claim: ClaimRow; counterparty?: string; role: 'buyer' | 'seller' }) {
  const pending = claim.status === 'PENDING_HANDOVER'
  return (
    <li id={`claim-${claim.id}`} className="rounded-card border-line bg-chalk scroll-mt-24 border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/items/${claim.listing.id}`} className="font-semibold hover:underline">
            {claim.listing.title}
          </Link>
          <p className="text-muted text-sm">
            {role === 'buyer' ? `From ${counterparty ?? 'the seller'}` : `Claimed by ${counterparty ?? 'a student'}`}, {formatDateTime(claim.claimed_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display tabular text-xl font-semibold">{formatINR(claim.amount_paise)}</span>
          <StatusBadge status={claim.status} />
        </div>
      </div>
      {pending && (
        <div className="border-line mt-4 space-y-4 border-t pt-4">
          {role === 'seller' ? (
            <HandoverCodePanel purpose="CLAIM" subjectId={claim.id} />
          ) : (
            <p className="text-sm">
              When you meet the seller, scan their code on the{' '}
              <Link href="/handover" className="text-forest font-medium underline underline-offset-4">
                Handover
              </Link>{' '}
              page. Payment is released only then.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <ActionButton
              action={cancelClaimAction.bind(null, claim.id, claim.listing.id)}
              label="Cancel claim"
              variant="ghost"
              size="sm"
              confirm={{
                title: 'Cancel this claim?',
                confirmLabel: 'Cancel claim',
                body: `The ${formatINR(claim.amount_paise)} held in sandbox escrow goes back to the buyer and the item returns to the marketplace.`,
              }}
            />
            <ButtonLink href={`/disputes/new?claim=${claim.id}`} variant="ghost" size="sm">
              Report a problem
            </ButtonLink>
          </div>
        </div>
      )}
    </li>
  )
}

function RentalItem({ rental, label }: { rental: RentalRow; label: string }) {
  return (
    <li className="rounded-card border-line bg-chalk flex flex-wrap items-center justify-between gap-3 border p-5">
      <div>
        <Link href={`/rentals/${rental.id}`} className="font-semibold hover:underline">
          {rental.listing.title}
        </Link>
        <p className="text-muted text-sm">
          {label}, {RENTAL_PERIODS[rental.period].label.toLowerCase()} rental. {formatINR(rental.rent_paise)} rent, {formatINR(rental.deposit_paise)} deposit.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={rental.status} />
        <ButtonLink href={`/rentals/${rental.id}`} variant="secondary" size="sm">
          Open
        </ButtonLink>
      </div>
    </li>
  )
}
