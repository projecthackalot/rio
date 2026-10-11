/**
 * Dutch-auction pricing — the authoritative TypeScript rules. The SQL function
 * `public.rio_current_price` implements the identical integer algorithm and is
 * what the database uses when a claim is placed; the shared fixtures in
 * `pricing.fixtures.json` are asserted against both.
 *
 * Rules (see docs/level-1/BUSINESS_RULES.md):
 *  - Price decays linearly (alpha = 1) from start → floor over
 *    [listed_at, departure_at − 2h].
 *  - Elapsed time is measured in whole seconds (floored).
 *  - The raw price is rounded half-up to the nearest ₹5, then clamped into
 *    [floor, start] so rounding can never undercut the seller's floor.
 *  - A listing without a departure ("keeper") never decays.
 *  - If the decay window is empty or negative the price is the floor.
 */

import { roundHalfUpDiv, type Paise } from './money'

export const HOUR_MS = 3_600_000
export const DECAY_END_BEFORE_DEPARTURE_MS = 2 * HOUR_MS
export const STAFF_CUTOFF_BEFORE_DEPARTURE_MS = 1 * HOUR_MS
export const PRICE_STEP_PAISE: Paise = 500 // ₹5

export interface AuctionInput {
  startPaise: Paise
  floorPaise: Paise
  listedAt: Date | number
  departureAt: Date | number | null
}

const ms = (d: Date | number) => (typeof d === 'number' ? d : d.getTime())

export function decayEndsAt(departureAt: Date | number): number {
  return ms(departureAt) - DECAY_END_BEFORE_DEPARTURE_MS
}

export function currentPricePaise(input: AuctionInput, now: Date | number): Paise {
  const { startPaise, floorPaise } = input
  if (input.departureAt === null) return startPaise

  const listed = Math.floor(ms(input.listedAt) / 1000)
  const decayEnd = Math.floor(decayEndsAt(input.departureAt) / 1000)
  const span = decayEnd - listed
  if (span <= 0) return floorPaise

  const elapsed = Math.min(span, Math.max(0, Math.floor(ms(now) / 1000) - listed))
  // raw = start − (start − floor) × elapsed / span, kept as an exact fraction N / span.
  const numerator = startPaise * span - (startPaise - floorPaise) * elapsed
  const rounded = roundHalfUpDiv(numerator, span * PRICE_STEP_PAISE) * PRICE_STEP_PAISE
  return Math.min(startPaise, Math.max(floorPaise, rounded))
}

/** Fraction (0–1) of the decay window that has elapsed — for progress bars. */
export function decayProgress(input: AuctionInput, now: Date | number): number {
  if (input.departureAt === null) return 0
  const span = decayEndsAt(input.departureAt) - ms(input.listedAt)
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (ms(now) - ms(input.listedAt)) / span))
}

export type AuctionPhase =
  | 'keeper' //       no departure: fixed price
  | 'decaying' //     price is falling
  | 'floor' //        reached floor, still claimable
  | 'final_hour' //   ≤ 1h before departure: no claims/rentals, staff-routable
  | 'departed' //     departure has passed

export function auctionPhase(input: Pick<AuctionInput, 'departureAt'>, now: Date | number): AuctionPhase {
  if (input.departureAt === null) return 'keeper'
  const dep = ms(input.departureAt)
  const t = ms(now)
  if (t >= dep) return 'departed'
  if (t >= dep - STAFF_CUTOFF_BEFORE_DEPARTURE_MS) return 'final_hour'
  if (t >= dep - DECAY_END_BEFORE_DEPARTURE_MS) return 'floor'
  return 'decaying'
}

/** True when a student may still claim or rent the listing (time rule only). */
export function isWithinTradingWindow(departureAt: Date | number | null, now: Date | number): boolean {
  const phase = auctionPhase({ departureAt }, now)
  return phase === 'keeper' || phase === 'decaying' || phase === 'floor'
}

/** True when the warden may route the listing to campus staff. */
export function isStaffRoutable(departureAt: Date | number | null, now: Date | number): boolean {
  const phase = auctionPhase({ departureAt }, now)
  return phase === 'final_hour' || phase === 'departed'
}

export type Urgency = 'KEEPER' | 'FRESH' | 'DROPPING' | 'CRITICAL' | 'FINAL_HOUR' | 'DEPARTED'

/** Display urgency. Thresholds follow the prototype: >48h fresh, >3h dropping. */
export function urgency(departureAt: Date | number | null, now: Date | number): Urgency {
  if (departureAt === null) return 'KEEPER'
  const remaining = ms(departureAt) - ms(now)
  if (remaining <= 0) return 'DEPARTED'
  if (remaining <= STAFF_CUTOFF_BEFORE_DEPARTURE_MS) return 'FINAL_HOUR'
  if (remaining > 48 * HOUR_MS) return 'FRESH'
  if (remaining > 3 * HOUR_MS) return 'DROPPING'
  return 'CRITICAL'
}
