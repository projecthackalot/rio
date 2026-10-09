import { describe, it, expect } from 'vitest';
import {
  dutchPrice,
  effectiveStatus,
  urgencyBadge,
  impactSaleOrTransfer,
  impactRental,
  rentalCost,
  rentToOwnPrice,
  DECAY_END_BEFORE_DEPARTURE,
  STAFF_CUTOFF_BEFORE_DEPARTURE,
} from './engine';

describe('Engine Pricing', () => {
  it('at listed hour returns start price', () => {
    expect(dutchPrice(1800, 500, 0, 168, 0)).toBe(1800);
  });

  it('at halfway point returns midpoint (linear alpha=1)', () => {
    // Span = 168 - 2 - 0 = 166. Midpoint simHour = 83
    expect(dutchPrice(1800, 500, 0, 168, 83, 1.0)).toBe(1150);
  });

  it('hits floor price exactly DECAY_END_BEFORE_DEPARTURE hours before departure', () => {
    const floorHour = 168 - DECAY_END_BEFORE_DEPARTURE;
    expect(dutchPrice(1800, 500, 0, 168, floorHour)).toBe(500);
  });

  it('never breaches floor price even past departure', () => {
    expect(dutchPrice(1800, 500, 0, 168, 170)).toBe(500);
  });

  it('rounds to nearest 5', () => {
    // 1800 to 500 span 166. simHour 10 => frac = 10/166 = 0.06024
    // price = 1800 - (0.06024 * 1300) = 1721.687 => rounds to 1720
    expect(dutchPrice(1800, 500, 0, 168, 10)).toBe(1720);
  });
});

describe('Effective Status', () => {
  it('returns stored status if well before departure', () => {
    expect(effectiveStatus("ACTIVE", 168, 100)).toBe("ACTIVE");
  });

  it('returns STAFF_RESERVE if ACTIVE within cutoff', () => {
    expect(effectiveStatus("ACTIVE", 168, 168 - STAFF_CUTOFF_BEFORE_DEPARTURE)).toBe("STAFF_RESERVE");
  });

  it('returns RETURN_DUE if RENTED within cutoff', () => {
    expect(effectiveStatus("RENTED", 168, 168)).toBe("RETURN_DUE");
  });

  it('does not alter SETTLED', () => {
    expect(effectiveStatus("SETTLED", 168, 168)).toBe("SETTLED");
  });
});

describe('Urgency Badge', () => {
  it('identifies keeper items', () => {
    expect(urgencyBadge(null, 10)).toBe("KEEPER");
  });

  it('returns FRESH when >48h', () => {
    expect(urgencyBadge(168, 0)).toBe("FRESH");
  });

  it('returns DROPPING when >3h', () => {
    expect(urgencyBadge(168, 160)).toBe("DROPPING"); // 8h remaining
  });

  it('returns CRITICAL when <=3h', () => {
    expect(urgencyBadge(168, 166)).toBe("CRITICAL"); // 2h remaining
  });
});

describe('Impact Math', () => {
  it('calculates sale/transfer impact', () => {
    const res = impactSaleOrTransfer("Air cooler");
    expect(res.co2_avoided_kg).toBeCloseTo(64.2); // 62.0 + 2.2
    expect(res.waste_diverted_kg).toBe(14.5);
  });

  it('calculates rental impact at default 0.5 sub rate', () => {
    const res = impactRental("Study table+chair");
    expect(res.co2_avoided_kg).toBeCloseTo(26.0); // 52 * 0.5
  });
});

describe('Rental Calculations', () => {
  it('calculates DAY rental correctly', () => {
    expect(rentalCost(1800, "DAY")).toBe(36);
  });
  
  it('calculates WEEK rental correctly', () => {
    expect(rentalCost(1800, "WEEK")).toBe(180);
  });

  it('calculates rent-to-own with 50% credit', () => {
    // Current price is 1000, rent paid is 400. Credit is 200. Buy price should be 800
    const { buyPrice, credit } = rentToOwnPrice(1000, 500, 400);
    expect(buyPrice).toBe(800);
    expect(credit).toBe(200);
  });

  it('clamps rent-to-own to floor price', () => {
    // Current price is 600, rent paid is 400. Credit is 200. Buy price 400, but floor is 500
    const { buyPrice } = rentToOwnPrice(600, 500, 400);
    expect(buyPrice).toBe(500);
  });
});
