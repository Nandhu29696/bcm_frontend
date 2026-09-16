import { expect, test, type Locator, type Page } from '@playwright/test'

import { COORDINATOR, signIn, VIEWER } from './auth'

/**
 * Journey step 8 through a real browser (Phase 8): declare a crisis event,
 * watch the simulated call tree escalate the seeded roster, read the report;
 * schedule a test from the calendar and close it with an outcome and a report.
 *
 * Uses 65-DEMO07 so the earlier suites' cost codes are untouched.
 */

const COST_CODE = '65-DEMO07'

/** The cost code option's label carries the process name, so pick by value. */
async function pickCostCode(dialog: Locator, code: string) {
  await dialog.getByLabel('Estate').selectOption({ label: 'Bangalore Estate' })
  const select = dialog.getByLabel('Cost code')
  const option = select.locator('option', { hasText: code })
  await expect(option).toHaveCount(1)
  await select.selectOption((await option.getAttribute('value')) as string)
}

function scheduledEntry(page: Page, name: RegExp) {
  return page
    .getByRole('region', { name: /tests this month/i })
    .getByRole('listitem')
    .filter({ hasText: name })
    .filter({ hasText: 'Scheduled' })
    .first()
    .getByRole('link')
}

test.describe('crisis management', () => {
  test('a crisis event runs the CMSC call tree in simulation', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('link', { name: 'Crisis Management' }).click()
    await expect(page.getByRole('heading', { name: 'Crisis Management' })).toBeVisible()

    await page.getByRole('button', { name: /declare an event/i }).click()
    const dialog = page.getByRole('dialog', { name: /declare a crisis event/i })
    await pickCostCode(dialog, COST_CODE)
    await dialog.getByLabel('Event type').selectOption('Live Incident')
    await dialog.getByLabel('CSD ticket number').fill('INC-2026-0914')
    await dialog.getByLabel('What happened').fill('Power failure at the primary site.')
    await expect(dialog.getByRole('radio', { name: /simulation/i })).toBeChecked()
    await dialog.getByRole('button', { name: /declare and simulate/i }).click()

    // Landed on the event page; the simulated run is complete (eager Celery).
    await expect(page).toHaveURL(/\/crisis\/\d+$/)
    await expect(page.getByRole('heading', { name: /Live Incident · 65-DEMO07/ })).toBeVisible()
    const run = page.getByRole('region', { name: /call tree run/i })
    await expect(run).toContainText('COMPLETED')
    await expect(run).toContainText('Simulation')
    // Seeded roster: Deepa (…1) and Ravi (…3) by voice, Kiran (…6) by Teams, Sunil (…9) nobody.
    await expect(run).toContainText('3/4 reached')
    await expect(run.getByRole('row').filter({ hasText: 'Deepa Nair' })).toContainText('Reached · Voice')
    await expect(run.getByRole('row').filter({ hasText: 'Kiran Rao' })).toContainText('Reached · Teams')
    const sunil = run.getByRole('row').filter({ hasText: 'Sunil Verma' })
    await expect(sunil).toContainText('Not reached')
    await expect(sunil.getByRole('listitem')).toHaveCount(7)
    await expect(sunil).toContainText('Email 3: Escalation Email Sent')
    // Response by level.
    const levels = page.getByLabel('Response by level')
    await expect(levels).toContainText('Level 1 · Voice calls')
    await expect(levels).toContainText('Level 2 · Microsoft Teams')

    // The roster the run dialled is right there.
    await expect(page.getByRole('region', { name: /CMSC roster/i })).toContainText('4 members')

    // Close it with a note; the list shows it closed.
    await page.getByRole('button', { name: /close event/i }).click()
    await page.getByLabel('Closing note').fill('Power restored, all accounted for.')
    await page.getByRole('dialog').getByRole('button', { name: /close event/i }).click()
    await expect(page.getByText('Closed', { exact: true })).toBeVisible()
    await expect(page.getByText(/Closed: Power restored/)).toBeVisible()
    await expect(page.getByRole('button', { name: /start call tree/i })).toHaveCount(0)

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Crisis Management' }).click()
    const row = page.getByRole('row').filter({ hasText: 'INC-2026-0914' }).first()
    await expect(row).toContainText('Closed')
    await expect(row).toContainText('3/4 · sim')
  })

  test('the roster can be edited from the cost code page', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('link', { name: /Bangalore Estate/ }).click()
    await page.getByLabel(/filter by cost code/i).fill(COST_CODE)
    await expect(page.getByRole('link', { name: COST_CODE, exact: true })).toBeVisible()
    await expect(page).toHaveURL(/cost_code=/)
    await expect(page.getByText('Updating')).toHaveCount(0)
    await page.getByRole('link', { name: COST_CODE, exact: true }).click()

    const roster = page.getByRole('region', { name: /CMSC roster/i })
    await expect(roster).toBeVisible()
    await roster.getByRole('button', { name: /add member/i }).click()
    const dialog = page.getByRole('dialog', { name: /add committee member/i })
    await dialog.getByLabel('Name').fill('E2E Temp Member')
    await dialog.getByLabel('Email', { exact: true }).fill('e2e.temp@example.com')
    await dialog.getByLabel('Phone number').fill('9100000004')
    await dialog.getByRole('button', { name: /add member/i }).click()
    const added = roster.getByRole('row').filter({ hasText: 'E2E Temp Member' })
    await expect(added).toBeVisible()
    await added.getByRole('button', { name: /remove e2e temp member/i }).click()
    await expect(added).toHaveCount(0)
  })

  test('a viewer can see events but not declare one', async ({ page }) => {
    await signIn(page, VIEWER)
    await page.getByRole('link', { name: 'Crisis Management' }).click()
    await expect(page.getByRole('heading', { name: 'Crisis Management' })).toBeVisible()
    await expect(page.getByRole('button', { name: /declare an event/i })).toHaveCount(0)
  })
})

