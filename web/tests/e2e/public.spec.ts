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
    await expect(page.getByText('Pilot: all payments are simulated sandbox money.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse the marketplace' })).toHaveAttribute('href', '/marketplace')
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
  for (const path of ['/dashboard', '/activity', '/sell/new', '/handover', '/warden', '/admin/roles', '/settings']) {
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
