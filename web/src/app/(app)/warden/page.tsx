import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Leaf } from 'lucide-react'
import { AccessDenied } from '@/components/ui/access-denied'
import { ActionButton } from '@/components/ui/action-button'
import { Badge, StatusBadge } from '@/components/ui/badges'
import { buttonClass } from '@/components/ui/button'
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback'
import { formatKg } from '@/domain/impact'
import { isStaffRoutable } from '@/domain/pricing'
import { requireViewer } from '@/lib/auth/dal'
import { getDisputes, getNames } from '@/lib/data/activity'
import { getDepartureQueue, getImpact, getNoDues, getScopedHostels, getStaffTransfers } from '@/lib/data/warden'
import { formatDateTime, formatDuration } from '@/lib/format'
import { routeToStaffAction } from '../actions'
import { requestNow } from '@/lib/time'

export const metadata: Metadata = { title: 'Warden' }

type SP = Promise<Record<string, string | string[] | undefined>>

export default function WardenPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<Skeleton className="h-[30rem]" />}>
      <Warden searchParams={searchParams} />
    </Suspense>
  )
}

async function Warden({ searchParams }: { searchParams: SP }) {
  const viewer = await requireViewer('/warden')
  if (viewer.role !== 'warden' && viewer.role !== 'admin') return <AccessDenied need="hostel wardens" />
  const hostels = await getScopedHostels(viewer)
  if (!hostels.length) {
    return (
      <EmptyState title="No hostels assigned yet">
        Ask a campus administrator to assign you to a hostel. You’ll see its departures, disputes and staff queue here.
      </EmptyState>
    )
  }
  const sp = await searchParams
  const hostel = hostels.find((h) => h.id === sp.hostel) ?? hostels[0]
  const now = await requestNow()
  const [queue, transfers, disputes, impact, noDues] = await Promise.all([
    getDepartureQueue(hostel.id, now),
    getStaffTransfers([hostel.id]),
    getDisputes({ status: 'OPEN', hostelIds: [hostel.id] }),
    getImpact(hostel.id),
    getNoDues(hostel.id),
  ])
  const names = await getNames([...queue.map((q) => q.owner_id), ...transfers.map((t) => t.owner_id)])
  const routable = queue.filter((q) => isStaffRoutable(new Date(q.departure_at), now))
  const upcoming = queue.filter((q) => !isStaffRoutable(new Date(q.departure_at), now))
  const outstanding = noDues.filter((r) => !r.cleared)

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">{hostel.name}</h1>
          <p className="text-muted mt-2">{hostel.campus}. Warden overview.</p>
        </div>
        {hostels.length > 1 && (
          <form method="get" className="flex items-end gap-2">
            <div>
              <label htmlFor="hostel" className="block text-sm font-medium">
                Hostel
              </label>
              <select id="hostel" name="hostel" defaultValue={hostel.id} className="border-line-strong bg-chalk mt-1 min-h-11 rounded-lg border px-3">
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={buttonClass('secondary')}>
              Show
            </button>
          </form>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ready for staff now" value={String(routable.length)} tone={routable.length ? 'clay' : undefined} />
        <Stat label="Open disputes" value={String(disputes.length)} tone={disputes.length ? 'clay' : undefined} />
        <Stat label="Residents with dues" value={String(outstanding.length)} />
        <div className="rounded-card border-forest/20 bg-forest-tint text-forest-strong border p-5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Leaf aria-hidden="true" className="size-4" /> Estimated impact
          </p>
          {impact ? (
            <>
              <p className="font-display tabular mt-2 text-2xl font-semibold">{formatKg(impact.co2eKg)} CO₂e</p>
              <p className="text-sm">
                {impact.itemsDiverted} items re-homed, {impact.rentalsCompleted} rentals. Estimates.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm">Unavailable.</p>
          )}
        </div>
      </div>

      <section aria-labelledby="final-heading">
        <h2 id="final-heading" className="text-2xl">
          Final hour: route to staff
        </h2>
        <p className="text-muted mt-1 text-sm">
          Unsold items whose owner leaves within the hour (or has left). Routing hands them to campus staff instead of the bin.
        </p>
        {routable.length === 0 ? (
          <p className="text-muted mt-4">Nothing needs routing right now.</p>
        ) : (
          <ul className="divide-line rounded-card border-line bg-chalk mt-4 divide-y border">
            {routable.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/items/${q.id}`} className="font-semibold hover:underline">
                    {q.title}
                  </Link>
                  <p className="text-muted text-sm">
                    {names.get(q.owner_id) ?? 'Resident'},{' '}
                    {new Date(q.departure_at).getTime() <= now ? 'departed' : `leaves in ${formatDuration(new Date(q.departure_at).getTime() - now)}`}
                  </p>
                </div>
                <ActionButton action={routeToStaffAction.bind(null, q.id)} label="Route to staff" variant="clay" size="sm" />
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > 0 && (
          <details className="mt-4">
            <summary className="text-forest min-h-11 cursor-pointer py-2 text-sm font-medium">Leaving in the next 24 hours ({upcoming.length})</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {upcoming.map((q) => (
                <li key={q.id} className="flex justify-between gap-4">
                  <Link href={`/items/${q.id}`} className="hover:underline">
                    {q.title}
                  </Link>
                  <span className="tabular text-muted">{formatDateTime(q.departure_at)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="disputes-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="disputes-heading" className="text-2xl">
            Open disputes
          </h2>
          <Link href="/disputes" className="text-forest text-sm font-medium underline underline-offset-4">
            All disputes
          </Link>
        </div>
        {disputes.length === 0 ? (
          <p className="text-muted mt-4">No open disputes.</p>
        ) : (
          <ul className="divide-line rounded-card border-line bg-chalk mt-4 divide-y border">
            {disputes.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/disputes/${d.id}`} className="font-semibold hover:underline">
                    {d.listing.title}
                  </Link>
                  <p className="text-muted line-clamp-1 text-sm">{d.reason}</p>
                </div>
                <Link href={`/disputes/${d.id}`} className={buttonClass('secondary', 'sm')}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="transfers-heading">
        <h2 id="transfers-heading" className="text-2xl">
          Staff transfers
        </h2>
        {transfers.length === 0 ? (
          <p className="text-muted mt-4">No items routed to staff yet.</p>
        ) : (
          <ul className="divide-line rounded-card border-line bg-chalk mt-4 divide-y border">
            {transfers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{t.listing.title}</p>
                  <p className="text-muted text-sm">
                    From {names.get(t.owner_id) ?? 'resident'}, routed {formatDateTime(t.routed_at)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
        {transfers.some((t) => t.status === 'PENDING') && (
          <p className="text-muted mt-3 text-sm">
            The student shows a custody code; staff or you scan it on the{' '}
            <Link href="/handover" className="text-forest font-medium underline underline-offset-4">
              Handover
            </Link>{' '}
            page.
          </p>
        )}
      </section>

      <section aria-labelledby="nodues-heading">
        <h2 id="nodues-heading" className="text-2xl">
          No-dues check
        </h2>
        <p className="text-muted mt-1 text-sm">
          Residents with unsold departing listings, active rentals or open disputes. Informational only in this pilot; it isn’t linked to university records.
        </p>
        {noDues.length === 0 ? (
          <Notice className="mt-4" tone="info" title="No student residents are linked to this hostel yet." />
        ) : (
          <div className="rounded-card border-line bg-chalk mt-4 overflow-x-auto border" role="region" aria-label="No-dues table (scrollable)" tabIndex={0}>
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">No-dues status by resident</caption>
              <thead>
                <tr className="text-muted text-left">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Resident
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Departure
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Open items
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {noDues.map((r) => (
                  <tr key={r.user_id} className="border-line border-t">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {r.full_name}
                    </th>
                    <td className="tabular text-muted px-4 py-3">{r.departure_at ? formatDateTime(r.departure_at) : 'Not set'}</td>
                    <td className="px-4 py-3">
                      {Number(r.open_listings)} listings, {Number(r.open_rentals)} rentals, {Number(r.open_disputes)} disputes
                    </td>
                    <td className="px-4 py-3">{r.cleared ? <Badge tone="forest">Clear</Badge> : <Badge tone="amber">Outstanding</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'clay' }) {
  return (
    <div className={`rounded-card border p-5 ${tone === 'clay' ? 'border-clay/30 bg-clay-tint' : 'border-line bg-chalk'}`}>
      <p className={`text-sm font-medium ${tone === 'clay' ? 'text-clay' : 'text-muted'}`}>{label}</p>
      <p className="font-display tabular mt-2 text-3xl font-semibold">{value}</p>
    </div>
  )
}