test.describe('tests', () => {
  test('schedule from the calendar, record an outcome with a report', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('link', { name: 'Tests' }).click()
    await expect(page.getByRole('heading', { name: 'Tests' })).toBeVisible()

    // Schedule for the 15th of the month shown, so it lands on this calendar.
    const month = new URL(page.url()).searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
    const date = `${month}-15`
    await page.getByRole('button', { name: /schedule a test/i }).click()
    const dialog = page.getByRole('dialog', { name: /schedule a test/i })
    await pickCostCode(dialog, COST_CODE)
    await dialog.getByLabel('Type of test').selectOption('Tabletop Exercise')
    await dialog.getByLabel('Date').fill(date)
    await dialog.getByLabel('Time').fill('14:00')
    await dialog.getByLabel('Notes').fill('E2E tabletop')
    await dialog.getByRole('button', { name: /^schedule$/i }).click()
    await expect(dialog).toHaveCount(0)

    // Earlier runs leave completed tests on the same day; open the one still Scheduled.
    const listed = scheduledEntry(page, /Tabletop Exercise · 65-DEMO07/)
    await expect(listed).toBeVisible()
    await expect(page.getByRole('grid', { name: 'Calendar' }).getByRole('link', { name: COST_CODE })).not.toHaveCount(0)
    await listed.click()

    await expect(page.getByRole('heading', { name: 'Tabletop Exercise' })).toBeVisible()
    await page.getByRole('button', { name: /record outcome/i }).click()
    const outcome = page.getByRole('dialog', { name: /record the outcome/i })
    await outcome.getByLabel('Final status').selectOption('Passed')
    await outcome.getByLabel('Result').fill('Everyone knew their role.')
    await outcome.getByLabel('Final report').setInputFiles({ name: 'tabletop-report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 e2e') })
    await outcome.getByRole('button', { name: /complete test/i }).click()

    await expect(page.getByText('Completed', { exact: true })).toBeVisible()
    const outcomes = page.getByRole('list', { name: 'Outcomes' })
    await expect(outcomes).toContainText('Passed')
    await expect(outcomes).toContainText('Everyone knew their role.')
    await expect(outcomes.getByRole('button', { name: /download report/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /record outcome/i })).toHaveCount(0)
  })

  test('a call tree test runs the simulation from the test page', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('link', { name: 'Tests' }).click()
    const month = new URL(page.url()).searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
    await page.getByRole('button', { name: /schedule a test/i }).click()
    const dialog = page.getByRole('dialog', { name: /schedule a test/i })
    await pickCostCode(dialog, COST_CODE)
    await dialog.getByLabel('Type of test').selectOption('Call Tree Test')
    await dialog.getByLabel('Date').fill(`${month}-20`)
    await dialog.getByRole('button', { name: /^schedule$/i }).click()
    await expect(dialog).toHaveCount(0)
    await scheduledEntry(page, /Call Tree Test · 65-DEMO07/).click()

    await page.getByRole('button', { name: /run call tree/i }).click()
    await page.getByRole('dialog', { name: /run the call tree/i }).getByRole('button', { name: /run simulation/i }).click()
    await expect(page.getByText('In Progress', { exact: true })).toBeVisible()
    const run = page.getByRole('region', { name: /call tree run/i })
    await expect(run).toContainText('COMPLETED')
    await expect(run).toContainText('3/4 reached')
    // Tidy up: cancel so the calendar does not fill with open call tree tests.
    await page.getByRole('button', { name: /cancel test/i }).click()
    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()
  })
})
