/**
 * Selenium: signed-in journeys against the real Supabase project. Runs only
 * when the backend answers and RIO_DEMO_PASSWORD is set (demo accounts from
 * `npm run seed:demo`); otherwise every test is reported as skipped.
 *
 * Two browser sessions act as seller and buyer, exactly like two phones.
 */
import { statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { afterAll, describe, expect, it } from 'vitest'
import { By, until, type WebDriver } from 'selenium-webdriver'
import { BASE, WAIT, backendAvailable, bodyText, browserErrors, byRole, fieldByLabel, h1Text, newDriver, open } from './helpers'

const password = process.env.RIO_DEMO_PASSWORD ?? ''
const enabled = Boolean(password) && (await backendAvailable())
const drivers: WebDriver[] = []
/** Listings created by these tests, withdrawn afterwards so the live marketplace stays clean. */
const created: { id: string; owner: string }[] = []

async function signIn(email: string): Promise<WebDriver> {
  const d = await newDriver()
  drivers.push(d)
  await open(d, '/auth/login')
  await (await fieldByLabel(d, 'Email')).sendKeys(email)
  await (await fieldByLabel(d, 'Password')).sendKeys(password)
  await (await byRole(d, 'button', 'Sign in')).click()
  await d.wait(until.urlMatches(/\/(dashboard|warden|staff)/), WAIT)
  return d
}

async function waitForText(d: WebDriver, pattern: RegExp) {
  await d.wait(async () => pattern.test(await bodyText(d)), WAIT, `text ${pattern} did not appear`)
}

async function createListing(seller: WebDriver, title: string, opts: { rentable?: boolean } = {}): Promise<string> {
  await open(seller, '/sell/new')
  await (await fieldByLabel(seller, 'Title')).sendKeys(title)
  await (await fieldByLabel(seller, 'Category')).sendKeys('Other hostel essentials')
  await (await fieldByLabel(seller, 'Starting price (₹)')).sendKeys('300')
  await (await fieldByLabel(seller, 'Floor price (₹)')).sendKeys('100')
  if (opts.rentable) {
    // Rentals need a departure far enough away; a keeper listing has none.
    await seller.findElement(By.css('input[name="rentable"]')).click()
  }
  await seller.findElement(By.css('input[name="noDeparture"]')).click()
  await (await byRole(seller, 'button', 'Publish listing')).click()
  await waitForText(seller, /Your listing is live on the marketplace\./)
  const path = (await seller.getCurrentUrl()).replace(/\/edit.*$/, '').replace(BASE, '')
  created.push({ id: path.split('/').pop()!, owner: 'priya.demo@rio.test' })
  return path
}

/** Seller's side: reveal the code for the transaction card that contains `title`. */
async function revealCode(d: WebDriver, path: string, buttonName: string, scopeText?: string): Promise<string> {
  await open(d, path)
  let scope = d.findElement(By.css('main'))
  if (scopeText) {
    scope = d.wait(async () => {
      for (const li of await d.findElements(By.css('li'))) if ((await li.getText()).includes(scopeText)) return li
      return null
    }, WAIT) as never
  }
  const root = await scope
  const btn = await d.wait(async () => {
    for (const b of await root.findElements(By.css('button'))) if ((await b.getText()).includes(buttonName)) return b
    return null
  }, WAIT)
  await (btn as import('selenium-webdriver').WebElement).click()
  const codeEl = await d.wait(until.elementLocated(By.css('p[aria-label^="Code:"]')), WAIT)
  return (await codeEl.getText()).trim()
}

async function enterCode(d: WebDriver, code: string) {
  await open(d, '/handover')
  const input = await fieldByLabel(d, 'Handover code')
  await input.clear()
  await input.sendKeys(code)
  await (await byRole(d, 'button', 'Confirm handover')).click()
}

afterAll(async () => {
  await Promise.all(drivers.map((d) => d.quit()))
  // Withdraw anything still listed, through the owner's own session (same RPC the app uses).
  if (!enabled || !created.length) return
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  await sb.auth.signInWithPassword({ email: 'priya.demo@rio.test', password })
  for (const { id } of created) await sb.rpc('set_listing_availability', { p_listing: id, p_available: false }) // no-op if sold/rented
})

describe.skipIf(!enabled)('signed-in journeys (live backend)', () => {
  it('purchase: list, save, claim, QR handover settles once, reuse rejected', async () => {
    const title = `Selenium lamp ${Date.now()}`
    const seller = await signIn('priya.demo@rio.test')
    const itemPath = await createListing(seller, title)

    const buyer = await signIn('rohan.demo@rio.test')
    await open(buyer, itemPath)
    expect(await h1Text(buyer)).toBe(title)

    // Save it, then confirm it shows on the Saved page.
    await (await byRole(buyer, 'button', `Save ${title}`)).click()
    await buyer.wait(until.elementLocated(By.css(`button[aria-label="Remove ${title} from saved items"]`)), WAIT)
    await open(buyer, '/saved')
    await waitForText(buyer, new RegExp(title))

    await open(buyer, itemPath)
    await (await byRole(buyer, 'button', /^Claim for ₹300$/)).click()
    await (await byRole(buyer, 'button', 'Claim and hold payment')).click()
    await waitForText(buyer, /Claimed\. Payment is held in sandbox escrow\./)

    const code = await revealCode(seller, '/activity#selling', 'Show handover code', title)
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)

    await enterCode(buyer, code)
    await waitForText(buyer, /Handover confirmed\. The sale is settled/)

    await enterCode(buyer, code)
    await waitForText(buyer, /That handover code has already been used\./)

    // The seller's view settles to Completed.
    await open(seller, '/activity#selling')
    await seller.wait(async () => {
      for (const li of await seller.findElements(By.css('li'))) {
        const t = await li.getText()
        if (t.includes(title) && t.includes('Completed')) return true
      }
      return false
    }, WAIT)
    expect(await browserErrors(buyer)).toEqual([])

    // The buyer can now rate the seller, once; the item page shows the seller's rating.
    await open(buyer, '/activity#buying')
    const card = (await buyer.wait(async () => {
      for (const li of await buyer.findElements(By.css('li')))
        if ((await li.getText()).includes(title) && (await li.getText()).includes('Rate the seller')) return li
      return null
    }, WAIT)) as import('selenium-webdriver').WebElement
    await card.findElement(By.css('label:has(input[value="4"])')).click()
    await card.findElement(By.css('input[name="comment"]')).sendKeys('Selenium: smooth handover')
    await (await card.findElement(By.xpath(".//button[normalize-space()='Submit rating']"))).click()
    // The form is replaced by a persistent confirmation once the rating is saved.
    await waitForText(buyer, /You rated this seller/)
    await open(buyer, itemPath)
    await waitForText(buyer, /Seller rated \d(\.\d)? out of 5 \(\d+ ratings?\)/)
  })

  it('photos: a phone-size JPEG is compressed in the browser, stored as full + thumbnail, and shown', async () => {
    // A realistic phone photo: 4032×3024, several megabytes.
    const photoPath = join(tmpdir(), `rio-selenium-photo-${Date.now()}.jpg`)
    await sharp({
      create: { width: 4032, height: 3024, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
    })
      .jpeg({ quality: 92 })
      .toFile(photoPath)
    const originalBytes = statSync(photoPath).size
    expect(originalBytes).toBeGreaterThan(4 * 1024 * 1024) // over the per-save limit before compression

    const title = `Selenium photo lamp ${Date.now()}`
    const seller = await signIn('priya.demo@rio.test')
    await open(seller, '/sell/new')
    await (await fieldByLabel(seller, 'Title')).sendKeys(title)
    await (await fieldByLabel(seller, 'Category')).sendKeys('Other hostel essentials')
    await (await fieldByLabel(seller, 'Starting price (₹)')).sendKeys('300')
    await (await fieldByLabel(seller, 'Floor price (₹)')).sendKeys('100')
    await seller.findElement(By.css('input[name="noDeparture"]')).click()
    await seller.findElement(By.css('#photos-picker')).sendKeys(photoPath)
    await waitForText(seller, /1 of \d photos? ready/)
    await (await byRole(seller, 'button', 'Publish listing')).click()
    await waitForText(seller, /Your listing is live on the marketplace\./)
    const itemPath = (await seller.getCurrentUrl()).replace(/\/edit.*$/, '').replace(BASE, '')
    created.push({ id: itemPath.split('/').pop()!, owner: 'priya.demo@rio.test' })

    // Item page: full image served from storage, compressed, as WebP (or JPEG where WebP encoding isn't available).
    await open(seller, itemPath)
    const hero = await seller.wait(until.elementLocated(By.css('main img[src*="/listing-media/"]')), WAIT)
    const fullUrl = (await hero.getAttribute('src')) ?? ''
    expect(fullUrl).not.toContain('-thumb.')
    const full = await fetch(fullUrl)
    expect(full.status).toBe(200)
    expect(full.headers.get('content-type')).toMatch(/image\/(webp|jpeg)/)
    const fullBytes = (await full.arrayBuffer()).byteLength
    expect(fullBytes).toBeLessThan(originalBytes / 4)

    // Marketplace card: the small thumbnail, not the full image.
    await open(seller, `/marketplace?q=${encodeURIComponent(title)}`)
    const card = await seller.wait(until.elementLocated(By.css('article img[src*="/listing-media/"]')), WAIT)
    const thumbUrl = (await card.getAttribute('src')) ?? ''
    expect(thumbUrl).toContain('-thumb.')
    const thumb = await fetch(thumbUrl)
    expect(thumb.status).toBe(200)
    expect((await thumb.arrayBuffer()).byteLength).toBeLessThan(fullBytes)
  })

  it('rental: book, pickup by code, return by code refunds the deposit', async () => {
    const title = `Selenium chair ${Date.now()}`
    const owner = await signIn('priya.demo@rio.test')
    const itemPath = await createListing(owner, title, { rentable: true })

    const renter = await signIn('zoya.demo@rio.test')
    await open(renter, itemPath)
    await (await byRole(renter, 'button', 'Rent instead')).click() // Day is preselected
    await renter.wait(until.urlMatches(/\/rentals\/[0-9a-f-]{36}\?notice=booked/), WAIT)
    const rentalPath = (await renter.getCurrentUrl()).replace(BASE, '').split('?')[0]
    await waitForText(renter, /Rental booked\./)

    const pickup = await revealCode(owner, rentalPath, 'Show pickup code')
    await enterCode(renter, pickup)
    await waitForText(renter, /Pickup confirmed\./)

    const ret = await revealCode(renter, rentalPath, 'Show return code')
    await enterCode(owner, ret)
    await waitForText(owner, /Return confirmed\. The renter’s deposit has been refunded/)

    await open(renter, rentalPath)
    await waitForText(renter, /Returned/)
  })

  it('report: a student reports a listing anonymously and a warden dismisses it', async () => {
    const title = `Selenium reported lamp ${Date.now()}`
    const seller = await signIn('priya.demo@rio.test')
    const itemPath = await createListing(seller, title)

    const reporter = await signIn('rohan.demo@rio.test')
    await open(reporter, itemPath)
    await (await byRole(reporter, 'button', 'Report listing')).click()
    const dialog = await reporter.wait(until.elementLocated(By.css('dialog[open]')), WAIT)
    await dialog.findElement(By.css('select[name="reason"]')).sendKeys('Looks like a scam')
    await dialog.findElement(By.css('textarea[name="details"]')).sendKeys('Selenium test report')
    await (await dialog.findElement(By.xpath(".//button[normalize-space()='Send report']"))).click()
    await waitForText(reporter, /A warden for this hostel will review the listing/)

    const warden = await signIn('warden.demo@rio.test')
    await warden.wait(until.urlContains('/warden'), WAIT)
    const row = (await warden.wait(async () => {
      for (const li of await warden.findElements(By.css('section[aria-labelledby="reports-heading"] li'))) if ((await li.getText()).includes(title)) return li
      await warden.navigate().refresh()
      return null
    }, WAIT)) as import('selenium-webdriver').WebElement
    expect(await row.getText()).toMatch(/Possible scam/)
    await (await row.findElement(By.xpath(".//button[normalize-space()='Dismiss']"))).click()
    // A dismissed report leaves the open queue.
    await warden.wait(async () => !(await bodyText(warden)).includes(title), WAIT, 'report stayed in the queue')
  })

  it('warden sees the hostel overview with real queues', async () => {
    const warden = await signIn('warden.demo@rio.test')
    // Wardens are redirected from the student dashboard to their own overview.
    await warden.wait(until.urlContains('/warden'), WAIT)
    await waitForText(warden, /No-dues check/)
    const text = await bodyText(warden)
    expect(text).toMatch(/Final hour: route to staff/)
    expect(text).toMatch(/No-dues check/)
    expect(await browserErrors(warden)).toEqual([])
  })

  it('a student cannot open warden or admin screens', async () => {
    const student = await signIn('rohan.demo@rio.test')
    for (const path of ['/warden', '/admin/roles']) {
      await open(student, path)
      await waitForText(student, /You don’t have access to this page/)
    }
  })
})

describe.skipIf(enabled)('signed-in journeys (backend not reachable)', () => {
  it.skip('restore the Supabase project and set RIO_DEMO_PASSWORD to run these (npm run doctor explains what is missing)', () => {})
})
