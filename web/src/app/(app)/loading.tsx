import { LoadingRegion, Skeleton } from '@/components/ui/feedback'

export default function Loading() {
  return (
    <LoadingRegion label="Loading…">
      <div className="space-y-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </LoadingRegion>
  )
}
