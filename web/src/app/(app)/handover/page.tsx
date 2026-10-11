import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ConsumeForm } from '@/components/handover/consume-form'
import { Skeleton } from '@/components/ui/feedback'
import { requireViewer } from '@/lib/auth/dal'

export const metadata: Metadata = { title: 'Handover' }

export default function HandoverPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div>
        <h1 className="text-4xl sm:text-5xl">Scan a handover code</h1>
        <p className="text-muted mt-3 max-w-xl">
          The person giving you the item shows a QR code. Scan it, or type the code under it, to confirm you’ve received it. Each code works once and expires
          after 10 minutes.
        </p>
        <div className="rounded-card border-line bg-chalk mt-8 border p-5 sm:p-6">
          <Suspense fallback={<Skeleton className="h-64" />}>
            <Gate />
          </Suspense>
        </div>
      </div>
      <aside aria-labelledby="who-heading" className="rounded-card border-line bg-chalk border p-5 text-sm">
        <h2 id="who-heading" className="font-sans text-base font-semibold">
          Who scans what
        </h2>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="font-medium">Buying</dt>
            <dd className="text-muted">The seller shows a code; you scan it once you have the item. That releases payment.</dd>
          </div>
          <div>
            <dt className="font-medium">Collecting a rental</dt>
            <dd className="text-muted">The owner shows a pickup code; you scan it.</dd>
          </div>
          <div>
            <dt className="font-medium">Getting your item back</dt>
            <dd className="text-muted">The renter shows a return code; you scan it and can report damage.</dd>
          </div>
          <div>
            <dt className="font-medium">Campus staff</dt>
            <dd className="text-muted">The departing student shows a custody code; staff or the warden scans it.</dd>
          </div>
        </dl>
        <p className="text-muted mt-4">Showing a code instead? Open the transaction from My activity.</p>
      </aside>
    </div>
  )
}

async function Gate() {
  await requireViewer('/handover')
  return <ConsumeForm />
}
