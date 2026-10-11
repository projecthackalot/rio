/**
 * Money helpers. All RIO amounts are integer **paise** (₹1 = 100 paise),
 * mirroring the `bigint` `*_paise` columns in Postgres. No floating-point
 * value ever represents money; percentage maths uses basis points (1% = 100 bps)
 * and an explicit round-half-up integer division.
 *
 * Every balance in Level 1 is a SANDBOX value — no real money moves.
 */

export type Paise = number

export const PAISE_PER_RUPEE = 100
export const BPS_DENOMINATOR = 10_000

/** Largest listing price accepted (₹1,00,000) — keeps all intermediate products well inside 2^53. */
export const MAX_PRICE_PAISE = 100_000 * PAISE_PER_RUPEE

export function assertPaise(value: number, label = 'amount'): asserts value is Paise {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be an integer number of paise, got ${value}`)
  }
}

/**
 * Integer division rounded half-up (towards +∞ on exact .5) for a non-negative
 * numerator and positive denominator. Matches SQL `floor((2n + d) / (2d))`.
 */
export function roundHalfUpDiv(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new RangeError('denominator must be positive')
  if (numerator < 0) throw new RangeError('numerator must be non-negative')
  return Math.floor((2 * numerator + denominator) / (2 * denominator))
}

/** `amount × bps / 10000`, rounded half-up to the nearest multiple of `stepPaise`. */
export function applyBps(amount: Paise, bps: number, stepPaise: Paise = PAISE_PER_RUPEE): Paise {
  assertPaise(amount)
  return roundHalfUpDiv(amount * bps, BPS_DENOMINATOR * stepPaise) * stepPaise
}

export function rupeesToPaise(rupees: number): Paise {
  const paise = Math.round(rupees * PAISE_PER_RUPEE)
  assertPaise(paise, 'rupees')
  return paise
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

/** Formats paise as ₹ with Indian digit grouping, e.g. 180000 → "₹1,800". */
export function formatINR(paise: Paise): string {
  return inr.format(paise / PAISE_PER_RUPEE)
}

/** Signed variant used in ledgers: "+₹36" / "−₹36". */
export function formatSignedINR(paise: Paise): string {
  if (paise === 0) return formatINR(0)
  return `${paise > 0 ? '+' : '−'}${formatINR(Math.abs(paise))}`
}
