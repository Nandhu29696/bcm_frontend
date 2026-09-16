import { expect, test, type Page } from '@playwright/test'

import { COORDINATOR, VIEWER, signIn } from './auth'

/**
 * Phase 5.7 through a real browser: the repeatable-row editors, the risk
 * register with server-derived scores, the heat map, actions and strategy.
 *
 * Each test removes what it adds, so the suite is re-runnable.
 */

const COST_CODE = '65-DEMO01'

async function openEditor(page: Page, code: string) {
  await page.getByRole('link', { name: /Bangalore Estate/ }).click()
  await page.getByLabel(/filter by cost code/i).fill(code)
  await expect(page.getByRole('link', { name: code, exact: true })).toBeVisible()
  await expect(page).toHaveURL(/cost_code=/)
  await expect(page.getByText('Updating')).toHaveCount(0)
  await page.getByRole('link', { name: code, exact: true }).click()
  await page.getByRole('region', { name: /current version/i }).getByRole('link', { name: /open plan|view plan/i }).click()
  await expect(page.getByRole('tablist', { name: /sections/i })).toBeVisible()
}

/** A part of the plan: BIA, RA or Plan. The structured lists live in those. */
function part(page: Page, name: string) {
  return page.getByRole('tablist', { name: 'Parts' }).getByRole('tab', { name, exact: true })
}

