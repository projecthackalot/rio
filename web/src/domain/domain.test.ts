import { describe, expect, it } from 'vitest'
import fixtures from './pricing.fixtures.json'
import { applyBps, formatINR, formatSignedINR, roundHalfUpDiv, rupeesToPaise } from './money'
import { HOUR_MS, auctionPhase, currentPricePaise, decayProgress, isStaffRoutable, isWithinTradingWindow, urgency } from './pricing'
import { canRentBeforeDeparture, quoteRental, quoteRentToOwn, rentalCostPaise, rentalDepositPaise, settleDeposit } from './rental'
import { estimateRentalImpact, estimateTransferImpact, sumImpact } from './impact'
import {
  CLAIM_TRANSITIONS,
  DISPUTE_TRANSITIONS,
  IllegalTransitionError,
  LISTING_TRANSITIONS,
  RENTAL_TRANSITIONS,
  STAFF_TRANSFER_TRANSITIONS,
  assertTransition,
  canTransition,
  isTerminal,
} from './stateMachine'
import { formatHandoverCode, normalizeHandoverCode } from './handoverCode'

describe('money', () => {
  it('rounds half-up on exact ties, unlike banker’s rounding', () => {
    expect(roundHalfUpDiv(5, 2)).toBe(3) // 2.5 → 3
    expect(roundHalfUpDiv(7, 2)).toBe(4) // 3.5 → 4
    expect(roundHalfUpDiv(4, 3)).toBe(1) // 1.33 → 1
  })

  it('applies basis points to the nearest rupee', () => {
    expect(applyBps(180_000, 200)).toBe(3_600) // 2% of ₹1800 = ₹36
    expect(applyBps(12_345, 200)).toBe(200) // ₹2.469 → ₹2
    expect(applyBps(12_500, 200)).toBe(300) // ₹2.50 exactly → ₹3 (half-up)
  })

  it('rejects non-integer paise and negative numerators', () => {
    expect(() => applyBps(1.5, 100)).toThrow(RangeError)
    expect(() => roundHalfUpDiv(-1, 2)).toThrow(RangeError)
  })

  it('converts and formats rupees', () => {
    expect(rupeesToPaise(1800)).toBe(180_000)
    expect(formatINR(180_000)).toBe('₹1,800')
    expect(formatINR(12_345_600)).toBe('₹1,23,456')
    expect(formatSignedINR(-3_600)).toBe('−₹36')
    expect(formatSignedINR(3_600)).toBe('+₹36')
  })
})

describe('Dutch auction pricing (shared SQL fixtures)', () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      const price = currentPricePaise(
        {
          startPaise: c.startPaise,
          floorPaise: c.floorPaise,
          listedAt: new Date(c.listedAt),
          departureAt: c.departureAt ? new Date(c.departureAt) : null,
        },
        new Date(c.now),
      )
      expect(price).toBe(c.expected)
    })
  }

  it('is monotonically non-increasing and always within [floor, start]', () => {
    const input = { startPaise: 152_300, floorPaise: 41_700, listedAt: 0, departureAt: 97 * HOUR_MS }
    let previous = Infinity
    for (let t = -HOUR_MS; t <= 100 * HOUR_MS; t += 17 * 60_000) {
      const p = currentPricePaise(input, t)
      expect(p).toBeLessThanOrEqual(previous)
      expect(p).toBeGreaterThanOrEqual(input.floorPaise)
      expect(p).toBeLessThanOrEqual(input.startPaise)
      previous = p
    }
  })

  it('reports decay progress', () => {
    const input = { startPaise: 100_000, floorPaise: 50_000, listedAt: 0, departureAt: 12 * HOUR_MS }
    expect(decayProgress(input, 0)).toBe(0)
    expect(decayProgress(input, 5 * HOUR_MS)).toBe(0.5)
    expect(decayProgress(input, 11 * HOUR_MS)).toBe(1)
  })
})

