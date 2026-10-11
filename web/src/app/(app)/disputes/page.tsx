import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Gavel } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badges'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { requireViewer } from '@/lib/auth/dal'
import { getDisputes } from '@/lib/data/activity'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Disputes' }

export default function DisputesPage() {
  return (
    <div>
      <h1 className="text-4xl sm:text-5xl">Disputes</h1>
      <p className="text-muted mt-3 max-w-2xl">
        Problems with a purchase or rental. To report a new one, open the transaction from My activity and choose “Report a problem”.
      </p>
      <Suspense fallback={<Skeleton className="mt-8 h-64" />}>
        <List />
      </Suspense>
    </div>
  )
}

async function List() {
  await requireViewer('/disputes')
  const disputes = await getDisputes() // RLS: parties see their own; wardens see their hostels
  if (!disputes.length) {
    return (
      <div className="mt-8">
        <EmptyState icon={<Gavel aria-hidden="true" className="size-6" />} title="No disputes">
          Nothing has been reported on transactions you can see.
        </EmptyState>
      </div>
    )
  }
  return (
    <ul className="divide-line rounded-card border-line bg-chalk mt-8 divide-y border">
      {disputes.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <Link href={`/disputes/${d.id}`} className="font-semibold hover:underline">
              {d.listing.title}
            </Link>
            <p className="text-muted truncate text-sm">
              {d.claim_id ? 'Purchase' : 'Rental'} dispute opened {formatDateTime(d.created_at)}
            </p>
          </div>
          <StatusBadge status={d.status} />
        </li>
      ))}
    </ul>
  )
}
