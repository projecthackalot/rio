import { z } from 'zod'

/**
 * Public (browser-safe) configuration. Only NEXT_PUBLIC_* values belong here,
 * and none of them is privileged: the anon key is designed to be public and
 * all data access is enforced by Postgres RLS.
 *
 * Each variable is referenced literally so Next.js can inline it at build time.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: 'NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL' }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing'),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
})

export type PublicEnv = z.infer<typeof publicSchema>

let cached: PublicEnv | undefined

export function publicEnv(): PublicEnv {
  if (cached) return cached
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  })
  if (!parsed.success) {
    throw new Error(`Invalid public environment configuration — copy web/.env.example to web/.env.local.\n${z.prettifyError(parsed.error)}`)
  }
  cached = parsed.data
  return cached
}

/** Public URL for an object in the `listing-media` bucket. */
export function listingMediaUrl(path: string): string {
  return `${publicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/listing-media/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}