describe('auction lifecycle boundaries', () => {
  const dep = 100 * HOUR_MS
  it.each([
    [dep - 3 * HOUR_MS, 'decaying'],
    [dep - 2 * HOUR_MS, 'floor'],
    [dep - HOUR_MS - 1, 'floor'],
    [dep - HOUR_MS, 'final_hour'],
    [dep - 1, 'final_hour'],
    [dep, 'departed'],
  ] as const)('at t=%i the phase is %s', (t, phase) => {
    expect(auctionPhase({ departureAt: dep }, t)).toBe(phase)
  })

  it('stops trading and allows staff routing at exactly one hour before departure', () => {
    expect(isWithinTradingWindow(dep, dep - HOUR_MS - 1)).toBe(true)
    expect(isWithinTradingWindow(dep, dep - HOUR_MS)).toBe(false)
    expect(isStaffRoutable(dep, dep - HOUR_MS - 1)).toBe(false)
    expect(isStaffRoutable(dep, dep - HOUR_MS)).toBe(true)
    expect(isStaffRoutable(dep, dep + HOUR_MS)).toBe(true)
  })

  it('keeper listings trade indefinitely and are never staff-routed', () => {
    expect(auctionPhase({ departureAt: null }, 0)).toBe('keeper')
    expect(isWithinTradingWindow(null, 1e13)).toBe(true)
    expect(isStaffRoutable(null, 1e13)).toBe(false)
  })

  it('urgency thresholds', () => {
    expect(urgency(null, 0)).toBe('KEEPER')
    expect(urgency(49 * HOUR_MS, 0)).toBe('FRESH')
    expect(urgency(48 * HOUR_MS, 0)).toBe('DROPPING')
    expect(urgency(3 * HOUR_MS, 0)).toBe('CRITICAL')
    expect(urgency(HOUR_MS, 0)).toBe('FINAL_HOUR')
    expect(urgency(0, 0)).toBe('DEPARTED')
  })
})

describe('rentals', () => {
  it('charges 2% / 10% / 25% of start price and a 20% deposit', () => {
    expect(rentalCostPaise(180_000, 'DAY')).toBe(3_600)
    expect(rentalCostPaise(180_000, 'WEEK')).toBe(18_000)
    expect(rentalCostPaise(180_000, 'MONTH')).toBe(45_000)
    expect(rentalDepositPaise(180_000)).toBe(36_000)
    expect(quoteRental(180_000, 'WEEK')).toEqual({ period: 'WEEK', rentPaise: 18_000, depositPaise: 36_000, totalDuePaise: 54_000 })
  })

  it('rounds rent and deposit half-up to whole rupees', () => {
    // ₹45.25 start → day rent ₹0.905 → ₹1; deposit ₹9.05 → ₹9
    expect(rentalCostPaise(4_525, 'DAY')).toBe(100)
    expect(rentalDepositPaise(4_525)).toBe(900)
    // ₹12.50 start → deposit exactly ₹2.50 → ₹3
    expect(rentalDepositPaise(1_250)).toBe(300)
  })

  it('requires duration + 24h before the owner departs', () => {
    const now = 0
    expect(canRentBeforeDeparture(null, now, 'MONTH')).toEqual({ ok: true })
    expect(canRentBeforeDeparture(48 * HOUR_MS, now, 'DAY')).toEqual({ ok: true })
    const tooSoon = canRentBeforeDeparture(48 * HOUR_MS - 1, now, 'DAY')
    expect(tooSoon.ok).toBe(false)
    if (!tooSoon.ok) {
      expect(tooSoon.neededHours).toBe(48)
      expect(tooSoon.remainingHours).toBe(47)
    }
    expect(canRentBeforeDeparture(191 * HOUR_MS, now, 'WEEK').ok).toBe(false)
    expect(canRentBeforeDeparture(192 * HOUR_MS, now, 'WEEK').ok).toBe(true)
  })

  it('refunds the full deposit on a clean return and deducts 25% on damage', () => {
    expect(settleDeposit(36_000, false)).toEqual({ depositPaise: 36_000, deductionPaise: 0, refundPaise: 36_000 })
    expect(settleDeposit(36_000, true)).toEqual({ depositPaise: 36_000, deductionPaise: 9_000, refundPaise: 27_000 })
    // ₹9.50 deposit → 25% = ₹2.375 → ₹2 deduction
    expect(settleDeposit(950, true)).toEqual({ depositPaise: 950, deductionPaise: 200, refundPaise: 750 })
  })
})

