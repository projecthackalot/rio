import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ScanLine, Users } from 'lucide-react'
import { AccessDenied } from '@/components/ui/access-denied'
import { StatusBadge } from '@/components/ui/badges'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { requireViewer } from '@/lib/auth/dal'
import { getNames } from '@/lib/data/activity'
import { getScopedHostels, getStaffTransfers } from '@/lib/data/warden'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Staff custody' }

export default function StaffPage() {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">Staff custody</h1>
          <p className="text-muted mt-3 max-w-2xl">
            Unsold items routed to campus staff in their owner’s final hour. Accept each one by scanning the student’s custody code.
          </p>
        </div>
        <ButtonLink href="/handover">
          <ScanLine aria-hidden="true" className="size-4" /> Scan custody code
        </ButtonLink>
      </div>
      <Suspense fallback={<Skeleton className="mt-8 h-64" />}>
        <Queue />
      </Suspense>
    </div>
  )
}

async function Queue() {
  const viewer = await requireViewer('/staff')
  if (!['staff', 'warden', 'admin'].includes(viewer.role))
    return (
      <div className="mt-8">
        <AccessDenied need="campus staff and wardens" />
      </div>
    )
  const hostels = await getScopedHostels(viewer)
  const transfers = await getStaffTransfers(hostels.map((h) => h.id))
  const names = await getNames(transfers.map((t) => t.owner_id))
  const pending = transfers.filter((t) => t.status === 'PENDING')
  const accepted = transfers.filter((t) => t.status === 'ACCEPTED')
  const hostelName = new Map(hostels.map((h) => [h.id, h.name]))

  if (!transfers.length) {
    return (
      <div className="mt-8">
        <EmptyState icon={<Users aria-hidden="true" className="size-6" />} title="Nothing waiting for staff">
          {hostels.length
            ? 'When a warden routes an unsold item to staff, it appears here.'
            : 'You aren’t assigned to a hostel yet. Ask a campus administrator.'}
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-10">
      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="text-2xl">
          Waiting for pickup ({pending.length})
        </h2>
        <ul className="divide-line rounded-card border-line bg-chalk mt-4 divide-y border">
          {pending.length === 0 && <li className="text-muted p-4">All routed items have been collected.</li>}
          {pending.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{t.listing.title}</p>
                <p className="text-muted text-sm">
                  From {names.get(t.owner_id) ?? 'resident'}, {hostelName.get(t.hostel_id) ?? ''}. Routed {formatDateTime(t.routed_at)}.
                </p>
              </div>
              <StatusBadge status={t.status} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="accepted-heading">
        <h2 id="accepted-heading" className="text-2xl">
          In custody ({accepted.length})
        </h2>
        <ul className="divide-line rounded-card border-line bg-chalk mt-4 divide-y border">
          {accepted.length === 0 && <li className="text-muted p-4">Nothing accepted yet.</li>}
          {accepted.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{t.listing.title}</p>
                <p className="text-muted text-sm">Accepted {t.accepted_at ? formatDateTime(t.accepted_at) : ''}</p>
              </div>
              <StatusBadge status={t.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
