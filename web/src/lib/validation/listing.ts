import { z } from 'zod'
import { CATEGORIES, CONDITION_KEYS, type Condition } from '@/domain/catalog'
import { fromISTLocalInput } from '@/lib/format'

export const MAX_PHOTOS = 5
/**
 * Per-save upload budget. Serverless hosts cap a request body at about 4.5 MB
 * (Vercel), and photos travel through a Server Action, so one save may carry
 * at most 4 MB of files in total.
 */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024
export const MAX_UPLOAD_LABEL = '4 MB'
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

const rupees = (label: string) =>
  z.coerce
    .number({ message: `Enter the ${label} in rupees.` })
    .int(`Use whole rupees for the ${label}.`)
    .min(1, `The ${label} must be at least ₹1.`)
    .max(100_000, `The ${label} can be at most ₹1,00,000.`)

/** Server-side listing validation (the database re-checks prices and dates). */
export const listingSchema = z
  .object({
    title: z.string().trim().min(3, 'Give it a title of at least 3 characters.').max(80, 'Keep the title under 80 characters.'),
    description: z.string().trim().max(2000, 'Keep the description under 2,000 characters.').optional().default(''),
    category: z.enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]], { message: 'Choose a category.' }),
    condition: z.enum(CONDITION_KEYS as [Condition, ...Condition[]], { message: 'Choose the condition.' }),
    startRupees: rupees('starting price'),
    floorRupees: rupees('floor price'),
    noDeparture: z.preprocess((v) => v === 'on', z.boolean()),
    departure: z.string().optional(),
    rentable: z.preprocess((v) => v === 'on', z.boolean()),
    photoAlt: z.string().trim().max(200).optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (v.floorRupees >= v.startRupees) ctx.addIssue({ code: 'custom', path: ['floorRupees'], message: 'The floor must be lower than the starting price.' })
    if (!v.noDeparture) {
      const d = v.departure ? fromISTLocalInput(v.departure) : null
      if (!d) ctx.addIssue({ code: 'custom', path: ['departure'], message: 'Enter when you leave campus, or tick “No departure date”.' })
      else if (d.getTime() < Date.now() + 3 * 3_600_000)
        ctx.addIssue({ code: 'custom', path: ['departure'], message: 'Departure must be at least 3 hours from now.' })
      else if (d.getTime() > Date.now() + 366 * 86_400_000)
        ctx.addIssue({ code: 'custom', path: ['departure'], message: 'Departure must be within the next year.' })
    }
  })
  .transform((v) => ({
    title: v.title,
    description: v.description || null,
    category_slug: v.category,
    condition: v.condition,
    start_price_paise: v.startRupees * 100,
    floor_price_paise: v.floorRupees * 100,
    departure_at: v.noDeparture ? null : fromISTLocalInput(v.departure!)!.toISOString(),
    is_rentable: v.rentable,
    photoAlt: v.photoAlt,
  }))

export type ListingInput = z.infer<typeof listingSchema>

const SIGNATURES: Record<(typeof PHOTO_TYPES)[number], (b: Uint8Array) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
  'image/avif': (b) => String.fromCharCode(...b.slice(4, 12)).startsWith('ftypavi'),
}

export const EXTENSIONS: Record<(typeof PHOTO_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/** Checks declared type, size and the file's magic bytes (a renamed .exe is rejected). */
export async function validatePhoto(file: File): Promise<string | null> {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return `“${file.name}” isn’t a JPEG, PNG, WebP or AVIF image.`
  if (file.size > MAX_PHOTO_BYTES) return `“${file.name}” is larger than ${MAX_UPLOAD_LABEL}.`
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (!SIGNATURES[file.type as (typeof PHOTO_TYPES)[number]](head)) return `“${file.name}” doesn’t look like a valid ${file.type} file.`
  return null
}
