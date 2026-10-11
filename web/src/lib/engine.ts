/**
 * Legacy compatibility layer for the original prototype API (rupees and
 * simulated hours). New code should import from `@/domain/*`, which works in
 * integer paise and real timestamps; these wrappers delegate to it so the
 * rules exist in exactly one place.
 *
 * The prototype's `watchersCount` was removed: it fabricated watcher numbers,
 * which Level 1 must not present as real data.
 */

import { CATEGORIES as DOMAIN_CATEGORIES } from '@/domain/catalog'
import { estimateRentalImpact, estimateTransferImpact } from '@/domain/impact'
import { PAISE_PER_RUPEE, rupeesToPaise } from '@/domain/money'
import { HOUR_MS, currentPricePaise, urgency } from '@/domain/pricing'
import { quoteRentToOwn, rentalCostPaise, rentalDepositPaise, type RentalPeriod } from '@/domain/rental'

export const DECAY_END_BEFORE_DEPARTURE = 2
export const STAFF_CUTOFF_BEFORE_DEPARTURE = 1

const LEGACY_NAME_TO_SLUG: Record<string, string> = {
  'Air cooler': 'air-cooler',
  'Foam mattress': 'foam-mattress',
  'Kettle/immersion': 'kettle-immersion',
  'Drafter+board': 'drafter-board',
  'Study table+chair': 'study-table-chair',
}

export const CATEGORIES = Object.fromEntries(
  Object.entries(LEGACY_NAME_TO_SLUG).map(([name, slug]) => {
    const c = DOMAIN_CATEGORIES.find((x) => x.slug === slug)!
    return [
      name,
      {
        tare_kg: c.tareKg,
        volume_m3: c.volumeM3,
        embodied_co2e: c.embodiedCo2eKg,
        default_start: c.defaultStartPaise / PAISE_PER_RUPEE,
        default_floor: c.defaultFloorPaise / PAISE_PER_RUPEE,
      },
    ]
  }),
)

const toRupees = (p: number) => p / PAISE_PER_RUPEE

/** Level 1 ships the prototype's default linear curve only (alpha = 1). */
export function dutchPrice(startPrice: number, floorPrice: number, listedHour: number, departureHour: number, simHour: number, alpha = 1): number {
  if (alpha !== 1) throw new RangeError('Only the linear decay curve (alpha = 1) is supported')
  return toRupees(
    currentPricePaise(
      { startPaise: rupeesToPaise(startPrice), floorPaise: rupeesToPaise(floorPrice), listedAt: listedHour * HOUR_MS, departureAt: departureHour * HOUR_MS },
      simHour * HOUR_MS,
    ),
  )
}

export function hoursRemaining(departureHour: number | null, simHour: number): number | null {
  if (departureHour === null) return null
  return Math.max(0, departureHour - simHour)
}

export function effectiveStatus(storedStatus: string, departureHour: number | null, simHour: number): string {
  const hr = hoursRemaining(departureHour, simHour)
  if (hr !== null && hr <= STAFF_CUTOFF_BEFORE_DEPARTURE) {
    if (storedStatus === 'ACTIVE') return 'STAFF_RESERVE'
    if (storedStatus === 'RENTED') return 'RETURN_DUE'
  }
  return storedStatus
}

/** Prototype badge names: KEEPER, FRESH (>48h), DROPPING (>3h), CRITICAL (≤3h). */
export function urgencyBadge(departureHour: number | null, simHour: number): string {
  const u = urgency(departureHour === null ? null : departureHour * HOUR_MS, simHour * HOUR_MS)
  return u === 'FINAL_HOUR' || u === 'DEPARTED' ? 'CRITICAL' : u
}

function legacyImpact(slug: string | undefined, fn: typeof estimateTransferImpact) {
  const i = fn(slug ?? '')
  return { co2_avoided_kg: i.co2eAvoidedKg, waste_diverted_kg: i.wasteDivertedKg, volume_diverted_m3: i.volumeDivertedM3 }
}

export const impactSaleOrTransfer = (category: string) => legacyImpact(LEGACY_NAME_TO_SLUG[category], estimateTransferImpact)
export const impactRental = (category: string, substitutionRate = 0.5) =>
  legacyImpact(LEGACY_NAME_TO_SLUG[category], (slug) => estimateRentalImpact(slug, substitutionRate))

export const rentalCost = (startPrice: number, period: string) => toRupees(rentalCostPaise(rupeesToPaise(startPrice), period as RentalPeriod))

export const rentalDeposit = (startPrice: number) => toRupees(rentalDepositPaise(rupeesToPaise(startPrice)))

export function rentToOwnPrice(currentDutchPrice: number, floorPrice: number, totalRentPaid: number) {
  const q = quoteRentToOwn(rupeesToPaise(currentDutchPrice), rupeesToPaise(floorPrice), rupeesToPaise(totalRentPaid))
  return { buyPrice: toRupees(q.buyPricePaise), credit: toRupees(q.earnedCreditPaise), currentDutchPrice }
}
