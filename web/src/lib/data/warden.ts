import 'server-only'
import { queryError } from './query-error'
import { createClient } from '@/lib/supabase/server'
import type { Viewer } from '@/lib/auth/dal'

export interface Hostel {
  id: string
  name: string
  campus: string
}

/** Hostels the viewer can act on: assigned ones for wardens/staff, all for admins. */
export async function getScopedHostels(viewer: Viewer): Promise<Hostel[]> {
  const supabase = await createClient()
  let ids: string[] | null = null
  if (viewer.role !== 'admin') {
    const { data } = await supabase.from('hostel_assignments').select('hostel_id').eq('user_id', viewer.id)
    ids = (data ?? []).map((r) => r.hostel_id)
    if (!ids.length) return []
  }
  let q = supabase.from('hostels').select('id, name, campus:campuses!campus_id(name)').order('name')
  if (ids) q = q.in('id', ids)
  const { data, error } = await q
  if (error) throw queryError('hostels', error)
  return (data ?? []).map((h) => ({ id: h.id, name: h.name, campus: (h.campus as unknown as { name: string } | null)?.name ?? '' }))
}

export async function getAllHostels(): Promise<Hostel[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('hostels').select('id, name, campus:campuses!campus_id(name)').order('name')
  return (data ?? []).map((h) => ({ id: h.id, name: h.name, campus: (h.campus as unknown as { name: string } | null)?.name ?? '' }))
}

export interface QueueItem {
  id: string
  title: string
  status: string
  departure_at: string
  owner_id: string
  category_slug: string
}

/** Listings in the hostel whose owners leave within `withinHours` (RLS: scoped wardens/staff only). */
export async function getDepartureQueue(hostelId: string, now: number, withinHours = 24): Promise<QueueItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, status, departure_at, owner_id, category_slug')
    .eq('hostel_id', hostelId)
    .in('status', ['ACTIVE', 'WITHDRAWN'])
    .not('departure_at', 'is', null)
    .lte('departure_at', new Date(now + withinHours * 3_600_000).toISOString())
    .order('departure_at')
    .limit(100)
  if (error) throw queryError('queue', error)
  return (data ?? []) as QueueItem[]
}

export async function getStaffTransfers(hostelIds: string[]) {
  if (!hostelIds.length) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff_transfers')
    .select('id, status, routed_at, accepted_at, owner_id, accepted_by, hostel_id, listing:listings!listing_id!inner(id, title, category_slug)')
    .in('hostel_id', hostelIds)
    .order('routed_at', { ascending: false })
    .limit(100)
  if (error) throw queryError('transfers', error)
  return (data ?? []) as unknown as {
    id: string
    status: 'PENDING' | 'ACCEPTED'
    routed_at: string
    accepted_at: string | null
    owner_id: string
    accepted_by: string | null
    hostel_id: string
    listing: { id: string; title: string; category_slug: string }
  }[]
}

export async function getImpact(hostelId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('impact_summary', { p_hostel: hostelId })
  if (error) return null
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, string | number> | undefined
  if (!r) return null
  return {
    itemsDiverted: Number(r.items_diverted),
    rentalsCompleted: Number(r.rentals_completed),
    co2eKg: Number(r.co2e_avoided_kg),
    wasteKg: Number(r.waste_diverted_kg),
  }
}

export async function getNoDues(hostelId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('no_dues_report', { p_hostel: hostelId })
  if (error) return []
  return (data ?? []) as {
    user_id: string
    full_name: string
    departure_at: string | null
    open_listings: number
    open_rentals: number
    open_disputes: number
    cleared: boolean
  }[]
}
