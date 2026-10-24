/**
 * Adds real, freely licensed photos to the demo listings created by
 * `npm run seed:demo`. DEVELOPMENT / DEMO projects only.
 *
 *   RIO_DEMO_SEED=true npm run seed:photos
 *
 * Photos come from Wikimedia Commons (CC0 / public domain / CC BY / CC BY-SA).
 * The licence and author are read from the Commons API at run time and shown
 * on the listing itself ("Demo photo: … by …, licence, via Wikimedia Commons")
 * and in scripts/demo-photos/CREDITS.md. Each photo is converted exactly like
 * an in-app upload: a ~1600 px WebP plus a ~480 px WebP thumbnail.
 *
 * Idempotent: listings that already have photos are skipped.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { loadLocalEnv } from './lib/env'

loadLocalEnv()

function fail(msg: string): never {
  console.error(`seed-photos: ${msg}`)
  process.exit(1)
}

if (process.env.RIO_DEMO_SEED !== 'true') fail('refusing to run: set RIO_DEMO_SEED=true for a development/demo project.')
if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') fail('refusing to run in production.')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const UA = 'RIO-demo-seed/1.0 (student marketplace project; https://github.com/projecthackalot/rio)'

/** Demo listing title → Commons file(s), chosen to match what the listing describes. */
const PHOTOS: Record<string, string[]> = {
  'Symphony air cooler, 40 L': ['File:Air cooler.jpg'],
  'Single foam mattress, 4 inch': ['File:Pillowtop-mattress.jpg'],
  'Electric kettle, 1.5 L': ['File:Electric kettle - Электрический чайник.JPG'],
  'Study table with chair': ['File:Desk (210244970).jpg', 'File:Rolling desk chair.jpg'],
  'Drafter with A2 board': ['File:1960s drafting table hydraulic stand by Domkraft AB NIKE Eskilstuna Sweden.jpg'],
  'Bucket and mug set': ['File:Purple plastic bucket.jpg'],
  'Table fan cum air cooler, compact': ['File:Mini air cooler and red cup.jpg'],
}

interface CommonsPhoto {
  title: string
  imageUrl: string
  pageUrl: string
  license: string
  licenseUrl: string | null
  artist: string
}

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

async function lookup(title: string): Promise<CommonsPhoto> {
  const api = new URL('https://commons.wikimedia.org/w/api.php')
  api.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1600',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist',
  }).toString()
  const res = await fetch(api, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Commons API ${res.status} for ${title}`)
  const page = Object.values((await res.json()).query.pages as Record<string, { imageinfo?: Record<string, unknown>[] }>)[0]
  const info = page?.imageinfo?.[0] as
    { thumburl?: string; url: string; descriptionurl: string; extmetadata: Record<string, { value: string } | undefined> } | undefined
  if (!info) throw new Error(`${title} not found on Commons`)
  const meta = info.extmetadata
  const license = meta.LicenseShortName?.value
  if (!license) throw new Error(`${title} has no licence metadata — not using it`)
  return {
    title: title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
    imageUrl: info.thumburl ?? info.url,
    pageUrl: info.descriptionurl,
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
    artist: stripHtml(meta.Artist?.value ?? '') || 'Unknown author',
  }
}

async function toWebp(input: Buffer, side: number, quality: number): Promise<Buffer> {
  return sharp(input).rotate().resize(side, side, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer()
}

async function main() {
  console.log('seed-photos: freely licensed demo photos from Wikimedia Commons.')
  const { data: listings, error } = await db.from('listings').select('id, title, owner_id, description, listing_media(id)').in('title', Object.keys(PHOTOS))
  if (error) fail(`listings: ${error.message}`)
  if (!listings?.length) fail('no demo listings found — run npm run seed:demo first.')

  const credits: string[] = []
  for (const listing of listings) {
    if ((listing.listing_media as unknown[]).length) {
      console.log(`  skip  ${listing.title} (already has photos)`)
      continue
    }
    const attributions: string[] = []
    let position = 0
    for (const file of PHOTOS[listing.title]) {
      const photo = await lookup(file)
      const res = await fetch(photo.imageUrl, { headers: { 'User-Agent': UA } })
      if (!res.ok) fail(`download ${photo.title}: HTTP ${res.status}`)
      const original = Buffer.from(await res.arrayBuffer())
      const [full, thumb] = await Promise.all([toWebp(original, 1600, 80), toWebp(original, 480, 72)])

      const id = randomUUID()
      const path = `${listing.owner_id}/${listing.id}/${id}.webp`
      const thumbPath = `${listing.owner_id}/${listing.id}/${id}-thumb.webp`
      const bucket = db.storage.from('listing-media')
      for (const [p, body] of [
        [path, full],
        [thumbPath, thumb],
      ] as const) {
        const { error: upErr } = await bucket.upload(p, body, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
        if (upErr) fail(`upload ${p}: ${upErr.message}`)
      }
      const { error: rowErr } = await db.from('listing_media').insert({
        listing_id: listing.id,
        storage_path: path,
        thumb_path: thumbPath,
        alt_text: `${listing.title} (demo photo: ${photo.title})`.slice(0, 200),
        position: position++,
      })
      if (rowErr) fail(`attach ${photo.title}: ${rowErr.message}`)

      const credit = `“${photo.title}” by ${photo.artist}, ${photo.license}, via Wikimedia Commons`
      attributions.push(credit)
      credits.push(
        `- **${listing.title}**: [${photo.title}](${photo.pageUrl}) by ${photo.artist}, ${photo.licenseUrl ? `[${photo.license}](${photo.licenseUrl})` : photo.license}`,
      )
      console.log(`  added ${listing.title} ← ${photo.title} (${photo.license}; ${Math.round(full.length / 1024)} KB + ${Math.round(thumb.length / 1024)} KB)`)
    }
    // Attribution must be visible where the photo is shown.
    const note = `\n\nDemo photo${attributions.length > 1 ? 's' : ''}: ${attributions.join('; ')}.`
    await db
      .from('listings')
      .update({ description: `${listing.description ?? ''}${note}`.slice(0, 2000) })
      .eq('id', listing.id)
  }

  if (credits.length) {
    mkdirSync('scripts/demo-photos', { recursive: true })
    writeFileSync(
      'scripts/demo-photos/CREDITS.md',
      `# Demo photo credits\n\nDemo listings use these freely licensed photos from Wikimedia Commons, resized and converted to WebP. ` +
        `They illustrate the item category; they are not photos of real listings.\n\n${credits.join('\n')}\n`,
    )
    console.log('seed-photos: wrote scripts/demo-photos/CREDITS.md')
  }
  console.log('seed-photos: done.')
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)))
