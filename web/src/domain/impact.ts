/**
 * Estimated environmental impact. These are modelled ESTIMATES using the
 * prototype's coefficients, never measured results.
 *
 *  - Sale or staff transfer: embodied CO2e of the item plus avoided logistics
 *    (8 km × 0.275 kgCO2e/km = 2.2 kg); waste and volume = the item's tare.
 *  - Completed rental: embodied CO2e × substitution rate (default 0.5) — the
 *    share of renters assumed to have otherwise bought new.
 */

import { CATEGORY_BY_SLUG } from './catalog'

export const LOGISTICS_CO2E_PER_TRANSFER_KG = 8 * 0.275
export const DEFAULT_RENTAL_SUBSTITUTION_RATE = 0.5

export interface ImpactEstimate {
  co2eAvoidedKg: number
  wasteDivertedKg: number
  volumeDivertedM3: number
}

const ZERO: ImpactEstimate = { co2eAvoidedKg: 0, wasteDivertedKg: 0, volumeDivertedM3: 0 }

export function estimateTransferImpact(categorySlug: string): ImpactEstimate {
  const c = CATEGORY_BY_SLUG.get(categorySlug)
  if (!c || c.embodiedCo2eKg === 0) return ZERO
  return {
    co2eAvoidedKg: c.embodiedCo2eKg + LOGISTICS_CO2E_PER_TRANSFER_KG,
    wasteDivertedKg: c.tareKg,
    volumeDivertedM3: c.volumeM3,
  }
}

export function estimateRentalImpact(categorySlug: string, substitutionRate = DEFAULT_RENTAL_SUBSTITUTION_RATE): ImpactEstimate {
  const c = CATEGORY_BY_SLUG.get(categorySlug)
  if (!c) return ZERO
  return { co2eAvoidedKg: c.embodiedCo2eKg * substitutionRate, wasteDivertedKg: 0, volumeDivertedM3: 0 }
}

export function sumImpact(items: ImpactEstimate[]): ImpactEstimate {
  return items.reduce(
    (acc, i) => ({
      co2eAvoidedKg: acc.co2eAvoidedKg + i.co2eAvoidedKg,
      wasteDivertedKg: acc.wasteDivertedKg + i.wasteDivertedKg,
      volumeDivertedM3: acc.volumeDivertedM3 + i.volumeDivertedM3,
    }),
    ZERO,
  )
}

export function hasImpactEstimate(categorySlug: string): boolean {
  return (CATEGORY_BY_SLUG.get(categorySlug)?.embodiedCo2eKg ?? 0) > 0
}

export function formatKg(kg: number): string {
  return `${kg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`
}
