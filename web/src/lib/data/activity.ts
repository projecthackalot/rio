import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ClaimStatus, DisputeStatus, ListingStatus, RentalStatus, StaffTransferStatus } from '@/domain/stateMachine'
import type { RentalPeriod } from '@/domain/rental'

interface ListingRef {
  id: string
  title: string
  category_slug: string
  owner_id: string
  status: ListingStatus
  start_price_paise: number
  floor_price_paise: number
  listed_at: string
  departure_at: string | null
}

export interface ClaimRow {
  id: string
  status: ClaimStatus
  amount_paise: number
  claimed_at: string
  completed_at: string | null
  claimer_id: string
  listing: ListingRef
}

export interface RentalRow {
  id: string
  status: RentalStatus
  period: RentalPeriod
  rent_paise: number
  deposit_paise: number
  booked_at: string
  picked_up_at: string | null
  due_at: string | null
  returned_at: string | null
  damage_deduction_paise: number
  converted_price_paise: number | null
  renter_id: string
  listing: ListingRef
}

export interface DisputeRow {
  id: string
  status: DisputeStatus
  reason: string
  evidence_path: string | null
  resolution_note: string | null
  created_at: string
  resolved_at: string | null
  reporter_id: string
  claim_id: string | null
  rental_id: string | null
  item_returned: boolean
  prev_subject_status: string | null
  deduction_paise: number
  listing: { id: string; title: string; owner_id: string; hostel_id: string | null }
}

export interface StaffTransferRow {
  id: string
  status: StaffTransferStatus
  routed_at: string
  accepted_at: string | null
  owner_id: string
  hostel_id: string | null
  listing: { id: string; title: string; category_slug: string; departure_at: string | null }
}

const LISTING_REF = 'id, title, category_slug, owner_id, status, start_price_paise, floor_price_paise, listed_at, departure_at'

const num = <T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): T => {
  const out = { ...row }
  for (const k of keys) if (out[k] !== null && out[k] !== undefined) (out as Record<keyof T, unknown>)[k] = Number(out[k])
  return out
}

const normListing = (l: ListingRef): ListingRef =>
  num(l as unknown as Record<string, unknown>, ['start_price_paise', 'floor_price_paise']) as unknown as ListingRef

function normClaim(r: Record<string, unknown>): ClaimRow {
  const c = num(r, ['amount_paise']) as unknown as ClaimRow
  return { ...c, listing: normListing(c.listing) }
}
function normRental(r: Record<string, unknown>): RentalRow {
  const x = num(r, ['rent_paise', 'deposit_paise', 'damage_deduction_paise', 'converted_price_paise']) as unknown as RentalRow
  return { ...x, listing: normListing(x.listing) }
}

const CLAIM_COLS = `id, status, amount_paise, claimed_at, completed_at, claimer_id, listing:listings!inner(${LISTING_REF})`
const RENTAL_COLS = `id, status, period, rent_paise, deposit_paise, booked_at, picked_up_at, due_at, returned_at, damage_deduction_paise, converted_price_paise, renter_id, listing:listings!inner(${LISTING_REF})`

/** Everything the viewer is involved in, as buyer/renter and as owner — 5 queries, run in parallel. */
export async function getActivity(userId: string) {
  const supabase = await createClient()
  const [bought, sold, renting, lending, transfers] = await Promise.all([
    supabase.from('claims').select(CLAIM_COLS).eq('claimer_id', userId).order('claimed_at', { ascending: false }).limit(50),
    supabase.from('claims').select(CLAIM_COLS).eq('listing.owner_id', userId).order('claimed_at', { ascending: false }).limit(50),
    supabase.from('rentals').select(RENTAL_COLS).eq('renter_id', userId).order('booked_at', { ascending: false }).limit(50),
    supabase.from('rentals').select(RENTAL_COLS).eq('listing.owner_id', userId).order('booked_at', { ascending: false }).limit(50),
    supabase
      .from('staff_transfers')
      .select('id, status, routed_at, accepted_at, owner_id, hostel_id, listing:listings!inner(id, title, category_slug, departure_at)')
      .eq('owner_id', userId)
      .order('routed_at', { ascending: false })
      .limit(20),
  ])
  for (const r of [bought, sold, renting, lending, transfers]) if (r.error) throw new Error(`activity: ${r.error.code}`)
  return {
    bought: (bought.data ?? []).map(normClaim),
    sold: (sold.data ?? []).map(normClaim),
    renting: (renting.data ?? []).map(normRental),
    lending: (lending.data ?? []).map(normRental),
    transfers: (transfers.data ?? []) as unknown as StaffTransferRow[],
  }
}

export async function getRental(id: string): Promise<RentalRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('rentals').select(RENTAL_COLS).eq('id', id).maybeSingle()
  if (error) throw new Error(`rental: ${error.code}`)
  return data ? normRental(data) : null
}

/** The viewer's open claim or rental on a listing, if any (for the item page). */
export async function getMyInvolvement(listingId: string, userId: string) {
  const supabase = await createClient()
  const [claims, rentals] = await Promise.all([
    supabase.from('claims').select('id, status, amount_paise, claimer_id').eq('listing_id', listingId).in('status', ['PENDING_HANDOVER', 'DISPUTED']).limit(1),
    supabase.from('rentals').select('id, status, renter_id').eq('listing_id', listingId).in('status', ['PENDING_PICKUP', 'ACTIVE', 'DISPUTED']).limit(1),
  ])
  const claim = claims.data?.[0] ?? null
  const rental = rentals.data?.[0] ?? null
  return {
    claim: claim ? { ...claim, amount_paise: Number(claim.amount_paise), mine: claim.claimer_id === userId } : null,
    rental: rental ? { ...rental, mine: rental.renter_id === userId } : null,
  }
}

const DISPUTE_COLS =
  'id, status, reason, evidence_path, resolution_note, created_at, resolved_at, reporter_id, claim_id, rental_id, item_returned, prev_subject_status, deduction_paise, listing:listings!inner(id, title, owner_id, hostel_id)'

export async function getDisputes(opts: { status?: 'OPEN' | 'CLOSED'; hostelIds?: string[] } = {}) {
  const supabase = await createClient()
  let q = supabase.from('disputes').select(DISPUTE_COLS).order('created_at', { ascending: false }).limit(100)
  if (opts.status === 'OPEN') q = q.eq('status', 'OPEN')
  if (opts.status === 'CLOSED') q = q.neq('status', 'OPEN')
  if (opts.hostelIds?.length) q = q.in('listing.hostel_id', opts.hostelIds)
  const { data, error } = await q
  if (error) throw new Error(`disputes: ${error.code}`)
  return (data ?? []).map((d) => num(d as Record<string, unknown>, ['deduction_paise']) as unknown as DisputeRow)
}

export async function getDispute(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('disputes').select(DISPUTE_COLS).eq('id', id).maybeSingle()
  if (error) throw new Error(`dispute: ${error.code}`)
  return data ? (num(data as Record<string, unknown>, ['deduction_paise']) as unknown as DisputeRow) : null
}

/** Names for a set of profile ids in one query (avoids per-row lookups). */
export async function getNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map()
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unique)
  return new Map((data ?? []).map((p) => [p.id, p.full_name]))
}
