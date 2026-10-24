import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { queryError } from './query-error'

export interface RatingSummary {
  ratings: number
  average: number | null
}

/** Count and average of a seller's ratings (public; no rater identities). */
export async function getSellerRating(sellerId: string): Promise<RatingSummary> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('seller_rating', { p_seller: sellerId })
  if (error) throw queryError('seller rating', error)
  const row = (Array.isArray(data) ? data[0] : data) as { ratings: number | string; average: number | string | null } | undefined
  const ratings = Number(row?.ratings ?? 0)
  return { ratings, average: ratings ? Number(row?.average) : null }
}

/** Which of the viewer's own transactions they've already rated. */
export async function getMyRatedTransactions(): Promise<{ claims: Set<string>; rentals: Set<string> }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_rated_transactions')
  if (error) throw queryError('my ratings', error)
  const rows = (data ?? []) as { claim_id: string | null; rental_id: string | null }[]
  return {
    claims: new Set(rows.flatMap((r) => (r.claim_id ? [r.claim_id] : []))),
    rentals: new Set(rows.flatMap((r) => (r.rental_id ? [r.rental_id] : []))),
  }
}

export interface OpenReport {
  id: string
  reason: string
  details: string | null
  created_at: string
  listing: { id: string; title: string; status: string; hostel_id: string | null }
}

/** Open reports on listings in the given hostels (RLS: scoped wardens and admins only). */
export async function getOpenReports(hostelIds: string[]): Promise<OpenReport[]> {
  if (!hostelIds.length) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listing_reports')
    .select('id, reason, details, created_at, listing:listings!listing_id!inner(id, title, status, hostel_id)')
    .eq('status', 'OPEN')
    .in('listing.hostel_id', hostelIds)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw queryError('reports', error)
  return (data ?? []) as unknown as OpenReport[]
}
