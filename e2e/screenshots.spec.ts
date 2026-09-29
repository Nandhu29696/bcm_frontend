import { test, type Page } from '@playwright/test'

import { COORDINATOR, signIn } from './auth'

/**
 * Not a test: captures the main screens to `test-results/screens/` so the
 * design can be reviewed as images. Run with `-g screenshots`; skipped in the
 * normal suite because it asserts nothing.
 */
const OUT = 'test-results/screens'

async function shot(page: Page, name: string) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
}

test.describe('screenshots', () => {
  test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture')
  test.use({ viewport: { width: 1440, height: 900 } })

  test('capture', async ({ page }) => {
    await page.goto('/login')
    await shot(page, '01-login')

    await signIn(page, COORDINATOR)
    await shot(page, '02-estates')

    await page.getByRole('link', { name: /Bangalore Estate/ }).click()
    await page.getByRole('link', { name: '65-DEMO01', exact: true }).waitFor()
    await shot(page, '03-cost-codes')

    await page.getByRole('button', { name: 'Actions for 65-DEMO01' }).click()
    await shot(page, '04-row-menu')
    await page.keyboard.press('Escape')

    await page.getByRole('link', { name: '65-DEMO01', exact: true }).click()
    await page.getByRole('region', { name: /current version/i }).waitFor()
    await shot(page, '05-cost-code')

    await page.getByRole('region', { name: /current version/i }).getByRole('link', { name: /open plan/i }).click()
    await page.getByRole('tablist', { name: /sections/i }).waitFor()
    await shot(page, '06-editor')

    const parts = page.getByRole('tablist', { name: 'Parts' })
    await parts.getByRole('tab', { name: 'Summary' }).click()
    await page.getByRole('region', { name: 'Recovery objectives' }).waitFor()
    await shot(page, '07-summary')

    await parts.getByRole('tab', { name: 'BIA', exact: true }).click()
    await page.getByRole('region', { name: 'Employees on this cost code' }).waitFor()
    await shot(page, '07-editor-bia')

    await parts.getByRole('tab', { name: 'RA', exact: true }).click()
    await page.getByRole('region', { name: 'Risk register' }).waitFor()
    await shot(page, '08-risk-register')

    await page.getByRole('region', { name: 'Risk register' }).getByRole('button', { name: /add risk/i }).click()
    await shot(page, '09-modal')
  })
})
