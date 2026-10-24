import type { MetadataRoute } from 'next'
import { PUBLIC_PAGES } from '@/lib/auth/route-policy'
import { siteUrl } from '@/lib/site'

/**
 * Static public pages only. Individual listings are short-lived (they expire
 * at the owner's departure), so they are reachable from /marketplace rather
 * than enumerated here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return PUBLIC_PAGES.map((path) => ({
    url: `${base}${path === '/' ? '' : path}`,
    changeFrequency: path === '/marketplace' ? 'hourly' : 'monthly',
    priority: path === '/' ? 1 : path === '/marketplace' ? 0.9 : 0.5,
  }))
}