describe('rent-to-own', () => {
  it('credits 50% of rent paid against the current price', () => {
    const q = quoteRentToOwn(100_000, 50_000, 40_000)
    expect(q.earnedCreditPaise).toBe(20_000)
    expect(q.appliedCreditPaise).toBe(20_000)
    expect(q.buyPricePaise).toBe(80_000)
    expect(q.floorApplied).toBe(false)
  })

  it('never goes below the floor; unused credit is not paid out', () => {
    const q = quoteRentToOwn(60_000, 50_000, 40_000)
    expect(q.buyPricePaise).toBe(50_000)
    expect(q.earnedCreditPaise).toBe(20_000)
    expect(q.appliedCreditPaise).toBe(10_000)
    expect(q.floorApplied).toBe(true)
  })

  it('rounds an odd-paisa credit half-up', () => {
    expect(quoteRentToOwn(100_000, 10_000, 3_601).earnedCreditPaise).toBe(1_801)
  })
})

describe('impact estimates', () => {
  it('uses the prototype coefficients', () => {
    expect(estimateTransferImpact('air-cooler').co2eAvoidedKg).toBeCloseTo(64.2)
    expect(estimateTransferImpact('air-cooler').wasteDivertedKg).toBe(14.5)
    expect(estimateRentalImpact('study-table-chair').co2eAvoidedKg).toBeCloseTo(26)
    expect(estimateTransferImpact('unknown').co2eAvoidedKg).toBe(0)
    expect(sumImpact([estimateTransferImpact('air-cooler'), estimateRentalImpact('air-cooler')]).co2eAvoidedKg).toBeCloseTo(95.2)
  })
})

describe('state machines', () => {
  it('allows the happy paths', () => {
    expect(canTransition(LISTING_TRANSITIONS, 'ACTIVE', 'RESERVED')).toBe(true)
    expect(canTransition(LISTING_TRANSITIONS, 'RESERVED', 'SOLD')).toBe(true)
    expect(canTransition(CLAIM_TRANSITIONS, 'PENDING_HANDOVER', 'COMPLETED')).toBe(true)
    expect(canTransition(RENTAL_TRANSITIONS, 'ACTIVE', 'CONVERTED')).toBe(true)
    expect(canTransition(STAFF_TRANSFER_TRANSITIONS, 'PENDING', 'ACCEPTED')).toBe(true)
  })

  it.each([
    ['listing', LISTING_TRANSITIONS, 'SOLD', 'ACTIVE'],
    ['listing', LISTING_TRANSITIONS, 'STAFF_PENDING', 'ACTIVE'],
    ['listing', LISTING_TRANSITIONS, 'STAFF_CUSTODY', 'STAFF_CUSTODY'],
    ['claim', CLAIM_TRANSITIONS, 'COMPLETED', 'REFUNDED'],
    ['claim', CLAIM_TRANSITIONS, 'CANCELLED', 'PENDING_HANDOVER'],
    ['rental', RENTAL_TRANSITIONS, 'RETURNED', 'ACTIVE'],
    ['rental', RENTAL_TRANSITIONS, 'PENDING_PICKUP', 'CONVERTED'],
    ['dispute', DISPUTE_TRANSITIONS, 'RESOLVED_REFUND', 'RESOLVED_DAMAGE'],
    ['staff transfer', STAFF_TRANSFER_TRANSITIONS, 'ACCEPTED', 'ACCEPTED'],
  ] as const)('rejects illegal %s transition %s → %s', (entity, graph, from, to) => {
    // @ts-expect-error — heterogeneous graph table in a parameterised test
    expect(() => assertTransition(entity, graph, from, to)).toThrow(IllegalTransitionError)
  })

  it('marks settled states as terminal', () => {
    expect(isTerminal(LISTING_TRANSITIONS, 'SOLD')).toBe(true)
    expect(isTerminal(CLAIM_TRANSITIONS, 'REFUNDED')).toBe(true)
    expect(isTerminal(RENTAL_TRANSITIONS, 'ACTIVE')).toBe(false)
  })
})

