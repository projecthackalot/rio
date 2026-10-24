import 'server-only'
import { queryError } from './query-error'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, CONDITION_KEYS, type Condition } from '@/domain/catalog'
import { STAFF_CUTOFF_BEFORE_DEPARTURE_MS } from '@/domain/pricing'
import type { ListingStatus } from '@/domain/stateMachine'

export const PAGE_SIZE = 12

export const SORTS = {
  ending: 'Leaving soonest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest',
} as const
export type Sort = keyof typeof SORTS

const optionalText = z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined), z.string().max(80).optional())
const optionalRupees = z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : undefined), z.number().int().min(0).max(100_000).optional())

/** Marketplace query string → validated filters. Invalid values are dropped, never trusted. */
export const marketplaceFiltersSchema = z.object({
  q: optionalText,
  category: z
    .enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]])
    .optional()
    .catch(undefined),
  condition: z
    .enum(CONDITION_KEYS as [Condition, ...Condition[]])
    .optional()
    .catch(undefined),
  min: optionalRupees.catch(undefined),
  max: optionalRupees.catch(undefined),
  rentable: z.preprocess((v) => v === '1' || v === 'on', z.boolean()).catch(false),
  sort: z.enum(Object.keys(SORTS) as [Sort, ...Sort[]]).catch('ending'),
  page: z.coerce.number().int().min(1).max(500).catch(1),
})
export type MarketplaceFilters = z.infer<typeof marketplaceFiltersSchema>

export type ParsedFilters = MarketplaceFilters & { rangeSwapped: boolean }

/**
 * Validates the query string. A reversed price range (min above max) is
 * corrected by swapping, and flagged so the page can say so.
 */
export function parseFilters(params: Record<string, string | string[] | undefined>): ParsedFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
  const f = marketplaceFiltersSchema.parse(flat)
  if (f.min !== undefined && f.max !== undefined && f.min > f.max) return { ...f, min: f.max, max: f.min, rangeSwapped: true }
  return { ...f, rangeSwapped: false }
}

export interface ListingCard {
  id: string
  title: string
  status: ListingStatus
  condition: Condition
  is_rentable: boolean
  category_slug: string
  category_name: string
  start_price_paise: number
  floor_price_paise: number
  current_price_paise: number
  listed_at: string
  departure_at: string | null
  hostel_name: string | null
  cover_path: string | null
  cover_alt: string | null
  /** Small (~480 px) version for cards; null for photos uploaded before thumbnails existed. */
  cover_thumb_path: string | null
}

const CARD_COLUMNS =
  'id, title, status, condition, is_rentable, category_slug, category_name, start_price_paise, floor_price_paise, current_price_paise, listed_at, departure_at, hostel_name, cover_path, cover_alt, cover_thumb_path'

function normaliseCard(r: Record<string, unknown>): ListingCard {
  return {
    ...(r as unknown as ListingCard),
    start_price_paise: Number(r.start_price_paise),
    floor_price_paise: Number(r.floor_price_paise),
    current_price_paise: Number(r.current_price_paise),
  }
}

/**
 * One paginated query against the `listing_cards` view (live price + cover
 * image joined in SQL, so no N+1). Only listings still inside their trading
 * window are shown; final-hour items belong to the staff queue.
 */
export async function getMarketplace(filters: MarketplaceFilters, now: number) {
  const supabase = await createClient()
  const cutoff = new Date(now + STAFF_CUTOFF_BEFORE_DEPARTURE_MS).toISOString()
  let query = supabase
    .from('listing_cards')
    .select(CARD_COLUMNS, { count: 'exact' })
    .eq('status', 'ACTIVE')
    .or(`departure_at.is.null,departure_at.gt.${cutoff}`)

  if (filters.q) query = query.textSearch('search', filters.q, { type: 'websearch', config: 'simple' })
  if (filters.category) query = query.eq('category_slug', filters.category)
  if (filters.condition) query = query.eq('condition', filters.condition)
  if (filters.rentable) query = query.eq('is_rentable', true)
  if (filters.min !== undefined) query = query.gte('current_price_paise', filters.min * 100)
  if (filters.max !== undefined) query = query.lte('current_price_paise', filters.max * 100)

  switch (filters.sort) {
    case 'price_asc':
      query = query.order('current_price_paise', { ascending: true }).order('id')
      break
    case 'price_desc':
      query = query.order('current_price_paise', { ascending: false }).order('id')
      break
    case 'newest':
      query = query.order('listed_at', { ascending: false }).order('id')
      break
    default:
      query = query.order('departure_at', { ascending: true, nullsFirst: false }).order('id')
  }

  const from = (filters.page - 1) * PAGE_SIZE
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)
  if (error) {
    // PGRST103: requested page is past the end — treat as empty rather than failing.
    if (error.code === 'PGRST103') return { items: [] as ListingCard[], total: count ?? 0 }
    throw queryError('marketplace', error)
  }
  return { items: (data ?? []).map(normaliseCard), total: count ?? 0 }
}

