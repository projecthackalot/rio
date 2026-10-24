/**
 * Selenium WebDriver helpers. Each test gets a fresh headless Chrome; the
 * browser console and failed network requests are captured so connection
 * errors surface as test failures instead of passing silently.
 */
import { Builder, By, type WebDriver, type WebElement } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome'
import { logging } from 'selenium-webdriver'

export const BASE = process.env.SELENIUM_BASE_URL ?? 'http://localhost:3400'
export const WAIT = 20_000

export async function newDriver({ width = 1366, height = 900, mobile = false } = {}): Promise<WebDriver> {
  const options = new chrome.Options()
  options.addArguments('--headless=new', `--window-size=${width},${height}`, '--disable-gpu', '--no-first-run', '--disable-extensions', '--lang=en-IN')
  if (mobile) {
    options.setMobileEmulation({ width, height, pixelRatio: 2 })
  }
  const prefs = new logging.Preferences()
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL)
  options.setLoggingPrefs(prefs)
  return new Builder().forBrowser('chrome').setChromeOptions(options).build()
}

export async function open(driver: WebDriver, path: string) {
  await driver.get(`${BASE}${path}`)
  await driver.wait(async () => (await driver.executeScript('return document.readyState')) === 'complete', WAIT)
}

/**
 * Text of the visible page heading. Streamed Suspense content first arrives in
 * a hidden container before React swaps it in, so wait for a displayed,
 * non-empty <h1> rather than taking the first one in the DOM.
 */
export async function h1Text(driver: WebDriver): Promise<string> {
  return driver.wait(async () => {
    for (const h of await driver.findElements(By.css('h1'))) {
      if (await h.isDisplayed()) {
        const t = (await h.getText()).trim()
        if (t) return t
      }
    }
    return null
  }, WAIT) as Promise<string>
}

export async function byRole(driver: WebDriver, role: 'button' | 'link', name: string | RegExp): Promise<WebElement> {
  const css = role === 'button' ? 'button, [role=button], input[type=submit]' : 'a[href]'
  return driver.wait(async () => {
    for (const el of await driver.findElements(By.css(css))) {
      const label = ((await el.getAttribute('aria-label')) || (await el.getText()) || '').trim()
      if ((typeof name === 'string' ? label === name : name.test(label)) && (await el.isDisplayed())) return el
    }
    return null
  }, WAIT) as Promise<WebElement>
}

export async function fieldByLabel(driver: WebDriver, label: string): Promise<WebElement> {
  return driver.wait(async () => {
    for (const l of await driver.findElements(By.css('label'))) {
      if ((await l.getText()).trim().startsWith(label)) {
        const id = await l.getAttribute('for')
        if (id) return driver.findElement(By.id(id))
      }
    }
    return null
  }, WAIT) as Promise<WebElement>
}

/** Console errors and failed requests from the page (excluding known-benign noise). */
export async function browserErrors(driver: WebDriver): Promise<string[]> {
  const entries = await driver.manage().logs().get(logging.Type.BROWSER)
  return (
    entries
      .filter((e) => e.level.value >= logging.Level.SEVERE.value)
      .map((e) => e.message)
      .filter((m) => !/favicon\.ico/.test(m))
      // `next dev` forwards server console output into the browser with a " Server " badge.
      // Those are server logs (watched separately), not browser or connection errors.
      .filter((m) => !/" Server "/.test(m))
  )
}

export async function horizontalOverflow(driver: WebDriver): Promise<number> {
  return driver.executeScript<number>('return document.documentElement.scrollWidth - document.documentElement.clientWidth')
}

export async function bodyText(driver: WebDriver): Promise<string> {
  return driver.findElement(By.css('body')).getText()
}

/** True when the Supabase project answers, so signed-in tests can run. */
export async function backendAvailable(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return false
  try {
    const r = await fetch(`${url}/rest/v1/categories?select=slug&limit=1`, { headers: { apikey: key }, signal: AbortSignal.timeout(10_000) })
    return r.ok
  } catch {
    return false
  }
}
