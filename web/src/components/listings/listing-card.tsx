import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Repeat } from 'lucide-react'
import { CategoryArt } from '@/components/brand/category-art'
import { PriceTag } from '@/components/brand/price-tag'
import { Badge, StatusBadge } from '@/components/ui/badges'
import { CONDITIONS } from '@/domain/catalog'
import type { ListingCard as Card } from '@/lib/data/listings'
import { listingMediaUrl } from '@/lib/env'
import { SaveButton } from './save-button'

export function ListingCard({
  item,
  now,
  showStatus = false,
  save,
}: {
  item: Card
  now: number
  showStatus?: boolean
  /** When provided, shows the save control. `returnTo` is where sign-in sends a signed-out visitor back to. */
  save?: { saved: boolean; returnTo: string }
}) {
  return (
    <article className="group rounded-card border-line bg-chalk hover:border-line-strong has-[a:focus-visible]:outline-forest relative flex flex-col overflow-hidden border transition-colors has-[a:focus-visible]:outline has-[a:focus-visible]:outline-[3px] has-[a:focus-visible]:outline-offset-2">
      <div className="bg-forest-tint relative aspect-[4/3] overflow-hidden">
        {item.cover_path ? (
          <Image
            src={listingMediaUrl(item.cover_thumb_path ?? item.cover_path)}
            alt={item.cover_alt ?? item.title}
            fill
            // Already compressed and sized at upload: serve straight from storage (no transformation quota).
            unoptimized
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <CategoryArt slug={item.category_slug} label={item.category_name} className="h-full w-full" />
        )}
        {showStatus && (
          <div className="absolute top-3 left-3">
            <StatusBadge status={item.status} />
          </div>
        )}
        {save && (
          <div className="absolute top-2 right-2 z-10">
            <SaveButton listingId={item.id} title={item.title} initialSaved={save.saved} returnTo={save.returnTo} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-lg leading-snug font-semibold">
            <Link href={`/items/${item.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {item.title}
            </Link>
          </h3>
          <p className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>{item.category_name}</span>
            <span>{CONDITIONS[item.condition].label}</span>
            {item.hostel_name && (
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" className="size-3.5" />
                {item.hostel_name}
              </span>
            )}
          </p>
        </div>
        {item.is_rentable && (
          <div>
            <Badge tone="forest" icon={<Repeat aria-hidden="true" className="size-3.5" />}>
              Also for rent
            </Badge>
          </div>
        )}
        <PriceTag
          className="mt-auto"
          currentPaise={item.current_price_paise}
          startPaise={item.start_price_paise}
          floorPaise={item.floor_price_paise}
          listedAt={item.listed_at}
          departureAt={item.departure_at}
          now={now}
        />
      </div>
    </article>
  )
}
