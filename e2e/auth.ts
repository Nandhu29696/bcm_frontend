import { expect, type Page } from '@playwright/test'

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

/** Storage keys the app's axios client reads — see src/api/client.ts. */
const ACCESS_KEY = 'bcm.access'
const REFRESH_KEY = 'bcm.refresh'

/** Token pairs per user, for the life of the worker. */
const tokens = new Map<string, { access: string; refresh: string }>()

/**
 * Sign in by API once per user, then seed the browser's token storage.
 *
 * Signing in through the form on every test is what the login throttle exists
 * to stop: ten attempts a minute from one address, and a full run makes more
 * than that. It also makes every test a login test. The form itself is covered
 * once, in `signInThroughTheForm`; everything else starts already signed in,
 * which is also how a real session spends almost all of its time.
 */
export async function signIn(page: Page, who: Credentials) {
  let pair = tokens.get(who.email)
  if (!pair) {
    const response = await page.request.post('/api/v1/auth/login/', { data: who })
    const body = await response.json()
    if (body.otp_required) {
      throw new Error(
        'Login stopped at the OTP step. Start the backend with REQUIRE_OTP_FOR_LOGIN=False for E2E runs.',
      )
    }
    if (!body.access) {
      throw new Error(`Login failed for ${who.email}: ${JSON.stringify(body)}`)
    }
    pair = { access: body.access, refresh: body.refresh }
    tokens.set(who.email, pair)
  }

  await page.addInitScript(
    ([accessKey, refreshKey, access, refresh]) => {
      localStorage.setItem(accessKey, access)
      localStorage.setItem(refreshKey, refresh)
    },
    [ACCESS_KEY, REFRESH_KEY, pair.access, pair.refresh] as const,
  )
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
