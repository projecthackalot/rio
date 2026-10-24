/**
 * Selenium: public surface. Runs with or without a reachable database; where
 * the backend matters, the test asserts the app degrades honestly (inline
 * error, never a crash page) instead of assuming data exists.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { By, Key, until, type WebDriver } from 'selenium-webdriver'
import { BASE, WAIT, backendAvailable, bodyText, browserErrors, byRole, fieldByLabel, h1Text, horizontalOverflow, newDriver, open } from './helpers'

const PUBLIC_PAGES: [string, RegExp][] = [
  ['/', /Leaving campus\?/],
  ['/marketplace', /^Marketplace$/],
  ['/how-it-works', /How RIO works/],
  ['/about', /About RIO/],
  ['/campus-impact', /Campus impact/],
  ['/trust-and-safety', /Trust and safety/],
  ['/help', /Help and FAQ/],
  ['/contact', /^Contact$/],
  ['/privacy', /^Privacy$/],
  ['/terms', /Terms and listing policy/],
  ['/accessibility', /^Accessibility$/],
  ['/auth/login', /Welcome back/],
  ['/auth/signup', /Create your account/],
  ['/auth/forgot-password', /Reset your password/],
  ['/auth/magic-link', /Sign in by email/],
]

let driver: WebDriver
let backend = false

beforeAll(async () => {
  backend = await backendAvailable()
  driver = await newDriver()
})
afterAll(async () => {
  await driver?.quit()
})

describe('every public page loads without console or connection errors', () => {
  for (const [path, heading] of PUBLIC_PAGES) {
    it(path, async () => {
      await open(driver, path)
      expect(await h1Text(driver)).toMatch(heading)
      const text = await bodyText(driver)
      expect(text).not.toMatch(/Something went wrong on our side|Application error|Internal Server Error/)
      const errors = await browserErrors(driver)
      expect(errors, errors.join('\n')).toEqual([])
    })
  }
})

describe('navigation', () => {
  it('every footer link opens a real page (no 404, no crash)', async () => {
    await open(driver, '/')
    const raw = await Promise.all((await driver.findElements(By.css('footer a[href^="/"]'))).map((a) => a.getAttribute('href')))
    const hrefs = [...new Set(raw.filter((h): h is string => Boolean(h)))]
    expect(hrefs.length).toBeGreaterThan(8)
    for (const href of hrefs) {
      await driver.get(href)
      const text = await bodyText(driver)
      expect(text, href).not.toMatch(/This page isn’t here|Something went wrong on our side/)
      expect(await h1Text(driver), href).not.toBe('')
    }
  })

  it('unknown URLs show the 404 page', async () => {
    await open(driver, '/definitely-not-a-page')
    expect(await h1Text(driver)).toBe('This page isn’t here')
  })

  it('the skip link moves keyboard focus to the main content', async () => {
    await open(driver, '/')
    await driver.findElement(By.css('body')).sendKeys(Key.TAB)
    const active = await driver.switchTo().activeElement()
    expect((await active.getText()).trim()).toBe('Skip to content')
    await active.sendKeys(Key.ENTER)
    await driver.wait(async () => (await driver.getCurrentUrl()).endsWith('#main'), WAIT)
  })
})

describe('marketplace and search', () => {
  it('home search lands on the marketplace with the query in the URL', async () => {
    await open(driver, '/')
    const input = await fieldByLabel(driver, 'Search items')
    await input.sendKeys('cooler', Key.ENTER)
    await driver.wait(until.urlMatches(/\/marketplace\?q=cooler$/), WAIT)
    expect(await h1Text(driver)).toBe('Marketplace')
  })

  it('shows listings when the database is up, and an honest inline error when it is not', async () => {
    await open(driver, '/marketplace')
    expect(await h1Text(driver)).toBe('Marketplace')
    const text = await bodyText(driver)
    if (backend) {
      expect(text).toMatch(/\d+ items? available|No items found/)
      expect(text).not.toMatch(/Listings couldn’t be loaded/)
    } else {
      expect(text).toMatch(/Listings couldn’t be loaded/)
      expect(text).not.toMatch(/Something went wrong on our side/)
    }
  })

  it('a reversed price range is corrected and explained', async () => {
    await open(driver, '/marketplace?min=900&max=200')
    if (!backend) return // the notice sits above results, which need the database
    expect(await bodyText(driver)).toMatch(/Showing ₹200 to ₹900/)
  })

  it('category chips filter by category', async () => {
    await open(driver, '/marketplace')
    if (!backend) return
    await (await byRole(driver, 'link', 'Air cooler')).click()
    await driver.wait(until.urlContains('category=air-cooler'), WAIT)
  })
})

describe('forms and access control', () => {
  it('sign-up validates on the server and offers no role selector', async () => {
    await open(driver, '/auth/signup')
    expect(await driver.findElements(By.css('select[name="role"], input[name="role"]'))).toHaveLength(0)
    await (await fieldByLabel(driver, 'Full name')).sendKeys('A')
    await (await fieldByLabel(driver, 'Email')).sendKeys('not-an-email')
    await (await fieldByLabel(driver, 'Password')).sendKeys('short')
    await (await fieldByLabel(driver, 'Confirm password')).sendKeys('different')
    await (await byRole(driver, 'button', 'Create account')).click()
    await driver.wait(until.elementLocated(By.css('[aria-invalid="true"]')), WAIT)
    const text = await bodyText(driver)
    expect(text).toMatch(/Enter a valid email address\./)
    expect(text).toMatch(/Passwords don’t match\./)
    expect(await (await fieldByLabel(driver, 'Email')).getAttribute('value')).toBe('not-an-email')
  })

  it('wrong credentials give a generic message (no account enumeration), even if the backend is down', async () => {
    await open(driver, '/auth/login')
    await (await fieldByLabel(driver, 'Email')).sendKeys('nobody@rio.test')
    await (await fieldByLabel(driver, 'Password')).sendKeys('wrong-password-1')
    await (await byRole(driver, 'button', 'Sign in')).click()
    const alert = await driver.wait(until.elementLocated(By.css('[role="alert"]')), WAIT)
    expect(await alert.getText()).toMatch(/didn’t work|couldn’t|try again/i)
    expect(await driver.getCurrentUrl()).toContain('/auth/login')
  })

  for (const path of ['/dashboard', '/sell/new', '/saved', '/activity', '/handover', '/warden', '/admin/roles', '/settings']) {
    it(`${path} sends signed-out visitors to sign in and back`, async () => {
      await open(driver, path)
      await driver.wait(until.urlContains('/auth/login'), WAIT)
      expect(decodeURIComponent(await driver.getCurrentUrl())).toContain(`next=${path}`)
    })
  }

  it('refuses open redirects after sign-in', async () => {
    await open(driver, '/auth/login?next=//evil.example')
    const hidden = await driver.findElement(By.css('input[name="next"]'))
    expect(await hidden.getAttribute('value')).toBe('/dashboard')
  })
})

describe('phone layout', () => {
  for (const width of [320, 360]) {
    it(`no sideways scrolling at ${width}px`, async () => {
      const phone = await newDriver({ width, height: 740, mobile: true })
      try {
        for (const path of ['/', '/marketplace', '/how-it-works', '/campus-impact', '/help', '/terms', '/auth/login', '/auth/signup']) {
          await phone.get(`${BASE}${path}`)
          await h1Text(phone)
          expect(await horizontalOverflow(phone), `${path} at ${width}px`).toBeLessThanOrEqual(0)
        }
        // Signed-out phones get a bottom navigation bar.
        await phone.get(`${BASE}/`)
        expect(await phone.findElements(By.css('nav[aria-label="Primary"] a'))).toHaveLength(3)
      } finally {
        await phone.quit()
      }
    })
  }
})
