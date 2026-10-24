import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronLeft } from 'lucide-react'
import { ListingForm } from '@/components/listings/listing-form'
import { ActionButton } from '@/components/ui/action-button'
import { StatusBadge } from '@/components/ui/badges'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { requireViewer } from '@/lib/auth/dal'
import { getListing } from '@/lib/data/listings'
import { listingMediaUrl } from '@/lib/env'
import { toISTLocalInput } from '@/lib/format'
import { deletePhotoAction, updateListingAction } from '../../../sell/actions'
import { requestNow } from '@/lib/time'

export const metadata: Metadata = { title: 'Edit listing' }

type Params = Promise<{ id: string }>
type SP = Promise<Record<string, string | string[] | undefined>>

export default function EditListingPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] max-w-2xl" />}>
      <Edit params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Edit({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const viewer = await requireViewer(`/items/${id}/edit`)
  const listing = await getListing(id)
  if (!listing || listing.owner_id !== viewer.id) notFound()
  const editable = listing.status === 'ACTIVE' || listing.status === 'WITHDRAWN'

  return (
    <div className="max-w-2xl">
      <Link href={`/items/${listing.id}`} className="text-muted hover:text-ink inline-flex min-h-11 items-center gap-1 text-sm font-medium">
        <ChevronLeft aria-hidden="true" className="size-4" /> View listing
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl">Edit listing</h1>
        <StatusBadge status={listing.status} />
      </div>
      {sp.notice === 'created' && <Notice className="mt-6" tone="success" title="Your listing is live on the marketplace." />}
      {sp.notice === 'created-partial' && (
        <Notice className="mt-6" tone="warning" title="Your listing is live, but some photos didn’t upload. Try adding them again below." />
      )}

      {listing.media.length > 0 && (
        <section aria-labelledby="photos-heading" className="mt-8">
          <h2 id="photos-heading" className="text-2xl">
            Current photos
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {listing.media.map((m) => (
              <li key={m.id} className="space-y-2">
                <div className="rounded-media bg-forest-tint relative aspect-square overflow-hidden">
                  <Image src={listingMediaUrl(m.thumb_path ?? m.storage_path)} alt={m.alt_text} fill unoptimized className="object-cover" />
                </div>
                {editable && <ActionButton action={deletePhotoAction.bind(null, listing.id, m.id)} label="Remove photo" variant="ghost" size="sm" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="rounded-card border-line bg-chalk mt-8 border p-5 sm:p-8">
        {editable ? (
          <ListingForm
            action={updateListingAction.bind(null, listing.id)}
            submitLabel="Save changes"
            existingPhotos={listing.media.length}
            minDeparture={toISTLocalInput(new Date((await requestNow()) + 3 * 3_600_000))}
            defaults={{
              title: listing.title,
              description: listing.description ?? '',
              category: listing.category_slug,
              condition: listing.condition,
              startRupees: String(listing.start_price_paise / 100),
              floorRupees: String(listing.floor_price_paise / 100),
              departure: listing.departure_at ? toISTLocalInput(listing.departure_at) : '',
              noDeparture: !listing.departure_at,
              rentable: listing.is_rentable,
            }}
          />
        ) : (
          <Notice tone="info" title="This listing is in a transaction and can’t be edited.">
            Follow its progress in{' '}
            <Link href="/activity" className="font-medium underline underline-offset-4">
              My activity
            </Link>
            .
          </Notice>
        )}
      </div>
    </div>
  )
}
