import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/** Browser client (anon key + session cookie). Used only where a client island needs it. */
export function createClient() {
  const env = publicEnv()
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
