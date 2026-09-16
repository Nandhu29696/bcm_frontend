import { expect, test, type Page } from '@playwright/test'
/**
 * Journey steps 1-3 through a real browser (Phase 2.7).
 *
 * Prerequisites — the suite fails fast and says so if they are not met:
 *   1. The Django backend is running, seeded with `seed_demo_data`.
 *   2. It was started with REQUIRE_OTP_FOR_LOGIN=False. The second factor sends
 *      a code by email, which a browser test cannot read; disabling it for E2E
 *      keeps the rest of the login path honest rather than stubbing all of it.
 *   3. Vite's VITE_API_TARGET points at that backend.
 */

import { COORDINATOR, VIEWER, signIn, signInThroughTheForm } from './auth'

/**
 * Open a filter dropdown and tick one option by its visible label.
 *
 * Scoped to the filter landmark because the table header carries buttons with
 * the same labels — "BCP status" is both a filter and a sortable column.
 */
async function pickFilter(page: Page, filter: string, option: string | RegExp) {
  const filters = page.getByRole('search', { name: /cost code filters/i })
  await filters.getByRole('button', { name: new RegExp(`^${filter}`, 'i') }).click()
  const list = filters.getByRole('listbox', { name: new RegExp(filter, 'i') })
  await list.getByRole('option', { name: option }).click()
  await page.keyboard.press('Escape')
}

/** The sort control in a column header, as opposed to the filter of that name. */
function sortHeader(page: Page, column: string | RegExp) {
  return page.getByRole('columnheader', { name: column }).getByRole('button')
}

function rowCount(page: Page) {
  return page.locator('tbody tr').count()
}

/** Rows arrive from a second request, after the estate name. Wait for them. */
async function waitForRows(page: Page) {
  await expect(page.locator('tbody tr').first()).toBeVisible()
}

/**
 * Wait for the table to shrink, then report the settled count.
 *
 * The page keeps the previous rows on screen while the next query runs, so the
 * table does not collapse to a spinner on every keystroke. That means a count
 * read immediately after the URL changes is still the *old* one — it has to be
 * polled until it settles.
 */
async function rowCountAfterNarrowing(page: Page, previous: number) {
  await expect.poll(() => rowCount(page), { timeout: 10_000 }).toBeLessThan(previous)
  return rowCount(page)
}

test.describe('estate and cost code navigation', () => {
  test('a coordinator reaches the cost code table from the estate list', async ({ page }) => {
    await signInThroughTheForm(page, COORDINATOR)

    await expect(page.getByRole('heading', { name: 'Estates' })).toBeVisible()
    const card = page.getByRole('link', { name: /Bangalore Estate/ })
    await expect(card).toBeVisible()
    // The rollup is the reason this screen exists, not just a list of names.
    await expect(card).toContainText('cost code')

    await card.click()
    await expect(page).toHaveURL(/\/estates\/\d+\/cost-codes/)
    await expect(page.getByRole('heading', { name: 'Bangalore Estate' })).toBeVisible()
    await waitForRows(page)
    expect(await rowCount(page)).toBeGreaterThan(0)
  })

  test('all six filters narrow the table and survive a reload', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('link', { name: /Bangalore Estate/ }).click()
    await waitForRows(page)

    const unfiltered = await rowCount(page)
    expect(unfiltered).toBeGreaterThan(1)

    // 1. free text on the cost code itself (debounced)
    await page.getByLabel(/filter by cost code/i).fill('DEMO0')
    await expect(page).toHaveURL(/cost_code=DEMO0/, { timeout: 5_000 })
    const afterText = await rowCountAfterNarrowing(page, unfiltered)

    // 2-6. the five faceted filters
    await pickFilter(page, 'Process', /Customer Support/)
    await expect(page).toHaveURL(/process=\d+/)

    await pickFilter(page, 'Subprocess', /Customer Contact/)
    await expect(page).toHaveURL(/subprocess=\d+/)

    await pickFilter(page, 'Region', /South Asia/)
    await expect(page).toHaveURL(/region=\d+/)

    await pickFilter(page, 'BU lead', /Priya/)
    await expect(page).toHaveURL(/bu_lead=\d+/)

    // Filter by whatever status the first remaining row actually has, rather
    // than a hard-coded one: other suites move plans through the workflow (the
    // copy-on-write test turns an Approved plan into Work in Progress), and a
    // filter combination that assumed a status would silently match nothing.
    const firstStatus = (await page.locator('tbody tr').first().locator('td').nth(5).innerText()).trim()
    await pickFilter(page, 'BCP status', new RegExp(`^${firstStatus}$`))
    await expect(page).toHaveURL(/bcp_status=/)

    await expect.poll(() => rowCount(page)).toBeLessThanOrEqual(afterText)
    const filtered = await rowCount(page)
    expect(filtered).toBeGreaterThan(0)

    // The property that makes a filtered view shareable: the URL is the state.
    const url = page.url()
    await page.reload()
    await waitForRows(page)
    expect(page.url()).toBe(url)
    expect(await rowCount(page)).toBe(filtered)
    // And the controls come back populated, not blank.
    await expect(page.getByLabel(/filter by cost code/i)).toHaveValue('DEMO0')
    await expect(page.getByRole('search', { name: /cost code filters/i }).getByRole('button', { name: /^Process/i })).toContainText('1')
  })

  test('clearing filters restores the full table', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('link', { name: /Bangalore Estate/ }).click()
    await waitForRows(page)
    const unfiltered = await rowCount(page)

    await pickFilter(page, 'BCP status', /Approved/)
    await rowCountAfterNarrowing(page, unfiltered)

    await page.getByRole('button', { name: /clear \d+ filter/i }).click()
    await expect(page).toHaveURL(/cost-codes$/)
    await expect.poll(() => rowCount(page)).toBe(unfiltered)
  })

  test('sorting by BCP status round-trips through the URL', async ({ page }) => {
    await signIn(page, COORDINATOR)
    await page.getByRole('link', { name: /Bangalore Estate/ }).click()
    await waitForRows(page)

    const header = sortHeader(page, /BCP status/i)
    await header.click()
    await expect(page).toHaveURL(/ordering=current_bcp_status/)
    await header.click()
    await expect(page).toHaveURL(/ordering=-current_bcp_status/)
  })

  test('a user sees only the estates they are scoped to', async ({ page }) => {
    await signIn(page, VIEWER)
    await expect(page.getByRole('link', { name: /Bangalore Estate/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Chennai Estate/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /London Estate/ })).toHaveCount(0)
  })

  test('an estate outside scope is refused, not silently empty', async ({ page }) => {
    await signIn(page, VIEWER)
    // Chennai is estate 2 in the demo seed and is not in this user's scope.
    await page.goto('/estates/2/cost-codes')
    await expect(page.getByRole('alert')).toContainText(/not in your scope/i)
  })
})
