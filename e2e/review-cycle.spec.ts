import { expect, test, type Download, type Page } from '@playwright/test'

import { COORDINATOR, signIn, type Credentials } from './auth'

/**
 * Journey steps 6-7 through a real browser (Phases 6 and 7): complete a plan,
 * submit it, have the BU lead send it back, resubmit, approve, download the
 * generated document, and start a new version so the run is repeatable.
 *
 * Uses 65-DEMO04 (Bangalore, BU lead Priya, coordinator Arun) so the Phase 3/4
 * suites' cost code is untouched.
 */

const BU_LEAD: Credentials = { email: 'priya.lead@example.com', password: 'Passw0rd!23' }
const COST_CODE = '65-DEMO04'

async function openCostCode(page: Page, code: string) {
  await page.getByRole('link', { name: /Bangalore Estate/ }).click()
  await page.getByLabel(/filter by cost code/i).fill(code)
  await expect(page.getByRole('link', { name: code, exact: true })).toBeVisible()
  await expect(page).toHaveURL(/cost_code=/)
  await expect(page.getByText('Updating')).toHaveCount(0)
  await page.getByRole('link', { name: code, exact: true }).click()
  await expect(page.getByRole('region', { name: /current version/i })).toBeVisible()
}

function current(page: Page) {
  return page.getByRole('region', { name: /current version/i })
}

function sectionTab(page: Page, name: string) {
  return page.getByRole('tablist', { name: /sections/i }).getByRole('tab', { name: new RegExp(`^${name} ([0-9]+%|[0-9]+ left|Done)$`) })
}

function question(page: Page, text: RegExp) {
  return page.getByRole('article').filter({ hasText: text })
}

async function completeThePlan(page: Page) {
  await current(page).getByRole('link', { name: /open plan/i }).click()
  await expect(page.getByRole('tablist', { name: /sections/i })).toBeVisible()

  await question(page, /Dedicated Client Offshore/).getByRole('radio', { name: 'No' }).check()
  const penalties = question(page, /penalties for BCP non-compliance/)
  await penalties.getByRole('radio', { name: 'Yes' }).check()
  // A Yes needs the penalty clause behind it before the section completes.
  const evidence = penalties.getByRole('region', { name: /evidence for BASIC-004/i })
  if ((await evidence.getByRole('button', { name: /remove/i }).count()) === 0) {
    await evidence.getByLabel(/choose evidence/i).setInputFiles({
      name: 'penalty-clause.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4 review-cycle ${Date.now()}`),
    })
    await expect(evidence).toContainText('penalty-clause.pdf')
  }
  await expect(sectionTab(page, 'Basic Questions')).toContainText('Done')

  for (const [tab, text, value] of [
    ['RTO', /What is the RTO/, '8'],
    ['MBCO', /What is the MBCO/, '60'],
    ['MAO', /What is the MAO/, '48'],
  ] as const) {
    await sectionTab(page, tab).click()
    const q = question(page, text)
    const box = q.getByRole('spinbutton')
    if ((await box.inputValue()) !== value) await box.fill(value)
    await expect(sectionTab(page, tab)).toContainText('Done', { timeout: 5_000 })
  }

  await sectionTab(page, 'RPO').click()
  await question(page, /client data hosted/).getByRole('radio', { name: 'No' }).check()
  await expect(sectionTab(page, 'RPO')).toContainText('Done')

  // The BIA questions are answered in the BIA part, not on a tab.
  await page.getByRole('tablist', { name: 'Parts' }).getByRole('tab', { name: 'BIA', exact: true }).click()
  const site = question(page, /Where does your process operate from/)
  await expect(site).toBeVisible()
  // Three catalogue options render as radio pills; a longer list would be a select.
  await site.getByRole('radio').first().check()
  await question(page, /100% Work from home/).getByRole('radio', { name: 'No' }).check()
  await question(page, /outsourced or Sub contracted/).getByRole('radio', { name: 'No' }).check()
  await question(page, /dedicated Corp Function support/).getByRole('radio', { name: 'No' }).check()
  await question(page, /third party support for BAU/).getByRole('radio', { name: 'No' }).check()
  await expect(page.getByText(/Questionnaire 6 of 6/)).toBeVisible()
  await expect(page.getByText(/All changes saved/)).toBeVisible()
}

