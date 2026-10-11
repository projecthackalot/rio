/**
 * Rental, deposit, rent-to-own and damage rules. All results are integer paise.
 * Percentages are basis points; rent and deposit are rounded half-up to the
 * nearest whole rupee (as in the prototype's `round(start × rate)`).
 */

import { applyBps, roundHalfUpDiv, BPS_DENOMINATOR, type Paise } from './money'
import { HOUR_MS } from './pricing'

export const RENTAL_PERIODS = {
  DAY: { bps: 200, hours: 24, label: 'Day' }, //       2% of start price
  WEEK: { bps: 1_000, hours: 168, label: 'Week' }, //  10%
  MONTH: { bps: 2_500, hours: 720, label: 'Month' }, // 25%
} as const

export type RentalPeriod = keyof typeof RENTAL_PERIODS
export const RENTAL_PERIOD_KEYS = Object.keys(RENTAL_PERIODS) as RentalPeriod[]

export const DEPOSIT_BPS = 2_000 //            20% of start price
export const RENT_TO_OWN_CREDIT_BPS = 5_000 // 50% of rent paid
export const DAMAGE_DEDUCTION_BPS = 2_500 //   25% of the deposit (proposed)
/** A departing owner's item must come back at least this long before they leave. */
export const RENTAL_RETURN_BUFFER_MS = 24 * HOUR_MS

export function rentalCostPaise(startPaise: Paise, period: RentalPeriod): Paise {
  return applyBps(startPaise, RENTAL_PERIODS[period].bps)
}

export function rentalDepositPaise(startPaise: Paise): Paise {
  return applyBps(startPaise, DEPOSIT_BPS)
}

export function rentalDurationMs(period: RentalPeriod): number {
  return RENTAL_PERIODS[period].hours * HOUR_MS
}

export type RentEligibility = { ok: true } | { ok: false; reason: string; neededHours: number; remainingHours: number }

/** Rule: hours until owner departure ≥ rental duration + 24h. Keeper items are always eligible. */
export function canRentBeforeDeparture(departureAt: Date | number | null, now: Date | number, period: RentalPeriod): RentEligibility {
  if (departureAt === null) return { ok: true }
  const remaining = +departureAt - +now
  const needed = rentalDurationMs(period) + RENTAL_RETURN_BUFFER_MS
  if (remaining >= needed) return { ok: true }
  const neededHours = needed / HOUR_MS
  const remainingHours = Math.max(0, Math.floor(remaining / HOUR_MS))
  return {
    ok: false,
    neededHours,
    remainingHours,
    reason: `The owner leaves too soon for a ${RENTAL_PERIODS[period].label.toLowerCase()} rental: ${neededHours}h needed, ${remainingHours}h left.`,
  }
}

export interface RentalQuote {
  period: RentalPeriod
  rentPaise: Paise
  depositPaise: Paise
  totalDuePaise: Paise
}

export function quoteRental(startPaise: Paise, period: RentalPeriod): RentalQuote {
  const rentPaise = rentalCostPaise(startPaise, period)
  const depositPaise = rentalDepositPaise(startPaise)
  return { period, rentPaise, depositPaise, totalDuePaise: rentPaise + depositPaise }
}

export interface RentToOwnQuote {
  currentPricePaise: Paise
  floorPaise: Paise
  rentPaidPaise: Paise
  /** 50% of rent paid, rounded half-up to the paisa. */
  earnedCreditPaise: Paise
  /** Credit actually used — reduced when the floor binds. */
  appliedCreditPaise: Paise
  buyPricePaise: Paise
  floorApplied: boolean
}

/** buy = max(floor, current − 50% × rent paid). The deposit is refunded separately. */
export function quoteRentToOwn(currentPricePaise: Paise, floorPaise: Paise, rentPaidPaise: Paise): RentToOwnQuote {
  const earnedCreditPaise = roundHalfUpDiv(rentPaidPaise * RENT_TO_OWN_CREDIT_BPS, BPS_DENOMINATOR)
  const uncapped = currentPricePaise - earnedCreditPaise
  const buyPricePaise = Math.max(floorPaise, uncapped)
  return {
    currentPricePaise,
    floorPaise,
    rentPaidPaise,
    earnedCreditPaise,
    appliedCreditPaise: Math.max(0, currentPricePaise - buyPricePaise),
    buyPricePaise,
    floorApplied: uncapped < floorPaise,
  }
}

export interface DepositSettlement {
  depositPaise: Paise
  deductionPaise: Paise
  refundPaise: Paise
}

/** Damage outcome: 25% of the deposit to the owner (rounded to ₹1), the rest back to the renter. */
export function settleDeposit(depositPaise: Paise, damaged: boolean): DepositSettlement {
  const deductionPaise = damaged ? Math.min(depositPaise, applyBps(depositPaise, DAMAGE_DEDUCTION_BPS)) : 0
  return { depositPaise, deductionPaise, refundPaise: depositPaise - deductionPaise }
}
