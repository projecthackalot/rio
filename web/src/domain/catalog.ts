/**
 * Category and condition catalogue. Coefficients are carried over unchanged
 * from the Streamlit prototype (`rio/engine.py`). They are ESTIMATES derived
 * from published embodied-carbon ranges — not measured values — and the UI
 * always labels derived impact figures as estimates.
 *
 * The same rows are seeded into `public.categories` by migration; the slugs
 * here must match.
 */

import type { Paise } from './money'

export interface Category {
  slug: string
  name: string
  tareKg: number
  volumeM3: number
  embodiedCo2eKg: number
  defaultStartPaise: Paise
  defaultFloorPaise: Paise
}

export const CATEGORIES: readonly Category[] = [
  { slug: 'air-cooler', name: 'Air cooler', tareKg: 14.5, volumeM3: 0.28, embodiedCo2eKg: 62.0, defaultStartPaise: 180_000, defaultFloorPaise: 50_000 },
  { slug: 'foam-mattress', name: 'Foam mattress', tareKg: 11.2, volumeM3: 0.35, embodiedCo2eKg: 44.0, defaultStartPaise: 120_000, defaultFloorPaise: 30_000 },
  {
    slug: 'kettle-immersion',
    name: 'Kettle / immersion rod',
    tareKg: 1.2,
    volumeM3: 0.01,
    embodiedCo2eKg: 15.5,
    defaultStartPaise: 50_000,
    defaultFloorPaise: 15_000,
  },
  { slug: 'drafter-board', name: 'Drafter + board', tareKg: 1.8, volumeM3: 0.04, embodiedCo2eKg: 8.2, defaultStartPaise: 45_000, defaultFloorPaise: 15_000 },
  {
    slug: 'study-table-chair',
    name: 'Study table + chair',
    tareKg: 18.0,
    volumeM3: 0.42,
    embodiedCo2eKg: 52.0,
    defaultStartPaise: 150_000,
    defaultFloorPaise: 40_000,
  },
  // No coefficients exist for miscellaneous items, so no impact is estimated for them.
  { slug: 'other', name: 'Other hostel essentials', tareKg: 0, volumeM3: 0, embodiedCo2eKg: 0, defaultStartPaise: 50_000, defaultFloorPaise: 10_000 },
] as const

export const CATEGORY_BY_SLUG: ReadonlyMap<string, Category> = new Map(CATEGORIES.map((c) => [c.slug, c]))

export const CONDITIONS = {
  like_new: { label: 'Like new', description: 'Barely used, no visible wear.' },
  good: { label: 'Good', description: 'Normal signs of use, fully working.' },
  fair: { label: 'Fair', description: 'Visible wear or minor faults, described in the listing.' },
  worn: { label: 'Well used', description: 'Heavy wear but usable. Priced accordingly.' },
} as const

export type Condition = keyof typeof CONDITIONS
export const CONDITION_KEYS = Object.keys(CONDITIONS) as Condition[]
