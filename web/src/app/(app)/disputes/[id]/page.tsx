import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronLeft, FileText } from 'lucide-react'
import { z } from 'zod'
import { ResolveDisputeForm } from '@/components/disputes/dispute-forms'
import { SandboxBadge, StatusBadge } from '@/components/ui/badges'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { formatINR } from '@/domain/money'
import { settleDeposit } from '@/domain/rental'
import { requireViewer } from '@/lib/auth/dal'
import { getDispute, getNames } from '@/lib/data/activity'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Dispute' }

type Params = Promise<{ id: string }>
type SP = Promise<Record<string, string | string[] | undefined>>

export default function DisputePage({ params, searchParams }: { params: Params; searchParams: SP }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Dispute params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Dispute({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const viewer = await requireViewer(`/disputes/${id}`)
  if (!z.uuid().safeParse(id).success) notFound()
  const dispute = await getDispute(id)
  if (!dispute) notFound() // RLS hides disputes the viewer isn't entitled to see
  const supabase = await createClient()

  const [subject, names, evidenceUrl] = await Promise.all([
    dispute.claim_id
      ? supabase.from('claims').select('claimer_id, amount_paise').eq('id', dispute.claim_id).maybeSingle()
      : supabase.from('rentals').select('renter_id, deposit_paise, rent_paise').eq('id', dispute.rental_id!).maybeSingle(),
    getNames([dispute.reporter_id, dispute.listing.owner_id]),
    dispute.evidence_path
      ? supabase.storage
          .from('dispute-evidence')
          .createSignedUrl(dispute.evidence_path, 300)
          .then((r) => r.data?.signedUrl ?? null)
      : Promise.resolve(null),
  ])
  const s = (subject.data ?? {}) as { claimer_id?: string; renter_id?: string; amount_paise?: number; deposit_paise?: number; rent_paise?: number }
  const counterpartyId = s.claimer_id ?? s.renter_id
  const allNames = counterpartyId ? new Map([...names, ...(await getNames([counterpartyId]))]) : names
  const isParty = [dispute.reporter_id, dispute.listing.owner_id, counterpartyId].includes(viewer.id)
  const canDecide = !isParty && (viewer.role === 'warden' || viewer.role === 'admin') && dispute.status === 'OPEN'

  const deposit = Number(s.deposit_paise ?? 0)
  const options = dispute.claim_id
    ? [
        {
          value: 'RESOLVED_REFUND',
          label: 'Refund the buyer',
          detail: `${formatINR(Number(s.amount_paise ?? 0))} returns to the buyer; the item goes back on the marketplace.`,
        },
        { value: 'RESOLVED_RELEASE', label: 'Release payment to the seller', detail: 'Use when the handover did happen as agreed. The item is marked sold.' },
      ]
    : dispute.prev_subject_status === 'PENDING_PICKUP'
      ? [
          {
            value: 'RESOLVED_REFUND',
            label: 'Cancel and refund',
            detail: `Rent and deposit (${formatINR(Number(s.rent_paise ?? 0) + deposit)}) return to the renter.`,
          },
          { value: 'RESOLVED_RELEASE', label: 'Dismiss: continue to pickup', detail: 'The rental goes back to waiting for pickup.' },
        ]
      : [
          {
            value: 'RESOLVED_REFUND',
            label: 'No damage: refund the full deposit',
            detail: `${formatINR(deposit)} back to the renter. The rental closes as returned.`,
          },
          {
            value: 'RESOLVED_DAMAGE',
            label: 'Damage: deduct 25% of the deposit',
            detail: `${formatINR(settleDeposit(deposit, true).deductionPaise)} to the owner, ${formatINR(settleDeposit(deposit, true).refundPaise)} back to the renter.`,
          },
          ...(!dispute.item_returned ? [{ value: 'RESOLVED_RELEASE', label: 'Dismiss: rental continues', detail: 'The rental goes back to active.' }] : []),
        ]

  return (
    <div className="max-w-3xl space-y-8">
      <Link href="/disputes" className="text-muted hover:text-ink inline-flex min-h-11 items-center gap-1 text-sm font-medium">
        <ChevronLeft aria-hidden="true" className="size-4" /> Disputes
      </Link>
      {sp.notice === 'opened' && <Notice tone="success" title="Dispute opened. The transaction is paused until a warden decides." />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted">{dispute.claim_id ? 'Purchase' : 'Rental'} dispute</p>
          <h1 className="text-4xl">
            <Link href={`/items/${dispute.listing.id}`} className="hover:underline">
              {dispute.listing.title}
            </Link>
          </h1>
        </div>
        <StatusBadge status={dispute.status} />
      </div>

      <section aria-labelledby="report-heading" className="rounded-card border-line bg-chalk border p-5">
        <h2 id="report-heading" className="font-sans text-base font-semibold">
          Report
        </h2>
        <p className="text-muted mt-1 text-sm">
          By {allNames.get(dispute.reporter_id) ?? 'a participant'} on {formatDateTime(dispute.created_at)}
          {dispute.item_returned ? ', when the item was returned' : ''}
        </p>
        <p className="mt-3 whitespace-pre-line">{dispute.reason}</p>
        {evidenceUrl && (
          <a
            href={evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-forest mt-4 inline-flex min-h-11 items-center gap-2 font-medium underline underline-offset-4"
          >
            <FileText aria-hidden="true" className="size-4" /> View evidence (private link, valid 5 minutes)
          </a>
        )}
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Owner</dt>
            <dd className="font-medium">{allNames.get(dispute.listing.owner_id) ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">{dispute.claim_id ? 'Buyer' : 'Renter'}</dt>
            <dd className="font-medium">{counterpartyId ? (allNames.get(counterpartyId) ?? '—') : '—'}</dd>
          </div>
        </dl>
      </section>

      {dispute.status !== 'OPEN' ? (
        <section aria-labelledby="decision-heading" className="rounded-card border-forest/20 bg-forest-tint text-forest-strong border p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="decision-heading" className="font-sans text-base font-semibold">
              Warden decision
            </h2>
            <SandboxBadge />
          </div>
          <p className="mt-2">{dispute.resolution_note}</p>
          {dispute.deduction_paise > 0 && <p className="mt-2 text-sm">Damage deduction: {formatINR(dispute.deduction_paise)}</p>}
          {dispute.resolved_at && <p className="mt-2 text-sm">Decided {formatDateTime(dispute.resolved_at)}</p>}
        </section>
      ) : canDecide ? (
        <section aria-labelledby="decide-heading" className="rounded-card border-line bg-chalk border p-5 sm:p-6">
          <h2 id="decide-heading" className="text-2xl">
            Decide
          </h2>
          <p className="text-muted mt-1 text-sm">Balances move immediately in sandbox money. This can’t be undone.</p>
          <div className="mt-5">
            <ResolveDisputeForm disputeId={dispute.id} options={options} />
          </div>
        </section>
      ) : (
        <Notice tone="info" title="Waiting for a warden">
          {isParty && (viewer.role === 'warden' || viewer.role === 'admin')
            ? 'You’re involved in this dispute, so another warden must decide it.'
            : 'A warden from this hostel will review the report. Any sandbox money involved stays held until then.'}
        </Notice>
      )}
    </div>
  )
}
