import 'server-only'
import { connection } from 'next/server'

/**
 * The current time for a request-time render. `connection()` marks the
 * render as dynamic, so prices and countdowns are never baked into a
 * prerendered page or cached across requests.
 */
export async function requestNow(): Promise<number> {
  await connection()
  return Date.now()
}
