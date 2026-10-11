import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ArrowUpRight, Leaf, PackageOpen, ScanLine } from 'lucide-react'
import { ListingCard } from '@/components/listings/listing-card'
import { SandboxBadge } from '@/components/ui/badges'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback'
import { estimateRentalImpact, estimateTransferImpact, formatKg, sumImpact } from '@/domain/impact'
import { formatINR } from '@/domain/money'
import { requireViewer } from '@/lib/auth/dal'
import { getActivity } from '@/lib/data/activity'
import { getMyListings } from '@/lib/data/listings'
import { getWalletBalance } from '@/lib/data/wallet'
import { formatDateTime } from '@/lib/format'
import { requestNow } from '@/lib/time'

export const metadata: Metadata = { title: 'Home' }

type SP = Promise<Record<string, string | string[] | undefined>>

export default function DashboardPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

interface Todo {
  key: string
  title: string
  detail: string
  href: string
  cta: string
}

async function Dashboard({ searchParams }: { searchParams: SP }) {
  const viewer = await requireViewer('/dashboard')
  if (viewer.role === 'warden' || viewer.role === 'admin') redirect('/warden')
  if (viewer.role === 'staff') redirect('/staff')

  const [sp, balance, activity, listings] = await Promise.all([searchParams, getWalletBalance(), getActivity(viewer.id), getMyListings(viewer.id)])
  const now = await requestNow()

  const todos: Todo[] = [
    ...activity.sold
      .filter((c) => c.status === 'PENDING_HANDOVER')
      .map((c) => ({
        key: c.id,
        title: `Hand over “${c.listing.title}”`,
        detail: `Claimed for ${formatINR(c.amount_paise)}. Meet the buyer and show your code.`,
        href: `/activity#claim-${c.id}`,
        cta: 'Show code',
      })),
    ...activity.bought
      .filter((c) => c.status === 'PENDING_HANDOVER')
      .map((c) => ({
        key: c.id,
        title: `Collect “${c.listing.title}”`,
        detail: 'Meet the seller and scan their code to complete the purchase.',
        href: '/handover',
        cta: 'Scan code',
      })),
    ...activity.lending
      .filter((r) => r.status === 'PENDING_PICKUP')
      .map((r) => ({
        key: r.id,
        title: `Lend out “${r.listing.title}”`,
        detail: 'The renter is waiting. Show your pickup code when you meet.',
        href: `/rentals/${r.id}`,
        cta: 'Show code',
      })),
    ...activity.renting
      .filter((r) => r.status === 'PENDING_PICKUP')
      .map((r) => ({
        key: r.id,
        title: `Pick up “${r.listing.title}”`,
        detail: 'Scan the owner’s pickup code to start your rental.',
        href: '/handover',
        cta: 'Scan code',
      })),
    ...activity.renting
      .filter((r) => r.status === 'ACTIVE')
      .map((r) => ({
        key: r.id,
        title: `Return “${r.listing.title}”`,
        detail: r.due_at ? `Due ${formatDateTime(r.due_at)}.` : 'Return it when you’re done.',
        href: `/rentals/${r.id}`,
        cta: 'Open rental',
      })),
    ...activity.transfers
      .filter((t) => t.status === 'PENDING')
      .map((t) => ({
        key: t.id,
        title: `Hand “${t.listing.title}” to staff`,
        detail: 'Your warden routed this unsold item to campus staff.',
        href: `/activity#transfer-${t.id}`,
        cta: 'Show code',
      })),
  ]

  const impact = sumImpact([
    ...listings.filter((l) => l.status === 'SOLD' || l.status === 'STAFF_CUSTODY').map((l) => estimateTransferImpact(l.category_slug)),
    ...activity.renting.filter((r) => r.status === 'RETURNED').map((r) => estimateRentalImpact(r.listing.category_slug)),
  ])
  const firstName = viewer.fullName.split(/\s+/)[0]

  return (
    <div className="space-y-10">
      {sp.notice === 'password-updated' && <Notice tone="success" title="Your password was updated." />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl sm:text-5xl">Hi, {firstName}</h1>
        <div className="flex gap-3">
          <ButtonLink href="/sell/new">List an item</ButtonLink>
          <ButtonLink href="/handover" variant="secondary">
            <ScanLine aria-hidden="true" className="size-4" /> Scan a code
          </ButtonLink>
        </div>
      </div>

      {!viewer.hostelId && (
        <Notice tone="warning" title="Add your hostel">
          Set your hostel in{' '}
          <Link href="/settings" className="font-medium underline underline-offset-4">
            account settings
          </Link>{' '}
          so your listings show where they are and your warden can help with disputes.
        </Notice>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/activity#wallet" className="group rounded-card border-line bg-chalk hover:border-line-strong border p-5">
          <div className="flex items-center justify-between">
            <p className="text-muted text-sm font-medium">Balance</p>
            <SandboxBadge />
          </div>
          <p className="font-display tabular mt-2 text-3xl font-semibold">{balance === null ? 'Unavailable' : formatINR(balance)}</p>
          <p className="text-forest mt-1 inline-flex items-center gap-1 text-sm">
            See transactions <ArrowUpRight aria-hidden="true" className="size-4" />
          </p>
        </Link>
        <div className="rounded-card border-line bg-chalk border p-5">
          <p className="text-muted text-sm font-medium">Your listings</p>
          <p className="font-display tabular mt-2 text-3xl font-semibold">{listings.filter((l) => l.status === 'ACTIVE').length} live</p>
          <p className="text-muted mt-1 text-sm">
            {listings.filter((l) => l.status === 'SOLD').length} sold, {listings.filter((l) => l.status === 'STAFF_CUSTODY').length} with staff
          </p>
        </div>
        <div className="rounded-card border-forest/20 bg-forest-tint text-forest-strong border p-5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Leaf aria-hidden="true" className="size-4" /> Estimated impact
          </p>
          <p className="font-display tabular mt-2 text-3xl font-semibold">{formatKg(impact.co2eAvoidedKg)} CO₂e</p>
          <p className="mt-1 text-sm">{formatKg(impact.wasteDivertedKg)} kept out of waste (estimate)</p>
        </div>
      </div>

      <section aria-labelledby="todo-heading">
        <h2 id="todo-heading" className="text-2xl">
          Needs your action
        </h2>
        {todos.length === 0 ? (
          <p className="text-muted mt-3">Nothing waiting on you right now.</p>
        ) : (
          <ul className="divide-line rounded-card border-line bg-chalk mt-4 divide-y border">
            {todos.map((t) => (
              <li key={t.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-muted text-sm">{t.detail}</p>
                </div>
                <ButtonLink href={t.href} variant="secondary" size="sm">
                  {t.cta}
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="listings-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="listings-heading" className="text-2xl">
            Your listings
          </h2>
          {listings.length > 3 && (
            <Link href="/activity#listings" className="text-forest text-sm font-medium underline underline-offset-4">
              See all {listings.length}
            </Link>
          )}
        </div>
        {listings.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<PackageOpen aria-hidden="true" className="size-6" />}
              title="You haven’t listed anything yet"
              action={<ButtonLink href="/sell/new">List your first item</ButtonLink>}
            >
              Leaving soon? List the things you can’t take home. Set a floor price and RIO handles the countdown.
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.slice(0, 3).map((l) => (
              <li key={l.id} className="flex">
                <ListingCard item={l} now={now} showStatus />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
