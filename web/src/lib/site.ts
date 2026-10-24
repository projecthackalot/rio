/** Site-wide facts used by metadata, the sitemap and the public pages. */
export const SITE = {
  name: 'RIO',
  tagline: 'Hostel move-out marketplace',
  description:
    'Sell, rent or hand over your hostel essentials before you leave campus. Prices drop as your departure nears; whatever is left goes to campus staff, not the bin.',
  /** Public project page: the only contact channel that verifiably exists for the pilot. */
  repoUrl: 'https://github.com/projecthackalot/rio',
  issuesUrl: 'https://github.com/projecthackalot/rio/issues',
  pilot: 'Level 1 pilot',
} as const

/** Canonical origin for metadata/sitemap. Falls back to localhost for local builds. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}
