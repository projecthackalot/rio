import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ListingForm } from '@/components/listings/listing-form'
import { Skeleton } from '@/components/ui/feedback'
import { requireViewer } from '@/lib/auth/dal'
import { toISTLocalInput } from '@/lib/format'
import { createListingAction } from '../actions'
import { requestNow } from '@/lib/time'

export const metadata: Metadata = { title: 'List an item' }

export default function SellPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl sm:text-5xl">List an item</h1>
      <p className="text-muted mt-3">It stays in your room until someone claims it. You’ll meet to hand it over and confirm with a QR scan.</p>
      <div className="rounded-card border-line bg-chalk mt-8 border p-5 sm:p-8">
        <Suspense fallback={<Skeleton className="h-[40rem]" />}>
          <Form />
        </Suspense>
      </div>
    </div>
  )
}

async function Form() {
  const viewer = await requireViewer('/sell/new')
  return (
    <ListingForm
      action={createListingAction}
      submitLabel="Publish listing"
      minDeparture={toISTLocalInput(new Date((await requestNow()) + 3 * 3_600_000))}
      defaults={viewer ? { condition: 'good' } : {}}
    />
  )
}
