import { expect, test, type Page } from '@playwright/test'
/**
 * Journey step 4 through a real browser (Phase 3.7): the row menu, the edit
 * drawer, coordinator assignment, the version list, history and copy-on-write.
 *
 * Same prerequisites as cost-codes.spec.ts. The tests leave the demo data as
 * they found it where they can — an edit is reverted, an assignment removed —
 * so the suite is re-runnable. The one exception is copy-on-write, which is
 * irreversible by design; that test asserts whichever state it finds.
 */

import { COORDINATOR, VIEWER, signIn } from './auth'

const APPROVED_COST_CODE = '65-DEMO01' // Approved v1 in the demo seed; copied by the copy test
// A second Approved cost code the copy test never touches, so its history stays
// the seeded four-step trail ending in Approved.
const UNTOUCHED_APPROVED_COST_CODE = '65-DEMO07'

/**
 * Form controls by role, not by label. `Field` wraps its control in a
 * `<label>`, and a wrapping label's text includes the select's option text —
 * so `getByLabel(/^process$/)` never matches while the accessible *name* is
 * still just "Process". Roles use the accessible name.
 */
const textbox = (scope: Page | ReturnType<Page['getByRole']>, name: RegExp) =>
  scope.getByRole('textbox', { name })
const combobox = (scope: Page | ReturnType<Page['getByRole']>, name: string) =>
  scope.getByRole('combobox', { name, exact: true })

async function openCostCode(page: Page, code: string) {
  await page.getByRole('link', { name: /Bangalore Estate/ }).click()
  await page.getByLabel(/filter by cost code/i).fill(code)
  await expect(page.getByRole('link', { name: code, exact: true })).toBeVisible()
  // The filter is debounced and the table keeps its old rows while the new
  // page loads; acting on a row before the refetch lands means clicking an
  // element the re-render is about to replace.
  // ...and the filter is debounced, so first wait for it to reach the URL —
  // otherwise "not updating" is checked before the fetch has even started.
  await expect(page).toHaveURL(/cost_code=/)
  await expect(page.getByText('Updating')).toHaveCount(0)
}

