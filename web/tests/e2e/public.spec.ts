import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`)
  expect(summary, summary.join('\n')).toEqual([])
}

test.describe('public pages', () => {
  test('landing explains the product and is accessible', async ({ page }, info) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Leaving campus?')
    await expect(page.getByRole('img', { name: 'Example price over two days' })).toBeVisible()
    await expect(page.getByText('Simulated payment: no real money is transferred during the pilot.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse all items' })).toHaveAttribute('href', '/marketplace')
    await expect(page.getByRole('heading', { name: 'Browse by category' })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.screenshot({ path: `test-results/screens/landing-${info.project.name}.png`, fullPage: true })
  })

  test('skip link moves focus to the main content', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is checked on desktop')
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main$/)
  })

  test('unknown routes show the 404 page', async ({ page }) => {
    const res = await page.goto('/this-does-not-exist')
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'This page isn’t here' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('security headers are set', async ({ request }) => {
    const res = await request.get('/')
    expect(res.headers()['x-frame-options']).toBe('DENY')
    expect(res.headers()['x-content-type-options']).toBe('nosniff')
    expect(res.headers()['x-powered-by']).toBeUndefined()
  })
})

test.describe('auth screens', () => {
  test('sign-in page is accessible and offers Google, email and magic link', async ({ page }, info) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Email me a sign-in link instead' })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.screenshot({ path: `test-results/screens/login-${info.project.name}.png`, fullPage: true })
  })

  test('signup validates on the server and has no role selector', async ({ page }) => {
    await page.goto('/auth/signup')
    await expect(page.getByLabel(/role/i)).toHaveCount(0)
    await page.getByLabel('Full name').fill('A')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByLabel('Confirm password').fill('different')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Passwords don’t match.')).toBeVisible()
    // Typed values survive the failed submit (except passwords).
    await expect(page.getByLabel('Email')).toHaveValue('not-an-email')
    await expectNoAxeViolations(page)
  })

  test('forgot-password and magic-link pages render accessibly', async ({ page }) => {
    for (const path of ['/auth/forgot-password', '/auth/magic-link', '/auth/check-email?type=recovery', '/auth/error?reason=link']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoAxeViolations(page)
    }
  })
})

test.describe('access control', () => {
  for (const path of ['/dashboard', '/activity', '/sell/new', '/saved', '/handover', '/warden', '/admin/roles', '/settings']) {
    test(`${path} redirects signed-out visitors to sign in and back`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`/auth/login\\?next=${encodeURIComponent(path).replace(/%2F/g, '(%2F|/)')}`))
    })
  }

  test('open redirects are refused', async ({ page }) => {
    await page.goto('/auth/login?next=//evil.example')
    const hidden = page.locator('input[name="next"]').first()
    await expect(hidden).toHaveValue('/dashboard')
  })
})

const CONTENT_PAGES: [string, string][] = [
  ['/how-it-works', 'How RIO works'],
  ['/about', 'About RIO'],
  ['/campus-impact', 'Campus impact'],
  ['/trust-and-safety', 'Trust and safety'],
  ['/help', 'Help and FAQ'],
  ['/contact', 'Contact'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms and listing policy'],
  ['/accessibility', 'Accessibility'],
]

test.describe('public browsing (no account)', () => {
  test('the marketplace opens for anonymous visitors instead of redirecting to sign-in', async ({ page }) => {
    await page.goto('/marketplace')
    await expect(page).toHaveURL(/\/marketplace$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Marketplace' })).toBeVisible()
  })

  test('home search lands on the marketplace with the query in the URL', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('searchbox', { name: 'Search items' }).fill('cooler')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(/\/marketplace\?q=cooler$/)
  })

  for (const [path, heading] of CONTENT_PAGES) {
    test(`${path} renders and passes axe`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expectNoAxeViolations(page)
    })
  }

  test('every footer link resolves to a real page', async ({ page, request }) => {
    await page.goto('/')
    const hrefs = await page.locator('footer a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))
    expect(hrefs.length).toBeGreaterThan(8)
    for (const href of new Set(hrefs)) {
      const res = await request.get(href, { maxRedirects: 0 })
      // Public pages answer 200; pages that need an account answer with a redirect to sign-in.
      expect([200, 307], `${href} → ${res.status()}`).toContain(res.status())
    }
  })

  test('sitemap and robots are served', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    for (const [path] of CONTENT_PAGES) expect(xml).toContain(path)
    expect(xml).not.toContain('/dashboard')
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Sitemap:')
  })
})

test.describe('small phones', () => {
  for (const width of [320, 360]) {
    test(`no sideways scrolling at ${width}px`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone widths are checked once')
      const context = await browser.newContext({ viewport: { width, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
      const page = await context.newPage()
      for (const path of ['/', '/marketplace', '/how-it-works', '/campus-impact', '/help', '/terms', '/auth/login', '/auth/signup']) {
        await page.goto(path)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `${path} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0)
      }
      await page.goto('/')
      await page.screenshot({ path: `test-results/screens/landing-${width}.png`, fullPage: true })
      await context.close()
    })
  }
})
