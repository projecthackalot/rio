import { expect, test, type Browser } from '@playwright/test'

/**
 * Signed-in journey: list → claim → QR handover (manual code) → settlement,
 * and the warden view. Opt-in because it writes data:
 *   E2E_FULL=1 RIO_DEMO_PASSWORD=... npx playwright test journey --project=desktop
 * Requires the migrations and `npm run seed:demo` on the project in .env.local.
 */
const full = process.env.E2E_FULL === '1'
const password = process.env.RIO_DEMO_PASSWORD ?? ''

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/(dashboard|warden|staff)/)
  return page
}

test.describe('signed-in journey', () => {
  test.skip(!full, 'set E2E_FULL=1 with a migrated, seeded Supabase project')

  test('seller lists, buyer claims, handover settles in sandbox money', async ({ browser }) => {
    const title = `E2E lamp ${Date.now()}`
    const seller = await signedIn(browser, 'priya.demo@rio.test')
    await seller.goto('/sell/new')
    await seller.getByLabel('Title').fill(title)
    await seller.getByLabel('Category').selectOption('other')
    await seller.getByLabel('Starting price (₹)').fill('300')
    await seller.getByLabel('Floor price (₹)').fill('100')
    await seller.getByLabel('No departure date: keep a fixed price').check()
    await seller.getByRole('button', { name: 'Publish listing' }).click()
    await expect(seller.getByText('Your listing is live on the marketplace.')).toBeVisible()
    const itemUrl = seller.url().replace(/\/edit.*$/, '')

    const buyer = await signedIn(browser, 'rohan.demo@rio.test')
    await buyer.goto(itemUrl)
    await buyer.getByRole('button', { name: /Claim for ₹300/ }).click()
    await buyer.getByRole('dialog').getByRole('button', { name: 'Claim and hold payment' }).click()
    await expect(buyer.getByText('Claimed. Payment is held in sandbox escrow.')).toBeVisible()

    await seller.goto('/activity#selling')
    await seller.getByRole('button', { name: 'Show handover code' }).first().click()
    const code = (await seller.locator('p[aria-label^="Code:"]').first().textContent())!.trim()

    await buyer.goto('/handover')
    await buyer.getByLabel('Handover code').fill(code)
    await buyer.getByRole('button', { name: 'Confirm handover' }).click()
    await expect(buyer.getByText(/Handover confirmed\. The sale is settled/)).toBeVisible()

    // Reuse must fail.
    await buyer.goto('/handover')
    await buyer.getByLabel('Handover code').fill(code)
    await buyer.getByRole('button', { name: 'Confirm handover' }).click()
    await expect(buyer.getByText('That handover code has already been used.')).toBeVisible()

    await expect(seller.getByText('Scanned and confirmed. This handover is complete.')).toBeVisible({ timeout: 15_000 })
  })

  test('warden sees the hostel overview', async ({ browser }) => {
    const warden = await signedIn(browser, 'warden.demo@rio.test')
    await expect(warden).toHaveURL(/\/warden/)
    await expect(warden.getByRole('heading', { name: 'Final hour: route to staff' })).toBeVisible()
    await expect(warden.getByRole('heading', { name: 'No-dues check' })).toBeVisible()
  })
})