describe('handover codes', () => {
  it('normalises manual entry the Crockford way', () => {
    expect(normalizeHandoverCode('abcd-efgh-jkmn-pqrs')).toBe('ABCDEFGHJKMNPQRS')
    expect(normalizeHandoverCode(' rio:0o1i-L234 5678 9ABC ')).toBe('0011123456789ABC')
  })

  it('rejects wrong length or alphabet', () => {
    expect(normalizeHandoverCode('ABC')).toBeNull()
    expect(normalizeHandoverCode('ABCDEFGHJKMNPQRU')).toBeNull() // U is not Crockford
    expect(normalizeHandoverCode('https://evil.example/?ABCDEFGHJKMNPQRS')).toBeNull()
  })

  it('formats in groups of four', () => {
    expect(formatHandoverCode('ABCDEFGHJKMNPQRS')).toBe('ABCD-EFGH-JKMN-PQRS')
  })
})

describe('safeNext (open-redirect guard)', async () => {
  const { safeNext } = await import('@/lib/auth/redirect')
  it.each([
    ['/marketplace?page=2', '/marketplace?page=2'],
    ['/items/abc#gallery', '/items/abc#gallery'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['/\\/evil.example', '/dashboard'],
    ['https://evil.example/', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['/auth/login', '/dashboard'],
    ['', '/dashboard'],
    [undefined, '/dashboard'],
    ['/%2F%2Fevil.example', '/%2F%2Fevil.example'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})

describe('auth validation', async () => {
  const { signupSchema, loginSchema } = await import('@/lib/validation/auth')
  it('signup ignores any role field and normalises email', () => {
    const r = signupSchema.parse({ fullName: ' Priya ', email: ' Priya@Example.COM ', password: 'abcd1234', confirmPassword: 'abcd1234', role: 'warden' })
    expect(r).toEqual({ fullName: 'Priya', email: 'priya@example.com', password: 'abcd1234', confirmPassword: 'abcd1234' })
    expect('role' in r).toBe(false)
  })
  it('rejects weak or mismatched passwords and bad email', () => {
    const r = signupSchema.safeParse({ fullName: 'P', email: 'nope', password: 'short', confirmPassword: 'other' })
    expect(r.success).toBe(false)
    if (!r.success) expect(Object.keys(r.error.flatten().fieldErrors).sort()).toEqual(['confirmPassword', 'email', 'fullName', 'password'])
    expect(signupSchema.safeParse({ fullName: 'Pri', email: 'a@b.co', password: 'abcd1234', confirmPassword: 'abcd1235' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })
})

describe('marketplace filters', async () => {
  const { parseFilters } = await import('@/lib/data/listings')
  it('drops invalid values instead of trusting them', () => {
    const f = parseFilters({ category: 'not-a-category', condition: 'mint', sort: 'random', page: '-3', min: 'abc', q: '  cooler  ' })
    expect(f).toMatchObject({ sort: 'ending', page: 1, q: 'cooler' })
    expect([f.category, f.condition, f.min]).toEqual([undefined, undefined, undefined])
  })
  it('swaps a reversed price range and flags it', () => {
    expect(parseFilters({ min: '900', max: '200' })).toMatchObject({ min: 200, max: 900, rangeSwapped: true })
    expect(parseFilters({ min: '200', max: '900' })).toMatchObject({ min: 200, max: 900, rangeSwapped: false })
    const onlyMin = parseFilters({ min: '500' })
    expect(onlyMin).toMatchObject({ min: 500, rangeSwapped: false })
    expect(onlyMin.max).toBeUndefined()
  })
})