export async function getMyListings(ownerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('listing_cards').select(CARD_COLUMNS).eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(50)
  if (error) throw queryError('my listings', error)
  return (data ?? []).map(normaliseCard)
}

export interface ListingDetail {
  id: string
  owner_id: string
  title: string
  description: string | null
  status: ListingStatus
  condition: Condition
  is_rentable: boolean
  category_slug: string
  start_price_paise: number
  floor_price_paise: number
  listed_at: string
  departure_at: string | null
  hostel_id: string | null
  category: { name: string; embodied_co2e_kg: number; tare_kg: number; volume_m3: number }
  hostel: { name: string } | null
  media: { id: string; storage_path: string; thumb_path: string | null; alt_text: string; position: number }[]
}

export async function getListing(id: string): Promise<ListingDetail | null> {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select(
      `id, owner_id, title, description, status, condition, is_rentable, category_slug, start_price_paise, floor_price_paise,
       listed_at, departure_at, hostel_id,
       category:categories!category_slug(name, embodied_co2e_kg, tare_kg, volume_m3),
       hostel:hostels!hostel_id(name),
       media:listing_media!listing_id(id, storage_path, thumb_path, alt_text, position)`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw queryError('listing', error)
  if (!data) return null
  const d = data as unknown as ListingDetail
  return {
    ...d,
    start_price_paise: Number(d.start_price_paise),
    floor_price_paise: Number(d.floor_price_paise),
    category: {
      name: d.category.name,
      embodied_co2e_kg: Number(d.category.embodied_co2e_kg),
      tare_kg: Number(d.category.tare_kg),
      volume_m3: Number(d.category.volume_m3),
    },
    media: [...(d.media ?? [])].sort((a, b) => a.position - b.position),
  }
}

/** Owner's display name (first name + initial) — visible to signed-in members only via RLS. */
export async function getOwnerName(ownerId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('full_name').eq('id', ownerId).maybeSingle()
  if (!data) return null
  const [first, ...rest] = data.full_name.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}

/** Which of the given listings the signed-in viewer has saved (one query; empty for signed-out visitors). */
export async function getSavedIds(listingIds: string[]): Promise<Set<string>> {
  if (!listingIds.length) return new Set()
  const supabase = await createClient()
  const { data, error } = await supabase.from('favorites').select('listing_id').in('listing_id', listingIds)
  if (error) return new Set() // anonymous visitors have no access: nothing is saved
  return new Set((data ?? []).map((r) => r.listing_id as string))
}

/** The viewer's saved listings, newest save first. Listings that are no longer visible to them drop out. */
export async function getSavedListings(): Promise<ListingCard[]> {
  const supabase = await createClient()
  const { data: favs, error } = await supabase.from('favorites').select('listing_id, created_at').order('created_at', { ascending: false }).limit(100)
  if (error) throw queryError('saved', error)
  const ids = (favs ?? []).map((f) => f.listing_id as string)
  if (!ids.length) return []
  const { data, error: e2 } = await supabase.from('listing_cards').select(CARD_COLUMNS).in('id', ids)
  if (e2) throw queryError('saved listings', e2)
  const byId = new Map((data ?? []).map((r) => [r.id as string, normaliseCard(r)]))
  return ids.map((id) => byId.get(id)).filter((c): c is ListingCard => Boolean(c))
}
