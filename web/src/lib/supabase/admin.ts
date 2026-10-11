import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client. It BYPASSES Row Level Security, so it is deliberately
 * not used by any page, Server Action or route handler — every user action
 * goes through the user's own session and RLS. It exists only for trusted
 * operator tooling (scripts/seed-demo.ts imports its own copy) and is created
 * lazily so a missing key never breaks normal requests.
 *
 * SUPABASE_SERVICE_ROLE_KEY must never be prefixed with NEXT_PUBLIC_.
 */
export function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Service-role access is not configured (SUPABASE_SERVICE_ROLE_KEY).')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
