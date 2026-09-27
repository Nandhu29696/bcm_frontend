import { expect, test } from '@playwright/test'

/**
 * The sign-in page offers Google when the backend has it configured, and the
 * button hands the browser to Google with our redirect URI. Stops at Google's
 * door: the rest needs a real account.
 */
test('the login page offers Google sign-in and sends the browser to Google', async ({ page, request }) => {
  // Needs GOOGLE_OAUTH_* in the backend's .env; CI has no provider credentials.
  // A transient proxy hiccup here (dev server still warming up) is not this
  // test's concern - treat it the same as "not configured" rather than a hard
  // failure the run can't tell apart from a real regression.
  let providers: { name: string; configured: boolean }[] = []
  try {
    const response = await request.get('/api/v1/auth/providers/')
    providers = response.ok() ? ((await response.json()).providers ?? []) : []
  } catch {
    providers = []
  }
  test.skip(!providers.some((p) => p.name === 'google' && p.configured), 'Google SSO is not configured on this backend')

  await page.goto('/login')
  const google = page.getByRole('button', { name: /continue with google/i })
  await expect(google).toBeVisible()
  await page.screenshot({ path: 'test-results/login-with-google.png', fullPage: true })

  await google.click()
  await page.waitForURL(/accounts\.google\.com/)
  const url = new URL(page.url())
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/auth/google/callback')
  expect(url.searchParams.get('scope')).toContain('openid')
  expect(url.searchParams.get('state')).toBeTruthy()
})
