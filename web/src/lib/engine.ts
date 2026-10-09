import * as crypto from 'crypto';

// ── Category coefficients ──────────────────────────────────────────────────
export const CATEGORIES: Record<string, {
  tare_kg: number;
  volume_m3: number;
  embodied_co2e: number;
  default_start: number;
  default_floor: number;
  emoji: string;
}> = {
  "Air cooler": {
    tare_kg: 14.5, volume_m3: 0.28, embodied_co2e: 62.0,
    default_start: 1800, default_floor: 500, emoji: "❄️",
  },
  "Foam mattress": {
    tare_kg: 11.2, volume_m3: 0.35, embodied_co2e: 44.0,
    default_start: 1200, default_floor: 300, emoji: "🛏️",
  },
  "Kettle/immersion": {
    tare_kg: 1.2, volume_m3: 0.01, embodied_co2e: 15.5,
    default_start: 500, default_floor: 150, emoji: "🫖",
  },
  "Drafter+board": {
    tare_kg: 1.8, volume_m3: 0.04, embodied_co2e: 8.2,
    default_start: 450, default_floor: 150, emoji: "📐",
  },
  "Study table+chair": {
    tare_kg: 18.0, volume_m3: 0.42, embodied_co2e: 52.0,
    default_start: 1500, default_floor: 400, emoji: "🪑",
  },
};

const LOGISTICS_CO2_PER_TRANSFER = 2.2;
export const DECAY_END_BEFORE_DEPARTURE = 2;
export const STAFF_CUTOFF_BEFORE_DEPARTURE = 1;
export const DEFAULT_ALPHA = 1.0;

export const RENT_RATES: Record<string, { fraction: number; hours: number }> = {
  "DAY": { fraction: 0.02, hours: 24 },
  "WEEK": { fraction: 0.10, hours: 168 },
  "MONTH": { fraction: 0.25, hours: 720 },
};

export const DEPOSIT_FRACTION = 0.20;
export const RENT_TO_OWN_CREDIT_FRACTION = 0.50;
export const DAMAGE_DEDUCTION_FRACTION = 0.25;

// ── Pricing ────────────────────────────────────────────────────────────────

export function dutchPrice(
  startPrice: number,
  floorPrice: number,
  listedHour: number,
  departureHour: number,
  simHour: number,
  alpha: number = DEFAULT_ALPHA
): number {
  const decayEnd = departureHour - DECAY_END_BEFORE_DEPARTURE;
  const span = decayEnd - listedHour;
  if (span <= 0) return _round5(floorPrice);
  
  const frac = Math.max(0.0, Math.min(1.0, (simHour - listedHour) / span));
  const price = Math.max(floorPrice, startPrice - Math.pow(frac, alpha) * (startPrice - floorPrice));
  return _round5(price);
}

function _round5(value: number): number {
  return Math.round(value / 5) * 5;
}

// ── Status derivation ─────────────────────────────────────────────────────

export function hoursRemaining(departureHour: number | null, simHour: number): number | null {
  if (departureHour === null) return null;
  return Math.max(0, departureHour - simHour);
}

export function effectiveStatus(storedStatus: string, departureHour: number | null, simHour: number): string {
  if (departureHour === null) return storedStatus;
  const hr = hoursRemaining(departureHour, simHour);
  if (hr !== null && hr <= STAFF_CUTOFF_BEFORE_DEPARTURE) {
    if (storedStatus === "ACTIVE") return "STAFF_RESERVE";
    if (storedStatus === "RENTED") return "RETURN_DUE";
  }
  return storedStatus;
}

export function urgencyBadge(departureHour: number | null, simHour: number): string {
  const hr = hoursRemaining(departureHour, simHour);
  if (hr === null) return "KEEPER";
  if (hr > 48) return "FRESH";
  if (hr > 3) return "DROPPING";
  return "CRITICAL";
}

export function watchersCount(
  itemId: string,
  simHour: number,
  departureHour: number | null,
  startPrice: number,
  floorPrice: number,
  listedHour: number
): number {
  // Deterministic random
  const hash = crypto.createHash('md5').update(itemId).digest('hex').slice(0, 8);
  const seed = parseInt(hash, 16);
  const base = (seed % 5) + 2; // 2-6
  
  let extra = 0;
  if (departureHour !== null && departureHour > listedHour) {
    const decayEnd = departureHour - DECAY_END_BEFORE_DEPARTURE;
    const span = Math.max(1, decayEnd - listedHour);
    const frac = Math.max(0.0, Math.min(1.0, (simHour - listedHour) / span));
    extra = Math.floor(frac * 12);
  }
  return base + extra;
}

// ── Impact math ────────────────────────────────────────────────────────────

export function impactSaleOrTransfer(category: string): { co2_avoided_kg: number; waste_diverted_kg: number; volume_diverted_m3: number } {
  const cat = CATEGORIES[category];
  if (!cat) return { co2_avoided_kg: 0, waste_diverted_kg: 0, volume_diverted_m3: 0 };
  return {
    co2_avoided_kg: cat.embodied_co2e + LOGISTICS_CO2_PER_TRANSFER,
    waste_diverted_kg: cat.tare_kg,
    volume_diverted_m3: cat.volume_m3,
  };
}

export function impactRental(category: string, substitutionRate: number = 0.5): { co2_avoided_kg: number; waste_diverted_kg: number; volume_diverted_m3: number } {
  const cat = CATEGORIES[category];
  if (!cat) return { co2_avoided_kg: 0, waste_diverted_kg: 0, volume_diverted_m3: 0 };
  return {
    co2_avoided_kg: cat.embodied_co2e * substitutionRate,
    waste_diverted_kg: 0.0,
    volume_diverted_m3: 0.0,
  };
}

// ── Rental calculations ───────────────────────────────────────────────────

export function rentalCost(startPrice: number, period: string): number {
  const rate = RENT_RATES[period]?.fraction || 0;
  return Math.round(startPrice * rate);
}

export function rentalDeposit(startPrice: number): number {
  return Math.round(startPrice * DEPOSIT_FRACTION);
}

export function rentToOwnPrice(
  currentDutchPrice: number,
  floorPrice: number,
  totalRentPaid: number
): { buyPrice: number; credit: number; currentDutchPrice: number } {
  const credit = totalRentPaid * RENT_TO_OWN_CREDIT_FRACTION;
  const buyPrice = Math.max(floorPrice, currentDutchPrice - credit);
  return { buyPrice, credit, currentDutchPrice };
}
