import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'student' | 'warden' | 'staff' | 'admin'

export interface Viewer {
  id: string
  email: string | null
  fullName: string
  role: Role
  hostelId: string | null
  hostelName: string | null
  avatarUrl: string | null
}

/**
 * Data Access Layer: the single place that resolves "who is making this
 * request". The JWT is verified by `getClaims()`; the role is read from the
 * profiles table (never from user-editable metadata). Memoised per request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (!claims?.sub) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, hostel_id, avatar_url, hostels:hostels!hostel_id(name)')
    .eq('id', claims.sub)
    .maybeSingle()
  // A failed lookup must be visible in the logs: silently returning null looks like "signed out".
  if (error) console.error('[auth:profile]', error.code, error.message.slice(0, 160))
  if (!profile) return null

  const hostel = profile.hostels as unknown as { name: string } | null
  return {
    id: profile.id,
    email: (claims.email as string | undefined) ?? null,
    fullName: profile.full_name,
    role: profile.role as Role,
    hostelId: profile.hostel_id,
    hostelName: hostel?.name ?? null,
    avatarUrl: profile.avatar_url,
  }
})

/** Signed-in viewer, or a redirect to login that comes back to `returnTo`. */
export async function requireViewer(returnTo = '/dashboard'): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect(`/auth/login?next=${encodeURIComponent(returnTo)}`)
  return viewer
}

export function hasRole(viewer: Viewer, roles: readonly Role[]): boolean {
  return viewer.role === 'admin' || roles.includes(viewer.role)
}
