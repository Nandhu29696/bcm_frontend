import { expect, test, type Download, type Page } from '@playwright/test'

import { COORDINATOR, signIn, VIEWER, type Credentials } from './auth'

/**
 * Phase 9 through a real browser: the dashboard renders the programme's
 * figures in scope, the help library is managed by an administrator and read
 * by everyone, and a report is requested and downloaded.
 */

const ADMIN: Credentials = { email: 'admin@example.com', password: 'Passw0rd!23' }

function expectDownload(page: Page) {
  return new Promise<Download>((resolve) => {
    page.once('download', resolve)
    page.context().once('page', (popup) => popup.once('download', resolve))
  })
}

test.describe('dashboard', () => {
  test('shows figures for the estates in scope and filters by estate', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    const headline = page.getByRole('region', { name: /headline figures/i })
    await expect(headline).toContainText('Cost codes')
    await expect(headline).toContainText('Approved plans')
    await expect(page.getByRole('region', { name: /BCP status by estate/i })).toContainText('Bangalore Estate')
    await expect(page.getByRole('region', { name: /risk heat map/i })).toContainText('Likelihood')
    await expect(page.getByRole('region', { name: /test coverage/i })).toBeVisible()
    await expect(page.getByRole('region', { name: /call tree response/i })).toBeVisible()

    await page.getByLabel('Estate', { exact: true }).selectOption({ label: 'Bangalore Estate' })
    await expect(page).toHaveURL(/estate=\d+/)
    const byEstate = page.getByRole('region', { name: /BCP status by estate/i })
    await expect(byEstate).toContainText('Bangalore Estate')
    await expect(byEstate).not.toContainText('Chennai Estate')
  })
})

test.describe('help library', () => {
  test('an administrator adds a document; a coordinator finds and downloads it', async ({ browser }) => {
    const admin = await browser.newPage()
    await signIn(admin, ADMIN)
    await admin.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Help' }).click()
    await expect(admin.getByRole('heading', { name: 'Help' })).toBeVisible()
    const title = `E2E guide ${Date.now()}`
    await admin.getByRole('button', { name: /add document/i }).click()
    const dialog = admin.getByRole('dialog', { name: /add a document/i })
    await dialog.getByLabel('Title').fill(title)
    await dialog.getByLabel('Description').fill('Written by the browser suite.')
    await dialog.getByLabel('Category').fill('Guides')
    await dialog.getByLabel('File').setInputFiles({ name: 'e2e-guide.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 e2e guide') })
    await dialog.getByRole('button', { name: /add document/i }).click()
    await expect(dialog).toHaveCount(0)
    await expect(admin.getByRole('heading', { name: title })).toBeVisible()

    const arun = await browser.newPage()
    await signIn(arun, COORDINATOR)
    await arun.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Help' }).click()
    await arun.getByLabel('Search help').fill('browser suite')
    const card = arun.getByRole('listitem').filter({ hasText: title })
    await expect(card).toBeVisible()
    await expect(arun.getByRole('button', { name: /add document/i })).toHaveCount(0)
    const downloaded = expectDownload(arun)
    await card.getByRole('button', { name: /download/i }).click()
    const download = await downloaded
    expect(download.suggestedFilename()).toBe('e2e-guide.pdf')

    // Tidy up so the library does not fill with suite guides.
    await admin.getByRole('button', { name: `Remove ${title}` }).click()
    await expect(admin.getByRole('heading', { name: title })).toHaveCount(0)
    await admin.close()
    await arun.close()
  })

  test('a viewer can read the library', async ({ page }) => {
    await signIn(page, VIEWER)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Help' }).click()
    await expect(page.getByRole('heading', { name: 'BCM programme overview' })).toBeVisible()
    await expect(page.getByRole('button', { name: /add document/i })).toHaveCount(0)
  })
})

test.describe('reports', () => {
  test('request the estate detail report and download it', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Reports' }).click()
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible()

    const form = page.getByRole('region', { name: /request a report/i })
    await form.getByLabel('Report').selectOption('ESTATE_DETAIL')
    await form.getByLabel('Format').selectOption('csv')
    await form.getByLabel('Estate').selectOption({ label: 'Bangalore Estate' })
    await form.getByRole('button', { name: /request report/i }).click()

    const mine = page.getByRole('region', { name: /my reports/i })
    const row = mine.getByRole('row').filter({ hasText: 'Estate detail report' }).first()
    await expect(row).toContainText('Completed')
    await expect(row).toContainText('CSV · Bangalore Estate')
    const downloaded = expectDownload(page)
    await row.getByRole('button', { name: /download/i }).click()
    const download = await downloaded
    expect(download.suggestedFilename()).toMatch(/^estate_detail-.*\.csv$/)
    expect(download.url()).toContain('token=')
  })
})
