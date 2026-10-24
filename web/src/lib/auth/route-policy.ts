/**
 * Central route policy. RIO is a marketplace: browsing is public, acting
 * requires an account, and operations screens require a role.
 *
 * This is the FIRST gate only (used by the proxy to redirect early). It is not
 * an authorization boundary: every page re-checks the viewer on the server,
 * and every write is authorized again in Postgres (RLS + the RPCs' own checks).
 */

export type Access = 'public' | 'signed-in' | 'warden' | 'staff' | 'admin'

/** Public pages, listed so tests and the sitemap share one source of truth. */
export const PUBLIC_PAGES = [
  '/',
  '/marketplace',
  '/how-it-works',
  '/about',
  '/campus-impact',
  '/trust-and-safety',
  '/help',
  '/contact',
  '/privacy',
  '/terms',
  '/accessibility',
] as const

/** Prefixes that need a signed-in user, with the role (if any) the page itself enforces. */
const PROTECTED: readonly { prefix: string; access: Exclude<Access, 'public'> }[] = [
  { prefix: '/dashboard', access: 'signed-in' },
  { prefix: '/sell', access: 'signed-in' },
  { prefix: '/saved', access: 'signed-in' },
  { prefix: '/activity', access: 'signed-in' },
  { prefix: '/rentals', access: 'signed-in' },
  { prefix: '/handover', access: 'signed-in' },
  { prefix: '/disputes', access: 'signed-in' },
  { prefix: '/settings', access: 'signed-in' },
  { prefix: '/warden', access: 'warden' },
  { prefix: '/staff', access: 'staff' },
  { prefix: '/admin', access: 'admin' },
]

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)

/** What a path requires. Unknown paths are public (they render the 404 page). */
export function accessFor(pathname: string): Access {
  if (/^\/items\/[^/]+\/edit\/?$/.test(pathname)) return 'signed-in'
  return PROTECTED.find((p) => matches(pathname, p.prefix))?.access ?? 'public'
}

export function isProtectedPath(pathname: string): boolean {
  return accessFor(pathname) !== 'public'
}
