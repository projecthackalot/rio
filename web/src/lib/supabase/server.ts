import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { publicEnv } from '@/lib/env'

const SUPABASE_TIMEOUT_MS = 8_000

/**
 * Per-request Supabase client acting as the signed-in user (anon key + the
 * user's session cookie). Every query runs under that user's RLS policies.
 */
export async function createClient() {
  const cookieStore = await cookies()
  // A session is request-time data. Supabase's auth client checks token expiry
  // with Date.now(); without this, Next's prefetch render rejects that read and
  // a signed-in user would be treated as signed out.
  await connection()
  const env = publicEnv()

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    // Fail a hung request instead of holding the page (and a serverless function) open.
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(SUPABASE_TIMEOUT_MS) }) },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component, which cannot set cookies. The proxy
          // (src/proxy.ts) refreshes the session cookie on every request instead.
        }
      },
    },
  })
}
