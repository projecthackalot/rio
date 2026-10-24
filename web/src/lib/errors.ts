/**
 * Next.js signals redirects, notFound() and dynamic bailouts by throwing
 * errors that carry a `digest`. Code that catches data errors to show a
 * friendly fallback must re-throw these so the framework still works.
 */
export function isFrameworkError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'digest' in error
}
