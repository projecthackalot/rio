/**
 * Error raised when a Supabase query fails. PostgREST failures carry a `code`
 * (e.g. PGRST205, 42501); network failures (DNS, paused project, timeout)
 * don't, so the message always records the underlying cause as well. Never
 * includes query parameters or user data.
 */
export class DataUnavailableError extends Error {
  readonly code: string

  constructor(scope: string, cause: { code?: string; message?: string } | null | undefined) {
    const code = cause?.code || 'NETWORK'
    const detail = (cause?.message ?? 'no response').replace(/\s+/g, ' ').slice(0, 120)
    super(`${scope}: ${code} (${detail})`)
    this.name = 'DataUnavailableError'
    this.code = code
  }
}

export function queryError(scope: string, cause: { code?: string; message?: string } | null | undefined): DataUnavailableError {
  return new DataUnavailableError(scope, cause)
}