test.describe('submission and review', () => {
  // Generous: the cycle is long and shares the backend with the other workers.
  test.setTimeout(300_000)

  test('the full cycle: submit, send back, resubmit, approve, download, new version', async ({ browser }) => {
    // --- Coordinator completes and submits ---------------------------------
    const arun = await browser.newPage()
    await signIn(arun, COORDINATOR)
    await openCostCode(arun, COST_CODE)

    // A plan can only be submitted once every required question is answered.
    // If a previous run left it approved, cut a new version first.
    if (await current(arun).getByRole('button', { name: /new version/i }).isVisible()) {
      await current(arun).getByRole('button', { name: /new version/i }).click()
      await arun.getByRole('dialog').getByRole('button', { name: /create new version/i }).click()
      await expect(current(arun)).toContainText('Work in Progress')
    }
    await completeThePlan(arun)

    // From the editor header.
    await arun.getByRole('button', { name: /submit for review/i }).click()
    const submit = arun.getByRole('dialog', { name: /submit for bu lead review/i })
    await submit.getByRole('textbox').fill('Ready for your review.')
    await submit.getByRole('button', { name: /^submit$/i }).click()
    await expect(arun.getByText(/Pending BU Lead Review/)).toBeVisible()
    await expect(arun.getByText(/Read-only: this version is closed/)).toBeVisible()

    // --- BU lead sends it back ----------------------------------------------
    const priya = await browser.newPage()
    await signIn(priya, BU_LEAD)
    // The submission reached her bell as well as her inbox.
    const bell = priya.getByRole('button', { name: /^Notifications, \d+ unread$/ })
    await expect(bell).toBeVisible()
    await bell.click()
    const tray = priya.getByRole('dialog', { name: 'Notifications' })
    await expect(tray.getByRole('list', { name: 'Notification list' }).getByRole('listitem').first()).toContainText(/ready for your review/i)
    await priya.keyboard.press('Escape')
    await priya.getByRole('link', { name: 'Reviews' }).click()
    const row = priya.getByRole('row').filter({ hasText: COST_CODE })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /send back/i }).click()
    const rework = priya.getByRole('dialog', { name: /send back for rework/i })
    await rework.getByRole('textbox').fill('Please justify the RTO figure.')
    await rework.getByRole('button', { name: /send back/i }).click()
    await expect(priya.getByRole('row').filter({ hasText: COST_CODE })).toHaveCount(0)

    // --- Coordinator sees the rework, resubmits ------------------------------
    await arun.goto('/estates')
    await openCostCode(arun, COST_CODE)
    await expect(current(arun)).toContainText('Rework')
    await current(arun).getByRole('button', { name: /history/i }).click()
    const history = arun.getByRole('dialog', { name: /history/i })
    await expect(history).toContainText('Please justify the RTO figure.')
    await arun.keyboard.press('Escape')

    await current(arun).getByRole('button', { name: /submit for review/i }).click()
    await arun.getByRole('dialog', { name: /submit for bu lead review/i }).getByRole('button', { name: /^submit$/i }).click()
    await expect(current(arun)).toContainText('Pending BU Lead Review')

    // --- BU lead approves ------------------------------------------------------
    await priya.reload()
    const again = priya.getByRole('row').filter({ hasText: COST_CODE })
    await expect(again).toBeVisible()
    await again.getByRole('button', { name: /^approve$/i }).click()
    await priya.getByRole('dialog', { name: /approve this plan/i }).getByRole('button', { name: /^approve$/i }).click()
    await expect(priya.getByRole('row').filter({ hasText: COST_CODE })).toHaveCount(0)

    // --- The approved document exists and downloads ---------------------------
    await arun.reload()
    await expect(current(arun)).toContainText('Approved')
    const docs = current(arun).getByRole('region', { name: /generated documents/i })
    await expect(docs).toContainText('.docx')
    await expect(docs).toContainText('.pdf')
    await expect(docs).toContainText('BCP_PLAN v')

    // The link opens in a new tab; the response is an attachment, so the tab
    // never "loads" - Chromium turns it into a download on that tab.
    // The download fires the instant the tab opens, so the listener has to be
    // attached inside the page handler, before the tab navigates.
    // Chromium attributes a download that replaces a window.open navigation
    // to either the popup or the opener, depending on timing; accept both.
    const downloaded = new Promise<Download>((resolve) => {
      arun.once('download', resolve)
      arun.context().once('page', (popup) => popup.once('download', resolve))
    })
    await docs.getByRole('button', { name: /download/i }).first().click()
    const download = await downloaded
    expect(download.suggestedFilename()).toMatch(/^BCP-65-DEMO04-v[0-9]+-.*[.](docx|pdf)$/)
    expect(download.url()).toContain('/api/v1/documents/')
    expect(download.url()).toContain('token=')

    // --- The trail is complete, in order ----------------------------------------
    await current(arun).getByRole('button', { name: /history/i }).click()
    const trail = arun.getByRole('dialog', { name: /history/i })
    // Wait for the list to render before reading it - allInnerTexts does not wait.
    await expect(trail.locator('ol li').last()).toContainText('Approved')
    const statuses = (await trail.locator('ol li').allInnerTexts()).map((t) => t.split(String.fromCharCode(10))[0])
    expect(statuses.slice(-3)).toEqual(['Work in Progress', 'Pending BU Lead Review', 'Approved'])
    await arun.keyboard.press('Escape')

    // --- Leave the plan as we found it: a fresh Work in Progress version --------
    await current(arun).getByRole('button', { name: /new version/i }).click()
    await arun.getByRole('dialog').getByRole('button', { name: /create new version/i }).click()
    await expect(current(arun)).toContainText('Work in Progress')

    await arun.close()
    await priya.close()
  })

  test('the coordinator cannot approve and a viewer sees no review controls', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('link', { name: 'Reviews' }).click()
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^approve$/i })).toHaveCount(0)
  })
})