test.describe('cost code actions', () => {
  test.setTimeout(60_000)

  test('the row menu reaches every action', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openCostCode(page, UNTOUCHED_APPROVED_COST_CODE)

    await page.getByRole('button', { name: `Actions for ${UNTOUCHED_APPROVED_COST_CODE}` }).click()
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: /edit cost code/i })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /assign coordinator/i })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /BCP plan \(v\d+\)/ })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /previous versions/i })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /history/i })).toBeVisible()

    await menu.getByRole('menuitem', { name: /history/i }).click()
    await expect(page).toHaveURL(/\/cost-codes\/\d+\?action=history/)
    const history = page.getByRole('dialog', { name: /history/i })
    await expect(history).toBeVisible()
    // This cost code's *current version* is Approved (its badge on the row
    // says so) and is never re-versioned by another test, so its trail always
    // ends in Approved — but a plan can pick up a second version over time
    // (a copy, a rework cycle) whose own trail starts fresh, shortening what
    // "the seeded trail" means. Assert what's actually guaranteed — every step
    // a real status, ending in Approved — not one exact hardcoded sequence.
    // `allInnerTexts` does not wait, so wait for at least one row first.
    await expect(history.locator('ol li').first()).toBeVisible()
    const statuses = (await history.locator('ol li').allInnerTexts()).map(
      (t) => t.split(String.fromCharCode(10))[0],
    )
    const validStatuses = ['Not Started', 'Work in Progress', 'Pending BU Lead Review', 'Approved', 'Rework', 'Exempted']
    expect(statuses.length).toBeGreaterThan(0)
    for (const status of statuses) expect(validStatuses).toContain(status)
    expect(statuses.at(-1)).toBe('Approved')
  })

  test('editing a cost code validates, saves, and is reverted', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openCostCode(page, APPROVED_COST_CODE)
    await page.getByRole('link', { name: APPROVED_COST_CODE, exact: true }).click()
    await expect(page.getByRole('heading', { name: APPROVED_COST_CODE })).toBeVisible()

    await page.getByRole('button', { name: /edit cost code/i }).click()
    const dialog = page.getByRole('dialog', { name: /edit/i })
    await expect(dialog).toBeVisible()

    // A blank code is refused before anything is saved.
    const codeField = textbox(dialog, /^cost code/i)
    await codeField.fill('   ')
    await dialog.getByRole('button', { name: /save changes/i }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()

    // A real change saves and the page reflects it.
    await codeField.fill(`${APPROVED_COST_CODE}-E2E`)
    await dialog.getByRole('button', { name: /save changes/i }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('heading', { name: `${APPROVED_COST_CODE}-E2E` })).toBeVisible()

    // Put it back.
    await page.getByRole('button', { name: /edit cost code/i }).click()
    await textbox(page.getByRole('dialog'), /^cost code/i).fill(APPROVED_COST_CODE)
    await page.getByRole('dialog').getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByRole('heading', { name: APPROVED_COST_CODE, exact: true })).toBeVisible()
  })

  test('the subprocess list narrows to the chosen process', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openCostCode(page, APPROVED_COST_CODE)
    await page.getByRole('link', { name: APPROVED_COST_CODE, exact: true }).click()
    await page.getByRole('button', { name: /edit cost code/i }).click()
    const dialog = page.getByRole('dialog')

    await combobox(dialog, 'Process').selectOption({ label: 'Finance Operations' })
    const subprocess = combobox(dialog, 'Subprocess')
    const offered = await subprocess.locator('option').allTextContents()
    expect(offered).toContain('Accounts Payable')
    expect(offered).not.toContain('Customer Contact Handling')

    await dialog.getByRole('button', { name: /cancel/i }).click()
  })

  test('a coordinator can be assigned and removed', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openCostCode(page, APPROVED_COST_CODE)
    await page.getByRole('link', { name: APPROVED_COST_CODE, exact: true }).click()

    await page.getByRole('button', { name: /assign coordinator/i }).click()
    const dialog = page.getByRole('dialog', { name: /assign coordinator/i })
    // `type="search"` inputs have the searchbox role, not textbox.
    await dialog.getByRole('searchbox', { name: /find a colleague/i }).fill('Meera')
    await dialog.getByRole('option', { name: /Meera Analyst/ }).click()
    await combobox(dialog, 'Role on this plan').selectOption('Backup')
    await dialog.getByRole('button', { name: /assign and notify/i }).click()
    await expect(dialog).toHaveCount(0)

    const current = page.getByRole('region', { name: /current version/i })
    await expect(current).toContainText('Meera Analyst')
    await expect(current).toContainText('Backup')

    // Remove her again so the run is repeatable.
    await page.getByRole('button', { name: /assign coordinator/i }).click()
    const roster = page.getByRole('dialog').getByText('Meera Analyst').locator('..').locator('..')
    await roster.getByRole('button', { name: /remove/i }).click()
    await expect(page.getByRole('dialog')).not.toContainText('Meera Analyst')
    await page.keyboard.press('Escape')
    await expect(current).not.toContainText('Meera Analyst')
  })

  test('a role already held asks before it is handed over', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openCostCode(page, APPROVED_COST_CODE)
    await page.getByRole('link', { name: APPROVED_COST_CODE, exact: true }).click()
    const current = page.getByRole('region', { name: /current version/i })
    await expect(current).toContainText('Arun Coordinator')

    // Arun is Primary. Choosing Primary for Meera asks, and "Keep current" backs out.
    await page.getByRole('button', { name: /assign coordinator/i }).click()
    const dialog = page.getByRole('dialog', { name: /assign coordinator/i })
    await dialog.getByRole('searchbox', { name: /find a colleague/i }).fill('Meera')
    await dialog.getByRole('option', { name: /Meera Analyst/ }).click()
    await combobox(dialog, 'Role on this plan').selectOption('Primary')
    await dialog.getByRole('button', { name: /assign and notify/i }).click()
    const ask = dialog.getByRole('alertdialog', { name: /replace the current holder/i })
    await expect(ask).toContainText(/Arun Coordinator/)
    await ask.getByRole('button', { name: /keep current/i }).click()
    await expect(ask).toHaveCount(0)
    await expect(dialog).toBeVisible()

    // Replacing hands the role over: one Primary, and it is Meera.
    await dialog.getByRole('button', { name: /assign and notify/i }).click()
    await ask.getByRole('button', { name: /^replace$/i }).click()
    await expect(dialog).toHaveCount(0)
    await expect(current).toContainText('Meera Analyst (Primary)')
    await expect(current).not.toContainText('Arun Coordinator (Primary)')

    // Put Arun back the same way, so the run is repeatable.
    await page.getByRole('button', { name: /assign coordinator/i }).click()
    const again = page.getByRole('dialog', { name: /assign coordinator/i })
    await again.getByRole('searchbox', { name: /find a colleague/i }).fill('Arun')
    await again.getByRole('option', { name: /Arun Coordinator/ }).click()
    await combobox(again, 'Role on this plan').selectOption('Primary')
    await again.getByRole('button', { name: /assign and notify/i }).click()
    await again.getByRole('alertdialog').getByRole('button', { name: /^replace$/i }).click()
    await expect(again).toHaveCount(0)
    await expect(current).toContainText('Arun Coordinator (Primary)')
    await expect(current).not.toContainText('Meera Analyst')
  })

  test('copy-on-write creates an editable version and keeps the original', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await openCostCode(page, APPROVED_COST_CODE)
    await page.getByRole('link', { name: APPROVED_COST_CODE, exact: true }).click()

    const current = page.getByRole('region', { name: /current version/i })
    await expect(current).toBeVisible()
    const newVersion = current.getByRole('button', { name: /new version/i })

    // `isVisible()` does not wait, so the region is awaited above first.
    if (await newVersion.isVisible()) {
      await newVersion.click()
      const dialog = page.getByRole('dialog', { name: /new version/i })
      await dialog.getByRole('textbox', { name: /reason/i }).fill('E2E annual refresh')
      await dialog.getByRole('button', { name: /create new version/i }).click()
      await expect(dialog).toHaveCount(0)
    }

    // Either way — copied just now or on a previous run — the state must be:
    // a Work in Progress current version above an Approved previous one.
    await expect(current).toContainText('Version 2')
    await expect(current).toContainText('Work in Progress')
    await expect(current).toContainText('copied from a previous version')
    const previous = page.getByRole('region', { name: /previous versions/i })
    await expect(previous).toContainText('Version 1')
    await expect(previous).toContainText('Approved')
    // The original stays approved and cannot be copied again while v2 is open.
    await expect(previous.getByRole('button', { name: /copy as new/i })).toHaveCount(0)

    // The copy's history is its own, not the original's.
    await current.getByRole('button', { name: /history/i }).click()
    const history = page.getByRole('dialog', { name: /history — version 2/i })
    await expect(history).toContainText('Work in Progress')
    await expect(history).not.toContainText('Approved')
  })

  test('a viewer sees no authoring actions', async ({ page }) => {
    await signIn(page, VIEWER)
    await openCostCode(page, APPROVED_COST_CODE)
    await page.getByRole('link', { name: APPROVED_COST_CODE, exact: true }).click()

    await expect(page.getByRole('heading', { name: APPROVED_COST_CODE })).toBeVisible()
    await expect(page.getByRole('button', { name: /edit cost code/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /assign coordinator/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /new version/i })).toHaveCount(0)
    // But history is readable.
    await expect(page.getByRole('button', { name: /history/i }).first()).toBeVisible()
  })
})
