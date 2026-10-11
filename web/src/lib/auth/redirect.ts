/**
 * Sanitises a post-login `next` destination. Only same-origin, absolute-path
 * URLs are allowed; anything that could leave the site ("//evil.com",
 * "/\\evil.com", "https://…", "javascript:") falls back to the default.
 */
export function safeNext(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string' || next.length === 0 || next.length > 512) return fallback
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\\]/.test(next)) return fallback
  try {
    const parsed = new URL(next, 'https://rio.invalid')
    if (parsed.origin !== 'https://rio.invalid') return fallback
    if (parsed.pathname.startsWith('/auth/')) return fallback
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return fallback
  }
}
