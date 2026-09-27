import { expect, type BrowserContext, type Page } from '@playwright/test'

export interface Credentials {
  email: string
  password: string
}

export const COORDINATOR: Credentials = {
  email: 'arun.coordinator@example.com',
  password: 'Passw0rd!23',
}
export const VIEWER: Credentials = {
  email: 'vikram.itsupport@example.com',
  password: 'Passw0rd!23',
}

/**
 * Auth cookies per user, captured once per worker (BUG-21: the backend sets
 * HttpOnly cookies on login, so there is no token value for a script to read
 * or replay — only the cookie jar itself can be reused).
 */
const sessionCookies = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>()

/**
 * Sign in by API once per user, then seed the browser context's cookie jar.
 *
 * Signing in through the form on every test is what the login throttle exists
 * to stop: ten attempts a minute from one address, and a full run makes more
 * than that. It also makes every test a login test. The form itself is covered
 * once, in `signInThroughTheForm`; everything else starts already signed in,
 * which is also how a real session spends almost all of its time.
 */
export async function signIn(page: Page, who: Credentials) {
  const cached = sessionCookies.get(who.email)
  if (cached) {
    await page.context().addCookies(cached)
  } else {
    // `page.request` shares this page's context, so the Set-Cookie headers on
    // the response land straight in the browser's cookie jar.
    const response = await page.request.post('/api/v1/auth/login/', { data: who })
    const body = await response.json()
    if (body.otp_required) {
      throw new Error(
        'Login stopped at the OTP step. Start the backend with REQUIRE_OTP_FOR_LOGIN=False for E2E runs.',
      )
    }
    const cookies = await page.context().cookies()
    if (!cookies.some((cookie) => cookie.name === 'bcm_access')) {
      throw new Error(`Login failed for ${who.email}: ${JSON.stringify(body)}`)
    }
    sessionCookies.set(who.email, cookies)
  }

  await page.goto('/estates')
  await expect(page.getByRole('heading', { name: 'Estates' })).toBeVisible({ timeout: 30_000 })
}

/** The one place the real login form is exercised. */
export async function signInThroughTheForm(page: Page, who: Credentials) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(who.email)
  await page.getByLabel(/password/i).fill(who.password)
  await page.getByRole('button', { name: /sign in/i }).click()

  const otpPrompt = page.getByText(/verification code|one-time|otp/i)
  await Promise.race([
    page.waitForURL('**/estates', { timeout: 30_000 }),
    otpPrompt.waitFor({ timeout: 30_000 }).then(() => {
      throw new Error(
        'Login stopped at the OTP step. Start the backend with REQUIRE_OTP_FOR_LOGIN=False for E2E runs.',
      )
    }),
  ])
}