test.describe('structured sections', () => {
  test.setTimeout(60_000)

  test('a critical resource is added, shown and removed', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)
    await part(page, 'BIA').click()

    const contacts = page.getByRole('region', { name: 'Critical resources', exact: true })
    await contacts.getByRole('button', { name: /add resource/i }).click()
    const dialog = page.getByRole('dialog', { name: /add resource/i })

    // The rule: a person or a phone. Neither is refused, with the reason on the field.
    await dialog.getByRole('button', { name: /^save$/i }).click()
    await expect(dialog.getByRole('alert')).toContainText(/employee or.*phone/i)

    await dialog.getByRole('textbox', { name: /^contact type/i }).fill('E2E Primary')
    await dialog.getByRole('textbox', { name: /^primary phone/i }).fill('+91 90000 00001')
    await dialog.getByRole('spinbutton', { name: /seat count/i }).fill('4')
    await dialog.getByRole('button', { name: /^save$/i }).click()
    await expect(dialog).toHaveCount(0)

    const row = contacts.getByRole('row').filter({ hasText: 'E2E Primary' })
    await expect(row).toContainText('+91 90000 00001')
    await expect(row).toContainText('4')

    await row.getByRole('button', { name: /delete/i }).click()
    await expect(contacts.getByRole('row').filter({ hasText: 'E2E Primary' })).toHaveCount(0)
  })

  test('a risk is scored by the server and appears on the heat map', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)
    await part(page, 'RA').click()

    const register = page.getByRole('region', { name: 'Risk register' })
    await register.getByRole('button', { name: /add risk/i }).click()
    const dialog = page.getByRole('dialog', { name: /add risk/i })
    await dialog.getByRole('textbox', { name: /^risk \*/i }).fill('E2E power failure')
    await dialog.getByRole('combobox', { name: /resource type/i }).selectOption('Facilities')
    await dialog.getByRole('combobox', { name: /^likelihood/i }).selectOption({ label: 'Possible (2)' })
    await dialog.getByRole('combobox', { name: /^severity/i }).selectOption({ label: 'High (3)' })
    await dialog.getByRole('combobox', { name: /control effectiveness/i }).selectOption({ label: 'Ineffective (2)' })
    await dialog.getByRole('button', { name: /^save$/i }).click()
    await expect(dialog).toHaveCount(0)

    // The legacy row's numbers, derived on the server: 6, 4, Low.
    const row = register.getByRole('row').filter({ hasText: 'E2E power failure' })
    const cells = row.getByRole('cell')
    await expect(cells.nth(6)).toHaveText('6')
    await expect(cells.nth(7)).toHaveText('4')
    await expect(cells.nth(8)).toHaveText('Low')

    // It lands on the heat map at (Possible, High).
    const heat = page.getByRole('region', { name: /risk heat map/i })
    const cell = heat.getByRole('cell', { name: /Possible \(2\) likelihood, High \(3\) severity/ })
    await expect(cell).toContainText(/\d/)

    // Re-rating re-derives: No Controls (1) lifts residual to 5, Moderate.
    await row.getByRole('button', { name: /edit/i }).click()
    const edit = page.getByRole('dialog', { name: /edit risk/i })
    await edit.getByRole('combobox', { name: /control effectiveness/i }).selectOption({ label: 'No Controls (1)' })
    await edit.getByRole('button', { name: /^save$/i }).click()
    await expect(row.getByRole('cell').nth(7)).toHaveText('5')
    await expect(row.getByRole('cell').nth(8)).toHaveText('Moderate')

    // An action with a past target date shows as overdue.
    await row.getByRole('button', { name: /add action/i }).click()
    const action = page.getByRole('dialog', { name: /add action/i })
    await action.getByRole('combobox', { name: /^type/i }).selectOption('MITIGATION')
    await action.getByRole('textbox', { name: /^action \*/i }).fill('Service the generators')
    await action.getByRole('combobox', { name: /^status/i }).selectOption('In Process')
    await action.getByRole('textbox', { name: /target date/i }).fill('2026-01-01')
    await action.getByRole('button', { name: /^save$/i }).click()
    await expect(row).toContainText('overdue')

    // Tidy up.
    await row.getByRole('button', { name: /delete/i }).last().click()
    await expect(register.getByRole('row').filter({ hasText: 'E2E power failure' })).toHaveCount(0)
  })

  test('a recovery strategy comes from the catalogue', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)
    await part(page, 'Plan').click()

    const section = page.getByRole('region', { name: 'Recovery strategy' })
    await section.getByRole('button', { name: /add strategy/i }).click()
    const dialog = page.getByRole('dialog', { name: /add strategy/i })
    const core = dialog.getByRole('combobox', { name: /core strategy/i })
    const offered = await core.locator('option').allTextContents()
    expect(offered).toContain('Work from Home')
    expect(offered).toContain('Intercity')

    await core.selectOption('Work from Home')
    await dialog.getByRole('combobox', { name: /tactical strategy/i }).selectOption('Intercity')
    await dialog.getByRole('button', { name: /^save$/i }).click()
    await expect(dialog).toHaveCount(0)

    const row = section.getByRole('row').filter({ hasText: 'Work from Home' })
    await expect(row).toContainText('Intercity')
    await row.getByRole('button', { name: /delete/i }).click()
    await expect(section.getByRole('row').filter({ hasText: 'Work from Home' })).toHaveCount(0)
  })

  test('the plan carries the BIA lists read-only and takes a network diagram', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openEditor(page, COST_CODE)
    await part(page, 'Plan').click()

    // The BIA lists are shown, not edited, here.
    const resources = page.getByRole('region', { name: 'Critical resources (from BIA)' })
    await expect(resources).toBeVisible()
    await expect(resources.getByRole('button', { name: /add resource/i })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Network requirements (from BIA)' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Project contacts' })).toContainText(/Arun/)

    const diagram = page.getByRole('region', { name: 'Network diagram' })
    await diagram.getByLabel('Choose a network diagram').setInputFiles({
      name: 'e2e-network.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
    })
    const row = diagram.getByRole('listitem').filter({ hasText: 'e2e-network.png' })
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: /remove/i }).click()
    await expect(diagram.getByRole('listitem').filter({ hasText: 'e2e-network.png' })).toHaveCount(0)
  })

  test('a viewer sees the sections without add or edit', async ({ page }) => {
    await signIn(page, VIEWER)
    await openEditor(page, COST_CODE)
    await part(page, 'RA').click()
    await expect(page.getByRole('region', { name: 'Risk register' })).toBeVisible()
    await expect(page.getByRole('button', { name: /add risk/i })).toHaveCount(0)
    await part(page, 'BIA').click()
    await expect(page.getByRole('button', { name: /add resource/i })).toHaveCount(0)
    await part(page, 'Plan').click()
    await expect(page.getByRole('button', { name: /upload diagram/i })).toHaveCount(0)
  })
})
