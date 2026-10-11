import type { Metadata } from 'next'
import { Suspense } from 'react'
import { z } from 'zod'
import { OpenDisputeForm } from '@/components/disputes/dispute-forms'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { requireViewer } from '@/lib/auth/dal'

export const metadata: Metadata = { title: 'Report a problem' }

type SP = Promise<Record<string, string | string[] | undefined>>

export default function NewDisputePage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl sm:text-5xl">Report a problem</h1>
      <p className="text-muted mt-3">
        Use this when a handover can’t be completed fairly: the item isn’t as described, it’s damaged, or the other person isn’t responding.
      </p>
      <div className="rounded-card border-line bg-chalk mt-8 border p-5 sm:p-8">
        <Suspense fallback={<Skeleton className="h-80" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}

async function Form({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  await requireViewer('/disputes/new')
  const claim = z.uuid().safeParse(sp.claim)
  const rental = z.uuid().safeParse(sp.rental)
  if (!claim.success && !rental.success) {
    return (
      <Notice tone="warning" title="Choose a transaction first">
        Open the purchase or rental from My activity and choose “Report a problem”.
      </Notice>
    )
  }
  return <OpenDisputeForm claimId={claim.success ? claim.data : undefined} rentalId={!claim.success && rental.success ? rental.data : undefined} />
}
