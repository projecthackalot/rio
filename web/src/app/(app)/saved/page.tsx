import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Heart } from 'lucide-react'
import { ListingCard } from '@/components/listings/listing-card'
import { ListingGridSkeleton } from '@/components/listings/listing-grid-skeleton'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { requireViewer } from '@/lib/auth/dal'
import { getSavedListings } from '@/lib/data/listings'
import { requestNow } from '@/lib/time'

export const metadata: Metadata = { title: 'Saved items', robots: { index: false } }

export default function SavedPage() {
  return (
    <div>
      <h1 className="text-[clamp(2.25rem,6vw,3rem)]">Saved items</h1>
      <p className="text-muted mt-3 max-w-2xl">
        Only you can see this list. Prices keep falling while you decide, and an item can be claimed by someone else first.
      </p>
      <div className="mt-8">
        <Suspense fallback={<ListingGridSkeleton count={3} />}>
          <Saved />
        </Suspense>
      </div>
    </div>
  )
}

async function Saved() {
  await requireViewer('/saved')
  const [items, now] = await Promise.all([getSavedListings(), requestNow()])
  if (!items.length) {
    return (
      <EmptyState
        icon={<Heart aria-hidden="true" className="size-6" />}
        title="Nothing saved yet"
        action={<ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>}
      >
        Tap the heart on any listing to keep it here.
      </EmptyState>
    )
  }
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0">
          <ListingCard item={item} now={now} showStatus={item.status !== 'ACTIVE'} save={{ saved: true, returnTo: '/saved' }} />
        </li>
      ))}
    </ul>
  )
}
