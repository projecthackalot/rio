import { LoadingRegion, Skeleton } from '@/components/ui/feedback'

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading items…">
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="rounded-card border-line bg-chalk overflow-hidden border">
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
          </li>
        ))}
      </ul>
    </LoadingRegion>
  )
}
